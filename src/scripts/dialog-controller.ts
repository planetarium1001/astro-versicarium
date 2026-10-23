import { prefersReducedMotion } from './input-modality';
import { lockScrollFor, unlockScrollFor } from './modal-scroll-lock';

/**
 * 卡片弹窗的通用交互：点卡片主体打开 `<dialog>`，关闭按钮 / Esc / 点遮罩关闭，打开后焦点进入弹窗。
 * `/projects/` 与 `/bits/` 共用，差异只有标记前缀、是否支持 `#<id>` 锚点自动展开，
 * 以及项目页额外的「同一时间只开一个」「打开/关闭同步 hash」「版本切换淡入淡出」。
 */
type CardDialogWiring = {
  /** 卡片选择器，仅用于判断当前页面是否存在此类卡片 */
  cardSelector: string;
  /** 打开触发器选择器 */
  openSelector: string;
  /** 关闭按钮选择器 */
  closeSelector: string;
  /** 弹窗面板选择器 */
  panelSelector: string;
  /** 打开触发器上保存弹窗完整 id 的属性名 */
  dialogIdAttribute: string;
  /** 打开后聚焦的元素选择器，在弹窗内查找 */
  focusSelector: string;
  /** 关闭时归零滚动位置的元素选择器，在弹窗内查找 */
  scrollResetSelector: string;
  /** `#<entryId>` 锚点自动展开弹窗时的弹窗 id 前缀；不传则不做锚点展开 */
  hashDialogIdPrefix?: string;
  /** hash 直接命中弹窗 id 失败时，按该属性值匹配（值等于解码后的 hash） */
  hashAliasAttribute?: string;
  /** hash 别名也未命中时，按该属性匹配（值等于分组最新版锚点） */
  hashLatestAnchorAttribute?: string;
  /** 打开新弹窗前关闭其它已打开的同一类弹窗 */
  exclusiveOpen?: boolean;
  /** 打开时把弹窗锚点写回 URL hash，关闭时清理 */
  syncHash?: boolean;
  /** 开合时给面板内容做淡入淡出，退出时弹窗本体一起淡出；减少动效或缺少 WAAPI 时自动降级 */
  animatePanels?: boolean;
  /** 参与淡入淡出的面板内容选择器；默认是弹窗自身 */
  panelMotionSelector?: string;
};

const PANEL_ENTER_MS = 500;
const PANEL_LEAVE_MS = 500;
/** 动画结束事件的兜底：后台标签页或浏览器丢弃动画时也一定能落状态。 */
const PANEL_MOTION_FALLBACK_MS = 680;

export const initCardDialogs = (wiring: CardDialogWiring) => {
  if (!document.querySelector(wiring.cardSelector)) return;

  const getDialog = (id: string) => document.getElementById(id) as HTMLDialogElement | null;

  const getDialogAnchor = (dialog: HTMLDialogElement): string => {
    const prefix = wiring.hashDialogIdPrefix;
    if (!prefix || !dialog.id.startsWith(prefix)) return '';
    return dialog.id.slice(prefix.length);
  };

  const readHashAnchor = (): string => {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return '';
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw.trim();
    }
  };

  const writeHashAnchor = (anchor: string) => {
    if (!wiring.syncHash || !anchor) return;
    if (readHashAnchor() === anchor) return;
    window.history.replaceState(null, '', `#${anchor}`);
  };

  const clearHashAnchor = (anchor: string) => {
    if (!wiring.syncHash || !anchor) return;
    if (readHashAnchor() !== anchor) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  /** jsdom 与旧浏览器没有 WAAPI；此时保持同步开合，测试与无动画环境行为不变。 */
  const canAnimatePanel = (): boolean =>
    wiring.animatePanels === true
    && !prefersReducedMotion()
    && typeof Element !== 'undefined'
    && typeof Element.prototype.animate === 'function';

  const getMotionTarget = (dialog: HTMLDialogElement): HTMLElement => {
    const selector = wiring.panelMotionSelector;
    if (!selector) return dialog;
    return dialog.querySelector<HTMLElement>(selector) ?? dialog;
  };

  /** 每次开合递增；只有最新一轮允许落地，避免快速连点叠出多个弹窗。 */
  let motionRunId = 0;
  const pendingOutgoing = new Set<HTMLDialogElement>();

  const playMotion = (element: Element, frames: Keyframe[], duration: number): Animation =>
    element.animate(frames, {
      duration,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'both'
    });

  /**
   * 进入只动内容，弹窗本体与遮罩交给 CSS 的 `::backdrop` 过渡 / `@starting-style`。
   * 退出时弹窗本体（背景、边框）必须和内容一起淡出，否则内容淡出后半秒内会留下
   * 一个不透明的空壳；内容同时向上位移，退出观感与进入对称。
   */
  const animatePanel = async (dialog: HTMLDialogElement, direction: 'enter' | 'leave'): Promise<void> => {
    const target = getMotionTarget(dialog);
    const animations = direction === 'enter'
      ? [playMotion(target, [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], PANEL_ENTER_MS)]
      : [
          playMotion(dialog, [{ opacity: 1 }, { opacity: 0 }], PANEL_LEAVE_MS),
          playMotion(target, [
            { transform: 'translateY(0)' },
            { transform: 'translateY(-4px)' }
          ], PANEL_LEAVE_MS)
        ];
    await Promise.race([
      Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))),
      new Promise<void>((resolve) => window.setTimeout(resolve, PANEL_MOTION_FALLBACK_MS))
    ]);
    for (const animation of animations) animation.cancel();
  };

  const showDialog = (dialog: HTMLDialogElement) => {
    if (dialog.open) return;
    delete dialog.dataset.closing;
    // showModal() 会先把焦点放到关闭按钮；指针打开时压掉这一帧的焦点环。
    const closeTarget = dialog.querySelector<HTMLElement>(wiring.closeSelector);
    closeTarget?.setAttribute('data-pointer-focus', 'true');
    dialog.addEventListener(
      'keydown',
      () => closeTarget?.removeAttribute('data-pointer-focus'),
      { once: true }
    );
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    // 弹窗打开期间锁住页面：遮罩上滚动、内容不足一屏时都不会带动后面的页面。
    lockScrollFor(dialog);
  };

  const closeImmediately = (dialog: HTMLDialogElement) => {
    pendingOutgoing.delete(dialog);
    delete dialog.dataset.closing;
    if (!dialog.open) return;
    const anchor = getDialogAnchor(dialog);
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    unlockScrollFor(dialog);
    clearHashAnchor(anchor);
  };

  const focusDialog = (dialog: HTMLDialogElement) => {
    const focusTarget = dialog.querySelector<HTMLElement>(wiring.focusSelector);
    const closeTarget = dialog.querySelector<HTMLElement>(wiring.closeSelector);
    window.requestAnimationFrame(() => {
      focusTarget?.focus({ preventScroll: true });
      closeTarget?.removeAttribute('data-pointer-focus');
    });
  };

  const openDialog = (dialog: HTMLDialogElement, options: { syncHash?: boolean } = {}) => {
    if (dialog.open) {
      // 退出动画期间再次打开同一弹窗：取消关闭标记与遗留动画，避免动画结束后被关掉。
      delete dialog.dataset.closing;
      dialog.getAnimations?.({ subtree: true }).forEach((animation) => animation.cancel());
      motionRunId += 1;
      if (options.syncHash !== false) writeHashAnchor(getDialogAnchor(dialog));
      focusDialog(dialog);
      return;
    }

    const outgoing = wiring.exclusiveOpen
      ? Array.from(document.querySelectorAll<HTMLDialogElement>(wiring.panelSelector))
          .filter((panel) => panel !== dialog && panel.open && !pendingOutgoing.has(panel))
      : [];
    const runId = ++motionRunId;
    const shouldAnimate = canAnimatePanel();

    const reveal = () => {
      if (runId !== motionRunId) return;
      showDialog(dialog);
      if (options.syncHash !== false) writeHashAnchor(getDialogAnchor(dialog));
      if (shouldAnimate) void animatePanel(dialog, 'enter');
      focusDialog(dialog);
    };

    if (outgoing.length === 0) {
      if (wiring.exclusiveOpen) {
        document.querySelectorAll<HTMLDialogElement>(wiring.panelSelector).forEach((panel) => {
          if (panel !== dialog && panel.open) closeImmediately(panel);
        });
      }
      reveal();
      return;
    }

    /**
     * 版本切换：旧弹窗先淡出，再打开目标弹窗淡入。旧弹窗在动画结束前保持可见，
     * 避免先 close 再 show 造成一帧空白 / 背景闪断。
     */
    if (!shouldAnimate) {
      // 无动画环境（jsdom / 旧浏览器 / reduced-motion）保持同步切换语义。
      for (const panel of outgoing) closeImmediately(panel);
      reveal();
      return;
    }

    for (const panel of outgoing) pendingOutgoing.add(panel);
    void Promise.all(outgoing.map((panel) => animatePanel(panel, 'leave'))).finally(() => {
      for (const panel of outgoing) {
        if (panel.open) closeImmediately(panel);
      }
      if (runId !== motionRunId) return;
      reveal();
    });
  };

  const closeDialog = (dialog: HTMLDialogElement) => {
    if (!dialog.open) return;
    const runId = ++motionRunId;
    const anchor = getDialogAnchor(dialog);
    const finish = () => {
      if (runId !== motionRunId) return;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      unlockScrollFor(dialog);
      clearHashAnchor(anchor);
    };

    if (canAnimatePanel()) {
      dialog.dataset.closing = 'true';
      void animatePanel(dialog, 'leave').finally(finish);
      return;
    }
    finish();
  };

  /** 旧 entry.id 别名 → 分组最新版锚点，最后才回退到最新的同组弹窗。 */
  const findDialogForAnchor = (anchor: string): HTMLDialogElement | null => {
    const prefix = wiring.hashDialogIdPrefix;
    const direct = prefix ? getDialog(`${prefix}${anchor}`) : null;
    if (direct) return direct;

    const findByAttribute = (attribute: string): HTMLDialogElement | null => {
      const nodes = document.querySelectorAll<HTMLElement>(`[${attribute}]`);
      for (const node of nodes) {
        if ((node.getAttribute(attribute) ?? '').trim() !== anchor) continue;
        const panel = node.closest<HTMLDialogElement>(wiring.panelSelector);
        if (panel) return panel;
      }
      return null;
    };

    if (wiring.hashAliasAttribute) {
      const alias = findByAttribute(wiring.hashAliasAttribute);
      if (alias) return alias;
    }

    if (wiring.hashLatestAnchorAttribute) {
      const latest = findByAttribute(wiring.hashLatestAnchorAttribute);
      if (latest) return latest;
    }

    return null;
  };

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const openTrigger = target.closest<HTMLElement>(wiring.openSelector);
    if (openTrigger) {
      event.preventDefault();
      const dialogId = (openTrigger.getAttribute(wiring.dialogIdAttribute) ?? '').trim();
      const dialog = dialogId ? getDialog(dialogId) : null;
      if (dialog) openDialog(dialog);
      return;
    }

    const closeTrigger = target.closest<HTMLElement>(wiring.closeSelector);
    if (closeTrigger) {
      const dialog = closeTrigger.closest<HTMLDialogElement>(wiring.panelSelector);
      if (dialog) closeDialog(dialog);
      return;
    }

    // 点遮罩关闭：`<dialog>` 自身即为遮罩区域。
    if (target instanceof HTMLDialogElement && target.matches(wiring.panelSelector)) {
      closeDialog(target);
    }
  });

  document.querySelectorAll<HTMLDialogElement>(wiring.panelSelector).forEach((dialog) => {
    dialog.addEventListener('cancel', (event) => {
      // 阻止原生立即关闭，交给 closeDialog 播退出动画；无动画时同步关闭。
      if (event.cancelable) event.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener('close', () => {
      // 关闭事件可能来自脚本或原生 fallback；统一在这里清掉退出标记，
      // 否则残留的 data-closing 会让下次打开的首帧直接处于淡出态。
      delete dialog.dataset.closing;
      // 原生 Esc、脚本直接 close() 等路径也要解锁；WeakSet 保证不会重复减计数。
      unlockScrollFor(dialog);
      dialog.scrollTop = 0;
      const content = dialog.querySelector<HTMLElement>(wiring.scrollResetSelector);
      if (content) content.scrollTop = 0;
    });
  });

  if (wiring.hashDialogIdPrefix) {
    /** `#<anchor>` 进入时自动展开对应弹窗，归档标题跳转依赖它。 */
    const openFromHash = () => {
      const anchor = readHashAnchor();
      if (!anchor) {
        if (!wiring.syncHash) return;
        document.querySelectorAll<HTMLDialogElement>(wiring.panelSelector).forEach((panel) => {
          if (panel.open) closeDialog(panel);
        });
        return;
      }
      const dialog = findDialogForAnchor(anchor);
      if (dialog) openDialog(dialog);
    };

    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }
};
