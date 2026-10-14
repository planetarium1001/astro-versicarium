import { initCardDialogs } from './dialog-controller';

/** `/bits/` 卡片整卡可点打开详情弹窗；图片与标签链接的点击不会落到覆盖层。 */
initCardDialogs({
  cardSelector: '[data-bit]',
  openSelector: '[data-bit-dialog-open]',
  closeSelector: '[data-bit-dialog-close]',
  panelSelector: '[data-bit-dialog-panel]',
  dialogIdAttribute: 'data-bit-dialog',
  focusSelector: '.bit-dialog__title, .bit-dialog__identity',
  scrollResetSelector: '.bit-dialog__content'
});
