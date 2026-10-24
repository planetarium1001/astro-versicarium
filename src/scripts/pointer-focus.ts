/**
 * 指针交互后恢复焦点时压掉焦点环。
 *
 * 关闭弹窗、灯箱时浏览器会把焦点还给打开它的触发器；这次聚焦由鼠标/触摸引起，
 * 不是键盘导航，但部分内核（Safari 的 :focus-visible 启发式、部分 Android 内核）
 * 仍会画出焦点环，表现为「关掉弹窗后图片外面留一圈框」。
 *
 * 做法：聚焦前打 data-pointer-focus 标记，CSS 据此不画环；下一次按键或失焦时撤掉标记，
 * 键盘用户后续 Tab 进来仍能看到主题焦点环。
 */

const POINTER_FOCUS_ATTRIBUTE = 'data-pointer-focus';

const clearOnKeyboardOrBlur = (element: HTMLElement): void => {
  const clear = () => {
    delete element.dataset.pointerFocus;
    element.removeEventListener('keydown', clear);
    element.removeEventListener('blur', clear);
  };
  element.addEventListener('keydown', clear);
  element.addEventListener('blur', clear);
};

export const markPointerFocus = (element: Element | null): void => {
  if (!(element instanceof HTMLElement)) return;
  element.setAttribute(POINTER_FOCUS_ATTRIBUTE, 'true');
  clearOnKeyboardOrBlur(element);
};

/** 指针交互后把焦点还给目标，并保证这次聚焦不画焦点环。 */
export const focusWithoutRing = (element: HTMLElement | null): void => {
  if (!element) return;
  markPointerFocus(element);
  element.focus({ preventScroll: true });
};

/** 最近一次输入是否来自指针（鼠标 / 触摸），供「关闭后还原焦点」判断要不要画环。 */
export const isPointerInput = (): boolean => {
  if (typeof document === 'undefined') return false;
  const input = document.documentElement.dataset.input;
  return input === 'mouse' || input === 'touch';
};
