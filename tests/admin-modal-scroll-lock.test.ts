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
 */

const resetPage = () => {
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
  document.body.innerHTML = '';
};

beforeEach(() => {
  resetPage();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  // 跨用例泄漏要暴露出来，而不是被下一例静默归零掩盖。
  expect(isModalScrollLocked(), '上一个用例结束时锁未释放').toBe(false);
  vi.unstubAllGlobals();
  resetPage();
});

describe('bindModalScrollLock：加锁与解锁', () => {
  it('传入元素时加锁，cleanup 后解锁并还原页面样式', () => {
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
