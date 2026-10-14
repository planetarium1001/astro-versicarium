/**
 * `/projects/` 卡片点击后打开弹窗。
 *
 * - 卡片主体可点开弹窗；卡片右下角链接是独立 `<a>`，不触发弹窗。
 * - `<=640px` 时 CSS 把弹窗变成底部抽屉（贴底、顶部圆角、把手、内部滚动、滚动链隔离）。
 * - 三种关闭方式：关闭按钮、点遮罩、Esc（Esc 由原生 `<dialog>` 的 `cancel` 提供）。
 * - `#<entryId>` 锚点进入时自动展开对应弹窗，归档标题跳转依赖它。
 */
const CARDS = Array.from(document.querySelectorAll<HTMLElement>('[data-project-card]'));

if (CARDS.length > 0) {
  const OPEN_SELECTOR = '[data-project-open]';
  const CLOSE_SELECTOR = '[data-project-close]';
  const PANEL_SELECTOR = '[data-project-dialog-panel]';

  const getDialogFor = (id: string): HTMLDialogElement | null =>
    document.querySelector<HTMLDialogElement>(`#project-dialog-${CSS.escape(id)}`);

  const openDialog = (dialog: HTMLDialogElement) => {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      const title = dialog.querySelector<HTMLElement>('.project-dialog__title');
      window.requestAnimationFrame(() => title?.focus({ preventScroll: true }));
      return;
    }
    dialog.setAttribute('open', '');
  };

  const closeDialog = (dialog: HTMLDialogElement) => {
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
      return;
    }
    dialog.removeAttribute('open');
  };

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const openTrigger = target.closest<HTMLElement>(OPEN_SELECTOR);
    if (openTrigger) {
      event.preventDefault();
      const dialogId = (openTrigger.dataset.projectDialog || '').replace(/^project-dialog-/, '');
      const dialog = dialogId ? getDialogFor(dialogId) : null;
      if (dialog) openDialog(dialog);
      return;
    }

    const closeTrigger = target.closest<HTMLElement>(CLOSE_SELECTOR);
    if (closeTrigger) {
      const dialog = closeTrigger.closest<HTMLDialogElement>(PANEL_SELECTOR);
      if (dialog) closeDialog(dialog);
      return;
    }

    // 点遮罩关闭：`<dialog>` 自身即为遮罩区域。
    if (target instanceof HTMLDialogElement && target.matches(PANEL_SELECTOR)) {
      closeDialog(target);
    }
  });

  document.querySelectorAll<HTMLDialogElement>(PANEL_SELECTOR).forEach((dialog) => {
    dialog.addEventListener('cancel', () => closeDialog(dialog));
    dialog.addEventListener('close', () => {
      dialog.scrollTop = 0;
      const content = dialog.querySelector<HTMLElement>('.project-dialog__content');
      if (content) content.scrollTop = 0;
    });
  });

  /** `/projects/#<entryId>` 自动展开对应弹窗。 */
  const openFromHash = () => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
    if (!id) return;
    const dialog = getDialogFor(id);
    if (dialog) openDialog(dialog);
  };

  openFromHash();
  window.addEventListener('hashchange', openFromHash);
}
