type VersionDrawerRoot = HTMLElement;

/**
 * 先按组件结构在 root 内找 drawer；结构变化时再按 trigger 的 aria-controls 回退到 document。
 * 两段都用同一份 trigger→dialog 约定，避免模板挪动位置后交互静默失效。
 */
const resolveDialog = (
  root: VersionDrawerRoot,
  trigger: HTMLButtonElement
): HTMLDialogElement | null => {
  const scoped = root.querySelector<HTMLDialogElement>('[data-version-drawer]');
  if (scoped) return scoped;

  const controlledId = trigger.getAttribute('aria-controls')?.trim();
  if (!controlledId) return null;

  const controlled = document.getElementById(controlledId);
  if (!controlled || controlled.tagName !== 'DIALOG') return null;
  return controlled as HTMLDialogElement;
};

const roots = Array.from(document.querySelectorAll<VersionDrawerRoot>('[data-article-version]'));

for (const root of roots) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-version-trigger]');
  if (!trigger) continue;
  const dialog = resolveDialog(root, trigger);
  if (!dialog) continue;

  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-version-close]');
  let restoreFocus = true;

  const setExpanded = (expanded: boolean) => {
    trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    trigger.dataset.versionOpen = expanded ? 'true' : 'false';
  };

  const open = () => {
    if (dialog.open) return;
    restoreFocus = true;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    setExpanded(true);
    window.requestAnimationFrame(() => closeButton?.focus({ preventScroll: true }));
  };

  const close = (restore = true) => {
    if (!dialog.open) return;
    restoreFocus = restore;
    if (typeof dialog.close === 'function') {
      dialog.close();
      return;
    }
    dialog.removeAttribute('open');
    setExpanded(false);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener('click', () => {
    if (dialog.open) close();
    else open();
  });

  closeButton?.addEventListener('click', () => close());

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  dialog.addEventListener('close', () => {
    setExpanded(false);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
}

export {};
