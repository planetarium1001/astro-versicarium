/**
 * 列表整块换页过渡：先淡出并轻微上移，落 DOM 状态后再淡入。
 *
 * 只管理本模块创建的动画，不碰元素上的 CSS 页面进入动画。重复触发时取消上一轮；
 * 被取消的那一轮不落状态，由最新一轮负责，因此快速连点也不会停在中间态。
 */

import { canAnimate } from './visibility-fade';

const DEFAULT_OUT_MS = 110;
const DEFAULT_IN_MS = 180;
const OUT_EASING = 'ease-in';
const IN_EASING = 'cubic-bezier(.16,1,.3,1)';

type SwapState = {
  active: boolean;
  animations: Animation[];
};

const states = new WeakMap<HTMLElement, SwapState>();

/** 与可见性淡入淡出共用同一套动效环境判断。 */
export { canAnimate };

/** 取消该元素上尚未结束的换页动画（调用方负责落状态，如直接渲染）。 */
export const cancelListSwap = (element: HTMLElement): void => {
  const state = states.get(element);
  if (!state) return;
  state.active = false;
  states.delete(element);
  for (const animation of state.animations) animation.cancel();
};

/**
 * 在 `element` 上播放「淡出 → apply() → 淡入」。不可动画或减少动效时同步 apply。
 * `apply()` 只调用一次：被更新的一轮接管时旧回调直接作废。
 */
export const animateListSwap = (
  element: HTMLElement,
  apply: () => void,
  options: { outMs?: number; inMs?: number } = {}
): void => {
  if (!canAnimate(element)) {
    apply();
    return;
  }

  cancelListSwap(element);
  const state: SwapState = { active: true, animations: [] };
  states.set(element, state);

  const out = element.animate(
    [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-4px)' }],
    { duration: options.outMs ?? DEFAULT_OUT_MS, easing: OUT_EASING, fill: 'forwards' }
  );
  state.animations.push(out);

  out.finished.then(
    () => {
      if (!state.active) return;
      // 先撤掉淡出的 forwards 效果，否则它会一直压住淡入结束后的透明度。
      out.cancel();
      apply();
      if (!state.active) return;
      const enter = element.animate(
        [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: options.inMs ?? DEFAULT_IN_MS, easing: IN_EASING }
      );
      state.animations.push(enter);
      enter.finished.then(
        () => {
          if (states.get(element) === state) states.delete(element);
        },
        () => {}
      );
    },
    () => {
      // 外部取消动画时仍要落状态；被更新的一轮接管时由那一轮落。
      if (!state.active) return;
      state.active = false;
      if (states.get(element) === state) states.delete(element);
      apply();
    }
  );
};
