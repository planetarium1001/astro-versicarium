type VersionDrawerRoot = HTMLElement;

const roots = Array.from(document.querySelectorAll<VersionDrawerRoot>('[data-article-version]'));

for (const root of roots) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-version-trigger]');
  const dialog = root.querySelector<HTMLDialogElement>('[data-version-drawer]');
  if (!trigger || !dialog) continue;

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
