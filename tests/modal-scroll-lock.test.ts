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
 * 这里锁定 body 与根元素的 overflow，并按引用计数支持嵌套。
 */

const resetPage = () => {
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
  document.body.innerHTML = '';
};

let scrollToSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetPage();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
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

describe('modal-scroll-lock：页面锁定', () => {
  it('加锁时固定 body 并记住滚动位置，解锁时还原', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 });

    lockModalScroll();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-320px');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unlockModalScroll();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(scrollToSpy).toHaveBeenCalledWith(0, 320);
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
