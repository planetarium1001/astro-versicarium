import { initCardDialogs } from './dialog-controller';

/** `/bits/` 卡片整卡可点打开详情弹窗；图片与标签链接的点击不会落到覆盖层。 */
initCardDialogs({
  cardSelector: '[data-bit]',
  openSelector: '[data-bit-dialog-open]',
  closeSelector: '[data-bit-dialog-close]',
  panelSelector: '[data-bit-dialog-panel]',
  dialogIdAttribute: 'data-bit-dialog',
  focusSelector: '.bit-dialog__identity',
  scrollResetSelector: '.bit-dialog__content',
  /** 与 `/projects/` 弹窗一致：内容淡入淡出，关闭时弹窗本体与遮罩同步淡出。 */
  animatePanels: true,
  panelMotionSelector: '.bit-dialog__inner'
});
