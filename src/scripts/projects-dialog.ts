import { initCardDialogs } from './dialog-controller';

/**
 * `/projects/` 卡片点击后打开最新版弹窗；版本历史行切换对应版本的弹窗。
 * `<=640px` 时 CSS 把弹窗变成底部抽屉。
 * 关闭方式为关闭按钮、点遮罩与 Esc（原生 `<dialog>` 的 `cancel`）。
 */
initCardDialogs({
  cardSelector: '[data-project-card]',
  openSelector: '[data-project-open]',
  closeSelector: '[data-project-close]',
  panelSelector: '[data-project-dialog-panel]',
  dialogIdAttribute: 'data-project-dialog',
  focusSelector: '.project-dialog__title',
  scrollResetSelector: '.project-dialog__content',
  hashDialogIdPrefix: 'project-dialog-',
  /** 旧 `/projects/#<entryId>` 深链：弹窗上的别名属性。 */
  hashAliasAttribute: 'data-project-entry-id',
  /** 别名未命中时回到该分组的最新版弹窗。 */
  hashLatestAnchorAttribute: 'data-project-latest-anchor',
  exclusiveOpen: true,
  syncHash: true,
  /** 版本切换先淡出旧弹窗、再淡入目标版本；减少动效时自动降级为同步切换。 */
  animatePanels: true,
  panelMotionSelector: '.project-dialog__inner'
});
