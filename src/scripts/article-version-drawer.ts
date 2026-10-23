import { prefersReducedMotion } from './input-modality';
import { lockScrollFor, unlockScrollFor } from './modal-scroll-lock';

type VersionDrawerRoot = HTMLElement;

/** 退出动画 220ms，兜底留 20ms 余量：animationend 丢失时也不会把抽屉卡住。 */
const CLOSE_FALLBACK_MS = 600;

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
  const dialogTitle = dialog.querySelector<HTMLElement>('.version-drawer__title');
  const panel = dialog.querySelector<HTMLElement>('.version-drawer__panel');
  let closeTimer: number | undefined;
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

  // 指针按下时先打标记：按钮在 mousedown 获得焦点时不会闪出焦点环。
  trigger.addEventListener('pointerdown', () => {
    trigger.dataset.pointerFocus = 'true';
  });

  const clearCloseTimer = () => {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  };

  const clearClosingState = () => {
    clearCloseTimer();
    delete dialog.dataset.closing;
  };

  const restoreTriggerFocus = () => {
    if (!restoreFocus) return;
    if (restoreFocusWithoutRing) focusWithoutRing(trigger);
    else trigger.focus({ preventScroll: true });
  };

  const commitClose = () => {
    clearCloseTimer();
    if (typeof dialog.close === 'function') {
      // 先 close()，data-closing 由 close 事件统一清掉；避免先撤标记导致面板回弹一帧。
      dialog.close();
      return;
    }
    // jsdom / 旧浏览器没有 dialog.close()：先隐藏面板，再清标记并手动收尾。
    dialog.removeAttribute('open');
    delete dialog.dataset.closing;
    unlockScrollFor(dialog);
    setExpanded(false);
    restoreTriggerFocus();
  };

  const finishClose = () => {
    if (dialog.dataset.closing !== 'true') return;
    commitClose();
  };

  const open = (pointer: boolean) => {
    if (dialog.open) return;
    restoreFocus = true;
    restoreFocusWithoutRing = pointer;
    clearClosingState();
    // 焦点由标题接管，不再让 showModal() 的默认聚焦落到关闭按钮上。
    clearPointerFocus(closeButton);

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    // 抽屉打开期间锁住页面，避免在抽屉里滚动带动正文。
    lockScrollFor(dialog);
    setExpanded(true);
    // 打开时把焦点放到标题，不落在关闭按钮上；关闭按钮仍可 Tab 到。
    window.requestAnimationFrame(() => {
      dialogTitle?.focus({ preventScroll: true });
    });
  };

  const close = (restore = true, pointer = false) => {
    if (!dialog.open) return;
    if (dialog.dataset.closing === 'true') return;
    restoreFocus = restore;
    restoreFocusWithoutRing = pointer;

    // 减少动效时不做退出过渡，立即关闭。
    if (prefersReducedMotion()) {
      commitClose();
      return;
    }

    dialog.dataset.closing = 'true';
    closeTimer = window.setTimeout(finishClose, CLOSE_FALLBACK_MS);
  };

  // 面板退出动画结束即可关闭；窄屏用 version-drawer-out-bottom，前缀判断一并覆盖。
  panel?.addEventListener('animationend', (event) => {
    if (event.target !== panel) return;
    if (dialog.dataset.closing !== 'true') return;
    const animationName = (event as AnimationEvent).animationName;
    if (animationName && !animationName.startsWith('version-drawer-out')) return;
    finishClose();
  });

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
    clearClosingState();
    // 原生 Esc 关闭也走这里；WeakSet 保证与 commitClose 的解锁不会重复减计数。
    unlockScrollFor(dialog);
    setExpanded(false);
    if (!restoreFocus) return;
    restoreTriggerFocus();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(true, false);
  });
}

export {};
