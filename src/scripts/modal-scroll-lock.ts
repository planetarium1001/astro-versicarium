/**
 * 模态层打开时锁住页面滚动。
 *
 * `<dialog>.showModal()` 只让背景不可交互，并不阻止滚动穿透：
 * - 在遮罩上滚动时，滚动落到后面的页面上；
 * - 弹窗内容没有可滚动空间时，滚轮事件冒泡到页面，同样带动整页。
 *
 * 分两条路径：
 * - 细指针（鼠标 / 触控板，且最近一次输入不是触摸）：只锁 documentElement 的
 *   overflow，滚动位置原地保留。body 仍是静态盒，页面里的 `position: sticky`
 *   元素（侧栏、目录、标签头部）继续以根滚动容器为参照，不会落到 -scrollY。
 *   若滚动条槽因此被撤销、布局变宽，再用 `<html>` 内联 `--page-inline` 把槽宽补回去，
 *   内容右缘不位移；`scrollbar-gutter: stable` 已预留槽位时布局不变，也就不补偿。
 * - 粗指针（触屏，尤其 iOS）：根元素 overflow: hidden 在移动内核上不可靠，沿用
 *   body fixed + 记住 scrollY 的旧方案，关闭时还原。
 *
 * 支持嵌套：同一时刻可能有多个模态层（例如弹窗里再开灯箱），按引用计数加锁，
 * 最后一个关闭时才解锁。
 */

type LockMode = 'html' | 'body';

type ScrollSnapshot = {
  mode: LockMode;
  top: number;
  docOverflow: string;
  docPageInline: string;
  docPageInlinePriority: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
};

let lockCount = 0;
let snapshot: ScrollSnapshot | null = null;

const canUseDom = (): boolean =>
  typeof document !== 'undefined' && document.body !== null && document.documentElement !== null;

/**
 * 是否走「只锁 html」的细指针路径。
 *
 * 触屏设备的指针常被上报成 fine，`(pointer: fine)` 单独用不够：input-modality 记录的
 * `data-input="touch"` 优先。无 matchMedia 的环境（jsdom、旧内核）按粗指针处理，
 * 保持 body fixed 的保守行为。
 */
const isFinePointer = (): boolean => {
  if (typeof window.matchMedia !== 'function') return false;
  if (document.documentElement.dataset.input === 'touch') return false;
  return window.matchMedia('(pointer: fine)').matches;
};

/**
 * 布局宽度（初始包含块宽度）的实际值。
 *
 * 不能用 `innerWidth - documentElement.clientWidth` 当滚动条槽宽：`scrollbar-gutter: stable`
 * 下这个差值恒为滚动条宽度，但 overflow: hidden 并不撤销预留的槽位——clientWidth 会变大，
 * 布局却一像素都没动。按差值补偿会把内容整体左推一个槽宽。这里直接量布局宽度，
 * 只有它真的变宽（槽位被撤销、内容会右移）才需要补偿。
 *
 * 无布局环境（jsdom、样式替身）量不到宽度，退化为 clientWidth，两次数值相同即不补偿。
 */
const measureLayoutWidth = (): number => {
  const rect = document.body.getBoundingClientRect?.();
  const width = rect?.width ?? 0;
  return width > 0 ? width : document.documentElement.clientWidth;
};

/** 读内联自定义属性；无该 API 的样式替身（测试环境）按未设置处理。 */
const readInlineProperty = (style: CSSStyleDeclaration, property: string): string =>
  typeof style.getPropertyValue === 'function' ? style.getPropertyValue(property) : '';

/** 读内联自定义属性的优先级（`!important`）；无该 API 时按普通声明处理。 */
const readInlinePriority = (style: CSSStyleDeclaration, property: string): string =>
  typeof style.getPropertyPriority === 'function' ? style.getPropertyPriority(property) : '';

const writeInlineProperty = (
  style: CSSStyleDeclaration,
  property: string,
  value: string,
  priority = ''
): void => {
  if (typeof style.setProperty === 'function') style.setProperty(property, value, priority);
};

const removeInlineProperty = (style: CSSStyleDeclaration, property: string): void => {
  if (typeof style.removeProperty === 'function') style.removeProperty(property);
};

const scrollToTop = (top: number): void => {
  // jsdom 没有实现 scrollTo，无布局环境下跳过即可。
  if (typeof window.scrollTo !== 'function') return;
  try {
    window.scrollTo(0, top);
  } catch {
    // 无布局环境（jsdom）会抛未实现错误；滚动位置本就不存在，忽略。
  }
};

/** 记录当前滚动位置并固定页面。 */
export const lockModalScroll = (): void => {
  if (!canUseDom()) return;
  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  const doc = document.documentElement;
  const top = window.scrollY || doc.scrollTop || 0;
  const mode: LockMode = isFinePointer() ? 'html' : 'body';
  const clientWidthBeforeLock = doc.clientWidth;
  const layoutWidthBeforeLock = mode === 'html' ? measureLayoutWidth() : 0;

  snapshot = {
    mode,
    top,
    docOverflow: doc.style.overflow,
    docPageInline: readInlineProperty(doc.style, '--page-inline'),
    docPageInlinePriority: readInlinePriority(doc.style, '--page-inline'),
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight
  };

  doc.style.overflow = 'hidden';

  if (mode === 'html') {
    // 只有布局真的变宽（滚动条槽被撤销）才补偿：把结束内边距加回槽宽，内容盒右缘
    // 因此与加锁前重合。槽位被 scrollbar-gutter 预留时宽度不变，补偿反而会推歪内容。
    const widenedBy = Math.round(measureLayoutWidth() - layoutWidthBeforeLock);
    if (widenedBy > 0) {
      const baseInline = snapshot.docPageInline.trim();
      writeInlineProperty(
        doc.style,
        '--page-inline',
        baseInline ? `calc(${baseInline} + ${widenedBy}px)` : 'var(--page-gap-inline)'
      );
    }
    return;
  }

  // 粗指针：body 变 fixed 后，只有内容盒真的变宽才补右内边距。
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${top}px`;
  body.style.width = '100%';

  // 只有锁定后真的变宽才补 padding：scrollbar-gutter 保留槽位时差值为 0，
  // 部分引擎在 overflow: hidden 下撤销槽位，差值即滚动条宽度。
  const scrollbarWidth = Math.round(doc.clientWidth - clientWidthBeforeLock);
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
  const { mode, top } = snapshot;

  doc.style.overflow = snapshot.docOverflow;
  // 原内联值可能为空（页面没有输出过该变量），此时必须移除而不是写空串。
  if (snapshot.docPageInline === '') {
    removeInlineProperty(doc.style, '--page-inline');
  } else {
    writeInlineProperty(doc.style, '--page-inline', snapshot.docPageInline, snapshot.docPageInlinePriority);
  }

  if (mode === 'body') {
    body.style.overflow = snapshot.bodyOverflow;
    body.style.position = snapshot.bodyPosition;
    body.style.top = snapshot.bodyTop;
    body.style.width = snapshot.bodyWidth;
    body.style.paddingRight = snapshot.bodyPaddingRight;
  }

  snapshot = null;

  // 细指针路径没有移动滚动位置，正常无需还原；若焦点等原因仍把页面滚开，补回原位。
  if (mode === 'body' || (window.scrollY || 0) !== top) {
    scrollToTop(top);
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
