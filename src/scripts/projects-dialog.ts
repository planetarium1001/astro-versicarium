import { initCardDialogs } from './dialog-controller';

/**
 * `/projects/` 卡片点击后打开弹窗。
 *
 * - 卡片主体可点开弹窗；卡片右下角链接是独立 `<a>`，不触发弹窗。
 * - `<=640px` 时 CSS 把弹窗变成底部抽屉（贴底、顶部圆角、把手、内部滚动、滚动链隔离）。
 * - 三种关闭方式：关闭按钮、点遮罩、Esc（Esc 由原生 `<dialog>` 的 `cancel` 提供）。
 * - `#<entryId>` 锚点进入时自动展开对应弹窗，归档标题跳转依赖它。
 */
initCardDialogs({
  cardSelector: '[data-project-card]',
  openSelector: '[data-project-open]',
  closeSelector: '[data-project-close]',
  panelSelector: '[data-project-dialog-panel]',
  dialogIdAttribute: 'data-project-dialog',
  focusSelector: '.project-dialog__title',
  scrollResetSelector: '.project-dialog__content',
  hashDialogIdPrefix: 'project-dialog-'
});
