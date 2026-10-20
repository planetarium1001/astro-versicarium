/**
 * 输入模态标记：媒体查询区分不了「真鼠标」与「把指针上报成 fine 的触屏」——
 * 后者 (hover) / (pointer) 与桌面完全一致，悬停样式会在点按后一直粘住。
 * 这里记录最近一次真实输入事件到 <html data-input>，供样式关掉触屏上的悬停效果。
 * 混合设备随输入来回切换，不做一次性降级。
 *
 * 触屏 tap 之后浏览器会补发一串兼容鼠标事件（mousemove / mousedown / click），
 * WebKit 连 pointermove 都报 pointerType: 'mouse'，因此「收到鼠标事件」不能直接
 * 当成鼠标输入：touchstart 之后的一小段时间内的鼠标事件一律忽略。
 * 真实鼠标移动通常发生在点按之后很久，不会被误吞。
 */

const root = document.documentElement;

/** 触屏 tap 的兼容鼠标事件窗口：覆盖 WebKit 的整串补发事件。 */
const TOUCH_SETTLE_MS = 800;

let lastTouchAt = Number.NEGATIVE_INFINITY;

const setInput = (modality: 'touch' | 'mouse') => {
  if (root.dataset.input === modality) return;
  root.dataset.input = modality;
};

const markTouch = () => {
  lastTouchAt = performance.now();
  // 触摸输入后，之前由键盘产生的焦点标记不再成立。
  delete root.dataset.keyboard;
  setInput('touch');
};

const markMouse = () => {
  if (performance.now() - lastTouchAt < TOUCH_SETTLE_MS) return;
  delete root.dataset.keyboard;
  setInput('mouse');
};

const initInputModality = () => {
  window.addEventListener('touchstart', markTouch, { capture: true, passive: true });

  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'touch') markTouch();
      else if (event.pointerType === 'mouse') markMouse();
    },
    { capture: true, passive: true }
  );

  // 鼠标移动即视为鼠标输入：混合设备上不必等点按就能恢复悬停反馈。
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'mouse') markMouse();
    },
    { capture: true, passive: true }
  );

  // 只上报 mousemove 的环境（老内核）同样要能恢复。
  window.addEventListener('mousemove', markMouse, { capture: true, passive: true });

  /*
   * 混合设备上按 Tab 属于键盘输入：单独打一个 keyboard 标记让设计焦点环恢复，
   * 但不动 data-input——否则会同时解开触屏的 hover 门禁，让点按粘住的悬停视觉重新出现。
   * 下一次真实指针输入（触摸或鼠标）会清掉这个标记。
   */
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') root.dataset.keyboard = 'true';
    },
    { capture: true }
  );
};

initInputModality();

export {};
