/**
 * 触摸点按兜底：部分内核（真机为华为 HarmonyOS / ArkWeb）在浮动列按钮上会吞掉 click，
 * 但 pointerdown / pointerup 仍会正常到达页面。这里把「按下 → 抬起」识别成一次点按，
 * 直接调用原本 click 的 activate 回调；原生 click 仍保留给鼠标、键盘与未吞 click 的内核。
 *
 * 约束：
 * - 只记录 touch / pen；鼠标与键盘完全走原生 click。
 * - 位移 ≤ 8px、时长 ≤ 650ms、抬起点仍在元素内才算点按；pointercancel / 超时 / 位移过大放弃。
 * - pointer 路径触发后，同一元素 500ms 内的点击类 click 视为同一次操作，不再触发。
 * - 不调用 preventDefault，不改变滚动与系统手势的默认行为。
 */

/** 点按允许的最大位移（CSS px）。 */
export const TOUCH_ACTIVATE_MAX_DISTANCE_PX = 8;
/** 点按允许的最长按压时长（毫秒）。 */
export const TOUCH_ACTIVATE_MAX_DURATION_MS = 650;
/** pointer 路径触发后，屏蔽同一元素 click 的时长（毫秒）。 */
export const TOUCH_ACTIVATE_CLICK_DEDUPE_MS = 500;

export type TouchActivateOptions = {
  /** 激活前调用；返回 true 表示当前不可用（如 aria-disabled="true"）。 */
  disabled?: () => boolean;
  maxDistancePx?: number;
  maxDurationMs?: number;
  clickDedupeMs?: number;
};

type PendingPress = {
  pointerId: number | undefined;
  startX: number;
  startY: number;
  startedAt: number;
  timer: number;
};

const isTouchLikePointer = (event: PointerEvent) =>
  event.pointerType === 'touch' || event.pointerType === 'pen';

const movedDistance = (event: PointerEvent, press: PendingPress) =>
  Math.hypot(event.clientX - press.startX, event.clientY - press.startY);

const isSamePointer = (event: PointerEvent, press: PendingPress) =>
  press.pointerId === undefined
  || event.pointerId === undefined
  || event.pointerId === press.pointerId;

/** 抬起点是否仍落在元素上（含 ::before 这类属于元素的覆盖层）。 */
const isReleaseInside = (element: HTMLElement, event: PointerEvent) => {
  const target = event.target;
  if (target instanceof Node && (target === element || element.contains(target))) return true;
  if (typeof document.elementFromPoint !== 'function') return false;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  return hit !== null && (hit === element || element.contains(hit));
};

/**
 * 给元素绑定「触摸兜底 + 原生 click」的复合激活路径。
 * 返回解绑函数，便于测试或组件销毁时清理。
 */
export const bindTouchActivate = (
  element: HTMLElement,
  activate: (event: Event) => void,
  options: TouchActivateOptions = {}
) => {
  const maxDistance = options.maxDistancePx ?? TOUCH_ACTIVATE_MAX_DISTANCE_PX;
  const maxDuration = options.maxDurationMs ?? TOUCH_ACTIVATE_MAX_DURATION_MS;
  const clickDedupe = options.clickDedupeMs ?? TOUCH_ACTIVATE_CLICK_DEDUPE_MS;
  const disabled = options.disabled;

  let press: PendingPress | null = null;
  let activatedAt = Number.NEGATIVE_INFINITY;

  const cancelPress = () => {
    if (press !== null) window.clearTimeout(press.timer);
    press = null;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!isTouchLikePointer(event) || event.button !== 0 || press !== null) return;
    press = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      // 超过时长还不抬起就放弃：长按（含系统长按菜单）不该被当成点按。
      timer: window.setTimeout(cancelPress, maxDuration + 50)
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (press === null || !isSamePointer(event, press)) return;
    if (movedDistance(event, press) > maxDistance) cancelPress();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (press === null || !isSamePointer(event, press)) return;
    const pressSnapshot = press;
    cancelPress();
    const held = performance.now() - pressSnapshot.startedAt;
    const moved = movedDistance(event, pressSnapshot);
    if (held > maxDuration || moved > maxDistance) return;
    if (!isReleaseInside(element, event)) return;
    if (disabled?.()) return;
    activatedAt = performance.now();
    activate(event);
  };

  const onPointerCancel = () => cancelPress();

  const onClick = (event: Event) => {
    // 键盘 / 脚本触发的 click 不带指针动作（detail 为 0），必须放行。
    const isKeyboardClick = event instanceof MouseEvent && event.detail === 0;
    // 鼠标 click 不做 pointer 去重：触屏与鼠标是两次独立操作。
    const pointerType = (event as PointerEvent).pointerType;
    const isMouseClick = pointerType === 'mouse';
    if (!isKeyboardClick && !isMouseClick && performance.now() - activatedAt <= clickDedupe) return;
    if (disabled?.()) return;
    activate(event);
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  element.addEventListener('click', onClick);

  return () => {
    cancelPress();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
    element.removeEventListener('click', onClick);
  };
};
