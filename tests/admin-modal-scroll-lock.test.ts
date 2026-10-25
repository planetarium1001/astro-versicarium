// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindModalScrollLock } from '../src/scripts/admin-console/modal-scroll-binding';
import { isModalScrollLocked } from '../src/scripts/modal-scroll-lock';

/**
 * 覆盖层滚动锁绑定。
 *
 * 回归点：六个 div 型覆盖层的关闭路径分散（按钮、Esc、遮罩、脚本），
 * 逐处调用解锁容易漏减引用计数，导致页面永久锁定。
 *
 * 共享锁有两条路径：细指针只锁 html（sticky 侧栏不再错位），粗指针固定 body。
 * 这里两条都覆盖，绑定层本身与路径无关。
 */

const resetPage = () => {
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.input;
  document.body.innerHTML = '';
};

/** 媒体查询按用例切换指针类型；其余查询一律不命中。 */
const stubPointer = (fine: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: fine)' ? fine : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  }));
};

/**
 * 模拟布局宽度。
 *
 * 真实浏览器里加锁后有两种结果：
 * - `scrollbar-gutter: stable` 已预留槽位：clientWidth 报告变宽，但布局宽度不变；
 * - 没有预留槽位：布局真的变宽一个槽宽，内容会右移。
 * 锁用布局宽度（body 的 rect）判断要不要补偿，所以这里把两者分开模拟。
 */
const stubLayout = ({ gutter = 15, reserved = true }: { gutter?: number; reserved?: boolean } = {}) => {
  const innerWidth = 1200;
  const locked = () => document.documentElement.style.overflow === 'hidden';
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => (locked() ? innerWidth : innerWidth - gutter)
  });
  Object.defineProperty(document.body, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        width: reserved || !locked() ? innerWidth - gutter : innerWidth,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0
      }) as DOMRect
  });
};

const readPageInline = () => document.documentElement.style.getPropertyValue('--page-inline').trim();

beforeEach(() => {
  resetPage();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  // 默认粗指针：保留 body fixed 路径的既有断言，细指针用例单独覆盖。
  stubPointer(false);
  // 1200 视口、15px 滚动条槽，且 scrollbar-gutter 已预留（桌面默认形态）。
  stubLayout();
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  // 跨用例泄漏要暴露出来，而不是被下一例静默归零掩盖。
  expect(isModalScrollLocked(), '上一个用例结束时锁未释放').toBe(false);
  vi.unstubAllGlobals();
  resetPage();
});

describe('bindModalScrollLock：加锁与解锁（粗指针）', () => {
  it('传入元素时固定 body 并加锁，cleanup 后解锁并还原页面样式', () => {
    const panel = document.createElement('div');

    const release = bindModalScrollLock(panel);
    expect(isModalScrollLocked()).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(document.documentElement.style.overflow).toBe('hidden');

    release();
    expect(isModalScrollLocked()).toBe(false);
    expect(document.body.style.position).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('传入 null 时不加锁，cleanup 是空操作', () => {
    const release = bindModalScrollLock(null);

    expect(isModalScrollLocked()).toBe(false);
    expect(() => release()).not.toThrow();
    expect(isModalScrollLocked()).toBe(false);
  });

  it('同一元素重复绑定只占一次计数，任一次 cleanup 即解锁', () => {
    const panel = document.createElement('div');

    const releaseFirst = bindModalScrollLock(panel);
    const releaseSecond = bindModalScrollLock(panel);
    expect(isModalScrollLocked()).toBe(true);

    releaseFirst();
    expect(isModalScrollLocked()).toBe(false);

    releaseSecond();
    expect(isModalScrollLocked()).toBe(false);
  });

  it('两个元素嵌套时，内层先解锁外层仍保持锁定', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');

    const releaseOuter = bindModalScrollLock(outer);
    const releaseInner = bindModalScrollLock(inner);
    expect(isModalScrollLocked()).toBe(true);

    releaseInner();
    expect(isModalScrollLocked()).toBe(true);
    expect(document.body.style.position).toBe('fixed');

    releaseOuter();
    expect(isModalScrollLocked()).toBe(false);
    expect(document.body.style.position).toBe('');
  });
});

describe('bindModalScrollLock：加锁与解锁（细指针）', () => {
  beforeEach(() => {
    stubPointer(true);
  });

  it('只锁 html 的 overflow，body 不再 fixed，已预留槽位时不补偿', () => {
    const panel = document.createElement('div');
    document.documentElement.style.setProperty('--page-inline', '17px');

    const release = bindModalScrollLock(panel);
    expect(isModalScrollLocked()).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(readPageInline()).toBe('17px');
    expect(document.body.style.position).toBe('');

    release();
    expect(isModalScrollLocked()).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    expect(readPageInline()).toBe('17px');
    expect(document.body.style.position).toBe('');
  });

  it('槽位被撤销、布局变宽时补偿 --page-inline，cleanup 后还原', () => {
    stubLayout({ gutter: 15, reserved: false });
    const panel = document.createElement('div');
    document.documentElement.style.setProperty('--page-inline', '17px');

    const release = bindModalScrollLock(panel);
    expect(readPageInline()).toBe('calc(17px + 15px)');

    release();
    expect(readPageInline()).toBe('17px');
  });

  it('嵌套绑定时内层 cleanup 不还原，最后一个 cleanup 才解锁', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    document.documentElement.style.setProperty('--page-inline', '17px');

    const releaseOuter = bindModalScrollLock(outer);
    const releaseInner = bindModalScrollLock(inner);

    releaseInner();
    expect(isModalScrollLocked()).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(readPageInline()).toBe('17px');

    releaseOuter();
    expect(isModalScrollLocked()).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('覆盖层源码接线守卫', () => {
  const overlayFiles = [
    'src/components/admin/editor/list-actions/ContentBulkResultDialog.svelte',
    'src/components/admin/editor/list-actions/BitsCreateAction.svelte',
    'src/components/admin/editor/frontmatter/ArticleInfoDialog.svelte',
    'src/components/admin/editor/media-insert/ImageInsertDialog.svelte',
    'src/components/admin/editor/media-insert/GalleryInsertDialog.svelte',
    'src/scripts/admin-content/editor-recovery.ts'
  ];

  it.each(overlayFiles)('%s 引用共享滚动锁', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(source).toMatch(/bindModalScrollLock|lockScrollFor/);
  });
});
