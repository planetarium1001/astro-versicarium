// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isModalScrollLocked,
  lockModalScroll,
  lockScrollFor,
  unlockModalScroll,
  unlockScrollFor
} from '../src/scripts/modal-scroll-lock';
import { initCardDialogs } from '../src/scripts/dialog-controller';

/**
 * 模态层的页面滚动锁。
 *
 * 回归点：`<dialog>.showModal()` 只让背景不可交互，不阻止滚动穿透。
 * 在遮罩上滚动、或弹窗内容不足一屏时，滚动会落到后面的页面上。
 *
 * 另一条回归点（真机反馈）：body fixed 会让页面里所有 `position: sticky` 元素失去
 * 滚动容器，落到 -scrollY，表现为打开弹窗时背景侧栏往上跳。因此细指针改走
 * 「只锁 html overflow + --page-inline 补偿滚动条槽」，粗指针保留 body fixed。
 */

const resetPage = () => {
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.input;
  document.body.innerHTML = '';
};

/** 媒体查询按用例切换指针类型；其余查询（prefers-reduced-motion 等）一律不命中。 */
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

let scrollToSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetPage();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  // 默认粗指针：保留 body fixed 路径的既有断言，细指针用例单独覆盖。
  stubPointer(false);
  // 1200 视口、15px 滚动条槽，且 scrollbar-gutter 已预留（桌面默认形态）。
  stubLayout();
  scrollToSpy = vi.fn();
  vi.stubGlobal('scrollTo', scrollToSpy);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  // 跨用例泄漏要暴露出来，而不是被下一例静默归零掩盖。
  expect(isModalScrollLocked(), '上一个用例结束时锁未释放').toBe(false);
  vi.unstubAllGlobals();
  resetPage();
});

describe('modal-scroll-lock：细指针路径', () => {
  beforeEach(() => {
    stubPointer(true);
  });

  it('只锁 html 的 overflow，body 保持静态，不移动滚动位置', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 });
    document.documentElement.style.setProperty('--page-inline', '17px');

    lockModalScroll();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.overflow).toBe('');

    unlockModalScroll();
    expect(document.documentElement.style.overflow).toBe('');
    // 滚动位置本来就没动，不需要 scrollTo 还原。
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('滚动条槽被撤销、布局变宽时补偿 --page-inline，解锁还原原内联值', () => {
    stubLayout({ gutter: 15, reserved: false });
    document.documentElement.style.setProperty('--page-inline', '17px');

    lockModalScroll();
    // 结束内边距加回槽宽：17px + 15px，内容盒右缘与加锁前重合。
    expect(readPageInline()).toBe('calc(17px + 15px)');

    unlockModalScroll();
    expect(readPageInline()).toBe('17px');
  });

  it('scrollbar-gutter 已预留槽位时不补偿（布局没变，补偿会推歪内容）', () => {
    document.documentElement.style.setProperty('--page-inline', '17px');

    lockModalScroll();
    expect(readPageInline()).toBe('17px');

    unlockModalScroll();
    expect(readPageInline()).toBe('17px');
  });

  it('原内联值为空时解锁移除变量，不留下空声明', () => {
    stubLayout({ gutter: 15, reserved: false });

    lockModalScroll();
    expect(readPageInline()).toBe('var(--page-gap-inline)');

    unlockModalScroll();
    expect(readPageInline()).toBe('');
    expect(document.documentElement.getAttribute('style') ?? '').not.toContain('--page-inline');
  });

  it('没有滚动条槽（浮层滚动条）时不写 --page-inline', () => {
    stubLayout({ gutter: 0, reserved: false });
    document.documentElement.style.setProperty('--page-inline', '17px');

    lockModalScroll();
    expect(readPageInline()).toBe('17px');

    unlockModalScroll();
    expect(readPageInline()).toBe('17px');
  });

  it('嵌套加锁时只在最后一个解锁后还原', () => {
    stubLayout({ gutter: 15, reserved: false });
    const dialog = document.createElement('dialog');
    const lightbox = document.createElement('dialog');

    lockScrollFor(dialog);
    lockScrollFor(lightbox);
    unlockScrollFor(lightbox);
    expect(isModalScrollLocked()).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(readPageInline()).toBe('var(--page-gap-inline)');

    unlockScrollFor(dialog);
    expect(isModalScrollLocked()).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('modal-scroll-lock：粗指针路径', () => {
  it('加锁时固定 body 并记住滚动位置，解锁时还原', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 });

    lockModalScroll();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-320px');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    // 槽宽 15px 转成 body 的右内边距补偿。
    expect(document.body.style.paddingRight).toBe('15px');

    unlockModalScroll();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.paddingRight).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(scrollToSpy).toHaveBeenCalledWith(0, 320);
  });

  it('粗指针不写 --page-inline，补偿只落在 body 内边距上', () => {
    document.documentElement.style.setProperty('--page-inline', '17px');

    lockModalScroll();
    expect(readPageInline()).toBe('17px');
    expect(document.body.style.paddingRight).toBe('15px');

    unlockModalScroll();
    expect(readPageInline()).toBe('17px');
  });

  it('嵌套加锁时只在最后一个解锁后还原', () => {
    lockModalScroll();
    lockModalScroll();
    unlockModalScroll();
    expect(isModalScrollLocked()).toBe(true);
    expect(document.body.style.position).toBe('fixed');

    unlockModalScroll();
    expect(isModalScrollLocked()).toBe(false);
    expect(document.body.style.position).toBe('');
  });

  it('多余的解锁不会把页面留在锁定态，也不会重复还原', () => {
    unlockModalScroll();
    expect(isModalScrollLocked()).toBe(false);

    lockModalScroll();
    unlockModalScroll();
    unlockModalScroll();
    expect(isModalScrollLocked()).toBe(false);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });

  it('按元素配对时同一元素重复加锁只算一次', () => {
    const dialog = document.createElement('dialog');

    lockScrollFor(dialog);
    lockScrollFor(dialog);
    unlockScrollFor(dialog);
    expect(isModalScrollLocked()).toBe(false);
  });

  it('两个不同元素嵌套加锁时，先关内层不会解开外层', () => {
    const dialog = document.createElement('dialog');
    const lightbox = document.createElement('dialog');

    lockScrollFor(dialog);
    lockScrollFor(lightbox);
    expect(isModalScrollLocked()).toBe(true);

    unlockScrollFor(lightbox);
    expect(isModalScrollLocked()).toBe(true);
    expect(document.body.style.position).toBe('fixed');

    unlockScrollFor(dialog);
    expect(isModalScrollLocked()).toBe(false);
    expect(document.body.style.position).toBe('');
  });

  it('同一元素重复打开只占一次计数，关闭一次即解锁', () => {
    const dialog = document.createElement('dialog');

    lockScrollFor(dialog);
    lockScrollFor(dialog);
    lockScrollFor(dialog);
    unlockScrollFor(dialog);
    expect(isModalScrollLocked()).toBe(false);
  });

  it('解锁时还原 width 与 paddingRight', () => {
    lockModalScroll();
    document.body.style.width = '100%';
    document.body.style.paddingRight = '15px';
    unlockModalScroll();

    expect(document.body.style.width).toBe('');
    expect(document.body.style.paddingRight).toBe('');
  });

  it('按元素配对时未加锁的元素解锁不影响其他锁', () => {
    const locked = document.createElement('dialog');
    const untouched = document.createElement('dialog');

    lockScrollFor(locked);
    unlockScrollFor(untouched);
    expect(isModalScrollLocked()).toBe(true);

    unlockScrollFor(locked);
    expect(isModalScrollLocked()).toBe(false);
  });
});

describe('modal-scroll-lock：指针判定', () => {
  it('触屏输入优先于细指针：data-input="touch" 时仍走 body fixed', () => {
    stubPointer(true);
    document.documentElement.dataset.input = 'touch';

    lockModalScroll();
    expect(document.body.style.position).toBe('fixed');
    expect(readPageInline()).toBe('');

    unlockModalScroll();
    expect(document.body.style.position).toBe('');
  });

  it('没有 matchMedia 的环境按粗指针处理', () => {
    vi.stubGlobal('matchMedia', undefined);

    lockModalScroll();
    expect(document.body.style.position).toBe('fixed');

    unlockModalScroll();
    expect(document.body.style.position).toBe('');
  });
});

describe('modal-scroll-lock：弹窗接线', () => {
  const mountDialog = () => {
    document.body.innerHTML = `
      <button type="button" data-open data-dialog="card-dialog">打开</button>
      <dialog id="card-dialog" data-panel>
        <div class="panel">
          <h2 class="title" tabindex="-1">标题</h2>
          <button type="button" data-close>关闭</button>
          <div class="content">正文</div>
        </div>
      </dialog>
    `;
    const dialog = document.querySelector<HTMLDialogElement>('#card-dialog')!;
    dialog.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialog.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    return dialog;
  };

  const wireDialogs = () => {
    initCardDialogs({
      cardSelector: '[data-open]',
      openSelector: '[data-open]',
      closeSelector: '[data-close]',
      panelSelector: '[data-panel]',
      dialogIdAttribute: 'data-dialog',
      focusSelector: '.title',
      scrollResetSelector: '.content'
    });
  };

  const click = (element: Element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  it('打开弹窗时锁住页面，关闭后解锁', () => {
    const dialog = mountDialog();
    wireDialogs();

    click(document.querySelector('[data-open]')!);
    expect(dialog.open).toBe(true);
    expect(isModalScrollLocked()).toBe(true);

    click(document.querySelector('[data-close]')!);
    expect(dialog.open).toBe(false);
    expect(isModalScrollLocked()).toBe(false);
  });

  it('原生 Esc 关闭（只有 close 事件）也会解锁', () => {
    const dialog = mountDialog();
    wireDialogs();

    click(document.querySelector('[data-open]')!);
    expect(isModalScrollLocked()).toBe(true);

    // 浏览器在 Esc 时先派发 cancel，再关闭并派发 close。
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
    expect(isModalScrollLocked()).toBe(false);
  });

  it('重复关闭不会把引用计数减成负数', () => {
    const dialog = mountDialog();
    wireDialogs();

    click(document.querySelector('[data-open]')!);
    click(document.querySelector('[data-close]')!);
    dialog.dispatchEvent(new Event('close'));
    expect(isModalScrollLocked()).toBe(false);

    // 再次打开仍能正常加锁，说明计数没有被减穿。
    click(document.querySelector('[data-open]')!);
    expect(isModalScrollLocked()).toBe(true);

    click(document.querySelector('[data-close]')!);
    expect(isModalScrollLocked()).toBe(false);
  });
});
