import { lockScrollFor, unlockScrollFor } from '../modal-scroll-lock';

/**
 * 把元素的打开状态与页面滚动锁配对。
 *
 * 覆盖层关闭路径分散（按钮、Esc、遮罩、脚本），逐处调用解锁容易漏减计数；
 * 统一在 effect 的 cleanup 里解锁，元素销毁时也一定执行。
 */
export const bindModalScrollLock = (element: Element | null | undefined): (() => void) => {
  if (!element) return () => {};
  lockScrollFor(element);
  return () => {
    unlockScrollFor(element);
  };
};
