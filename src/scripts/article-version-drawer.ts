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

/**
 * 鼠标/触屏交互触发的 focus() 带上标记，CSS 据此不画焦点环；
 * 键盘 Tab 进入或按任意键时撤掉标记，键盘用户仍能看见主题焦点环。
 */
const focusWithoutRing = (element: HTMLElement | null): void => {
  if (!element) return;
  element.dataset.pointerFocus = 'true';
  element.focus({ preventScroll: true });
};

const clearPointerFocus = (element: HTMLElement | null): void => {
  if (!element) return;
  delete element.dataset.pointerFocus;
};

const roots = Array.from(document.querySelectorAll<VersionDrawerRoot>('[data-article-version]'));

for (const root of roots) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-version-trigger]');
  if (!trigger) continue;
  const dialog = resolveDialog(root, trigger);
  if (!dialog) continue;

  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-version-close]');
  let restoreFocus = true;
  let restoreFocusWithoutRing = false;

  const setExpanded = (expanded: boolean) => {
    trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    trigger.dataset.versionOpen = expanded ? 'true' : 'false';
  };

  const isPointerEvent = (event: Event): boolean =>
    event instanceof MouseEvent && event.detail > 0;

  // 标记只影响本次鼠标聚焦；失焦或按键后立即恢复主题焦点环。
  for (const element of [trigger, closeButton]) {
    if (!element) continue;
    element.addEventListener('blur', () => clearPointerFocus(element));
    element.addEventListener('keydown', () => clearPointerFocus(element));
  }

  const open = (pointer: boolean) => {
    if (dialog.open) return;
    restoreFocus = true;
    restoreFocusWithoutRing = pointer;
    // showModal() 自己会把焦点放到第一个可聚焦元素（这里是关闭按钮）；
    // 指针打开时先打上标记，自动聚焦也不会出现白/蓝默认焦点框。
    if (pointer) closeButton?.setAttribute('data-pointer-focus', 'true');
    else clearPointerFocus(closeButton);

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    setExpanded(true);
    window.requestAnimationFrame(() => {
      if (!closeButton) return;
      if (pointer) focusWithoutRing(closeButton);
      else closeButton.focus({ preventScroll: true });
    });
  };

  const close = (restore = true, pointer = false) => {
    if (!dialog.open) return;
    restoreFocus = restore;
    restoreFocusWithoutRing = pointer;
    if (typeof dialog.close === 'function') {
      dialog.close();
      return;
    }
    dialog.removeAttribute('open');
    setExpanded(false);
    if (restoreFocus) {
      if (restoreFocusWithoutRing) focusWithoutRing(trigger);
      else trigger.focus({ preventScroll: true });
    }
  };

  trigger.addEventListener('click', (event) => {
    const pointer = isPointerEvent(event);
    if (dialog.open) close(true, pointer);
    else open(pointer);
  });

  closeButton?.addEventListener('click', (event) => {
    close(true, isPointerEvent(event));
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close(true, false);
  });

  dialog.addEventListener('close', () => {
    setExpanded(false);
    if (!restoreFocus) return;
    if (restoreFocusWithoutRing) focusWithoutRing(trigger);
    else trigger.focus({ preventScroll: true });
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(true, false);
  });
}

export {};
