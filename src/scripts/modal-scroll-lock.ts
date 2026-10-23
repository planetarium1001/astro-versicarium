/**
 * 模态层打开时锁住页面滚动。
 *
 * `<dialog>.showModal()` 只让背景不可交互，并不阻止滚动穿透：
 * - 在遮罩上滚动时，滚动落到后面的页面上；
 * - 弹窗内容没有可滚动空间时，滚轮事件冒泡到页面，同样带动整页。
 *
 * 做法沿用灯箱原先的实现：把 body 固定住并记住 scrollY，关闭时还原；同时锁住
 * documentElement 的 overflow，避免部分引擎仍能从根元素滚动。
 *
 * 支持嵌套：同一时刻可能有多个模态层（例如弹窗里再开灯箱），按引用计数加锁，
 * 最后一个关闭时才解锁。
 */

type ScrollSnapshot = {
  top: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
  docOverflow: string;
};

let lockCount = 0;
let snapshot: ScrollSnapshot | null = null;

const canUseDom = (): boolean =>
  typeof document !== 'undefined' && document.body !== null && document.documentElement !== null;

/** 记录当前滚动位置并固定页面。 */
export const lockModalScroll = (): void => {
  if (!canUseDom()) return;
  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  const doc = document.documentElement;
  const widthBeforeLock = doc.clientWidth;

  snapshot = {
    top: window.scrollY || doc.scrollTop || 0,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
    docOverflow: doc.style.overflow
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${snapshot.top}px`;
  body.style.width = '100%';
  doc.style.overflow = 'hidden';

  // 只有锁定后真的变宽才补 padding：scrollbar-gutter 保留槽位时差值为 0，
  // 部分引擎在 overflow: hidden 下撤销槽位，差值即滚动条宽度。
  const scrollbarWidth = doc.clientWidth - widthBeforeLock;
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
};

/** 还原滚动位置与页面样式；未加锁或仍有其他模态层时什么也不做。 */
export const unlockModalScroll = (): void => {
  if (!canUseDom()) return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0 || snapshot === null) return;

  const body = document.body;
  const doc = document.documentElement;
  const top = snapshot.top;

  body.style.overflow = snapshot.bodyOverflow;
  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.width = snapshot.bodyWidth;
  body.style.paddingRight = snapshot.bodyPaddingRight;
  doc.style.overflow = snapshot.docOverflow;
  snapshot = null;

  // jsdom 没有实现 scrollTo，无布局环境下跳过即可。
  if (typeof window.scrollTo === 'function') {
    try {
      window.scrollTo(0, top);
    } catch {
      // 无布局环境（jsdom）会抛未实现错误；滚动位置本就不存在，忽略。
    }
  }
};

/** 当前是否处于锁定状态；仅供测试断言使用，生产代码不依赖它。 */
export const isModalScrollLocked = (): boolean => lockCount > 0;

/**
 * 按元素配对加锁 / 解锁。
 *
 * 同一个 dialog 可能被脚本关闭、被 Esc 关闭、或走无 `close()` 的降级分支，
 * 用 WeakSet 记住「这个元素是否已加锁」，重复调用不会漏减计数。
 */
const lockedElements = new WeakSet<Element>();

export const lockScrollFor = (element: Element): void => {
  if (lockedElements.has(element)) return;
  lockedElements.add(element);
  lockModalScroll();
};

export const unlockScrollFor = (element: Element): void => {
  if (!lockedElements.has(element)) return;
  lockedElements.delete(element);
  unlockModalScroll();
};
