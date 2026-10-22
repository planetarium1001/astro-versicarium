import {
  clearAllScrollbarVisibilityTimers,
  clearScrollbarVisibilityTimer,
  getOppositeScrollSource,
  getScrollRatio,
  getScrollableDistance,
  markScrollElementScrolling,
  type EditorScrollSource,
  type EditorViewMode
} from './editor-shell-helpers';

type EditorScrollSyncControllerOptions = {
  getScrollElement: (source: EditorScrollSource) => HTMLElement | null;
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  isAvailable: () => boolean;
  scrollbarVisibilityTimeoutMs: number;
};

export type EditorScrollSyncController = {
  cancelQueued: () => void;
  clearElement: (element: HTMLElement) => void;
  destroy: () => void;
  handlePaneScroll: (source: EditorScrollSource) => void;
  markElementScrolling: (element: HTMLElement) => void;
  queueLastSource: () => void;
  releaseGuard: (frameDelay?: number) => void;
  scrollToTop: (viewMode: EditorViewMode) => void;
  setGuarded: (guarded: boolean) => void;
  setLastSource: (source: EditorScrollSource) => void;
  toggleEnabled: () => void;
};

const getWindowRef = (): Window | null => typeof window === 'undefined' ? null : window;

// 浏览器可能把越界写入 clamp 到实际可达值，事件比对因此带 1px 容差。
const PROGRAMMATIC_SCROLL_TOLERANCE_PX = 1;
// 快速连续滚动时，目标 scroll 事件可能晚于下一次同步写入；保留多条在途回声。
const MAX_PENDING_PROGRAMMATIC_SCROLLS = 8;
// 回声只代表最近几帧的写入；更早的条目即使没等到事件也必须过期，否则会吞掉用户滚动。
const PROGRAMMATIC_SCROLL_ECHO_TTL_MS = 4 * 16;

type ProgrammaticScrollEcho = {
  scrollTop: number;
  recordedAt: number;
};

// 记录上一次源→目标映射，用于抑制源 max 估算变化导致的目标回退。
type ScrollSyncBaseline = {
  source: EditorScrollSource;
  sourceScrollTop: number;
  targetScrollTop: number;
};

export const createEditorScrollSyncController = ({
  getScrollElement,
  isEnabled,
  setEnabled,
  isAvailable,
  scrollbarVisibilityTimeoutMs
}: EditorScrollSyncControllerOptions): EditorScrollSyncController => {
  let lastSource: EditorScrollSource = 'body';
  let pendingSource: EditorScrollSource | null = null;
  let syncFrame: number | null = null;
  let releaseFrame: number | null = null;
  let applyingScrollSync = false;
  let lastAppliedSync: ScrollSyncBaseline | null = null;
  const scrollbarVisibilityTimers = new Map<HTMLElement, number>();
  // 逐元素记录“这些 scrollTop 是我们写进去的期望值”，事件到达时按队列比对。
  const programmaticScrollEchoes = new Map<HTMLElement, ProgrammaticScrollEcho[]>();

  const pruneExpiredEchoes = (echoes: ProgrammaticScrollEcho[], now: number) => {
    let oldestEcho = echoes[0];
    while (oldestEcho !== undefined && now - oldestEcho.recordedAt > PROGRAMMATIC_SCROLL_ECHO_TTL_MS) {
      echoes.shift();
      oldestEcho = echoes[0];
    }
  };

  const setProgrammaticScrollTop = (element: HTMLElement, scrollTop: number): number => {
    const previousScrollTop = element.scrollTop;
    element.scrollTop = scrollTop;
    const nextScrollTop = element.scrollTop;
    // 写入没有真正改变位置（clamp 到底、已在 0、重复值）就不会有 scroll 事件，不能登记回声。
    if (nextScrollTop === previousScrollTop) return nextScrollTop;

    const now = Date.now();
    const echoes = programmaticScrollEchoes.get(element);
    if (!echoes) {
      programmaticScrollEchoes.set(element, [{ scrollTop: nextScrollTop, recordedAt: now }]);
      return nextScrollTop;
    }

    pruneExpiredEchoes(echoes, now);
    echoes.push({ scrollTop: nextScrollTop, recordedAt: now });
    if (echoes.length > MAX_PENDING_PROGRAMMATIC_SCROLLS) {
      echoes.splice(0, echoes.length - MAX_PENDING_PROGRAMMATIC_SCROLLS);
    }
    return nextScrollTop;
  };

  const consumeProgrammaticScrollEcho = (element: HTMLElement): boolean => {
    const echoes = programmaticScrollEchoes.get(element);
    if (!echoes || echoes.length === 0) return false;

    pruneExpiredEchoes(echoes, Date.now());
    if (echoes.length === 0) {
      programmaticScrollEchoes.delete(element);
      return false;
    }

    const matchedIndex = echoes.findIndex(
      (echo) => Math.abs(element.scrollTop - echo.scrollTop) <= PROGRAMMATIC_SCROLL_TOLERANCE_PX
    );
    if (matchedIndex === -1) {
      // 值在队列之外：用户真实滚动，清空过期回声后按正常同步处理。
      programmaticScrollEchoes.delete(element);
      lastAppliedSync = null;
      return false;
    }

    // 命中项及更早的在途回声都已到达，剩余的是更晚写入留下的回声。
    echoes.splice(0, matchedIndex + 1);
    if (echoes.length === 0) programmaticScrollEchoes.delete(element);
    return true;
  };

  const cancelQueued = () => {
    const win = getWindowRef();
    if (!win || syncFrame === null) return;

    win.cancelAnimationFrame(syncFrame);
    syncFrame = null;
    pendingSource = null;
  };

  const releaseGuard = (frameDelay = 1) => {
    const win = getWindowRef();
    if (!win) return;

    if (releaseFrame !== null) {
      win.cancelAnimationFrame(releaseFrame);
    }

    let remainingFrames = Math.max(1, frameDelay);
    const releaseOnFrame = () => {
      remainingFrames -= 1;
      if (remainingFrames > 0) {
        releaseFrame = win.requestAnimationFrame(releaseOnFrame);
        return;
      }

      applyingScrollSync = false;
      releaseFrame = null;
    };

    releaseFrame = win.requestAnimationFrame(releaseOnFrame);
  };

  const applySync = (source: EditorScrollSource) => {
    const sourceElement = getScrollElement(source);
    const targetElement = getScrollElement(getOppositeScrollSource(source));
    if (!sourceElement || !targetElement) return;

    const targetDistance = getScrollableDistance(targetElement);
    const sourceDistance = getScrollableDistance(sourceElement);
    const sourceScrollTop = sourceElement.scrollTop;
    // 编辑器可达 max 可能略小于几何 max；源到底时直接对齐目标底部，避免预览永远差一截。
    const sourceAtBottom =
      sourceDistance > 0
      && sourceScrollTop >= sourceDistance - PROGRAMMATIC_SCROLL_TOLERANCE_PX;
    let requestedTargetTop = sourceAtBottom
      ? targetDistance
      : targetDistance * getScrollRatio(sourceElement);

    // CodeMirror 在滚动中会修正内容高度（scrollHeight/max 变化），按比例重算会让目标回退一截。
    // 同一次源→目标同步里，源向前滚动时目标只允许前进，反向滚动才允许目标后退。
    if (lastAppliedSync && lastAppliedSync.source === source) {
      const sourceDelta = sourceScrollTop - lastAppliedSync.sourceScrollTop;
      if (sourceDelta > 0) {
        requestedTargetTop = Math.max(requestedTargetTop, lastAppliedSync.targetScrollTop);
      } else if (sourceDelta < 0) {
        requestedTargetTop = Math.min(requestedTargetTop, lastAppliedSync.targetScrollTop);
      }
    }

    // 不依赖全局 guard：只标记目标元素，事件到达时逐元素消费，避免晚期事件被当成用户滚动。
    const appliedTargetTop = setProgrammaticScrollTop(targetElement, requestedTargetTop);
    lastAppliedSync = { source, sourceScrollTop, targetScrollTop: appliedTargetTop };
  };

  const queue = (source: EditorScrollSource) => {
    const win = getWindowRef();
    if (!win) return;

    pendingSource = source;
    if (syncFrame !== null) return;

    syncFrame = win.requestAnimationFrame(() => {
      const queuedSource = pendingSource;
      syncFrame = null;
      pendingSource = null;

      if (!queuedSource || !isEnabled() || !isAvailable()) return;
      applySync(queuedSource);
    });
  };

  const markElementScrolling = (element: HTMLElement) => {
    markScrollElementScrolling(scrollbarVisibilityTimers, element, scrollbarVisibilityTimeoutMs);
  };

  const setLastSource = (source: EditorScrollSource) => {
    lastSource = source;
  };

  const handlePaneScroll = (source: EditorScrollSource) => {
    const sourceElement = getScrollElement(source);
    if (sourceElement) {
      markElementScrolling(sourceElement);
      // 同步写入目标后，它的 scroll 事件可能晚于写入帧才到达；
      // 命中逐元素回声队列就当作程序化写入消费掉，不更新同步源也不反推另一侧。
      if (consumeProgrammaticScrollEcho(sourceElement)) return;
    }

    if (applyingScrollSync) return;

    setLastSource(source);
    if (!isEnabled() || !isAvailable()) return;

    queue(source);
  };

  const toggleEnabled = () => {
    if (!isAvailable()) return;

    const nextEnabled = !isEnabled();
    setEnabled(nextEnabled);
    if (nextEnabled) queue(lastSource);
  };

  const scrollToTop = (viewMode: EditorViewMode) => {
    const scrollElements = [
      viewMode === 'preview' ? null : getScrollElement('body'),
      viewMode === 'edit' ? null : getScrollElement('preview')
    ].filter(
      (element): element is HTMLElement => element !== null
    );
    if (scrollElements.length === 0) return;

    setLastSource(viewMode === 'preview' ? 'preview' : 'body');
    cancelQueued();
    lastAppliedSync = null;
    scrollElements.forEach((element) => {
      setProgrammaticScrollTop(element, 0);
    });
  };

  const clearElement = (element: HTMLElement) => {
    clearScrollbarVisibilityTimer(scrollbarVisibilityTimers, element);
    programmaticScrollEchoes.delete(element);
    lastAppliedSync = null;
  };

  const destroy = () => {
    const win = getWindowRef();
    if (win) {
      if (syncFrame !== null) win.cancelAnimationFrame(syncFrame);
      if (releaseFrame !== null) win.cancelAnimationFrame(releaseFrame);
    }
    syncFrame = null;
    releaseFrame = null;
    pendingSource = null;
    applyingScrollSync = false;
    lastAppliedSync = null;
    programmaticScrollEchoes.clear();
    clearAllScrollbarVisibilityTimers(scrollbarVisibilityTimers);
  };

  return {
    cancelQueued,
    clearElement,
    destroy,
    handlePaneScroll,
    markElementScrolling,
    queueLastSource: () => queue(lastSource),
    releaseGuard,
    scrollToTop,
    setGuarded: (guarded) => {
      applyingScrollSync = guarded;
      // 预览恢复/目录跳转期间的外部写入不会经过这里，进入 guard 时先清空陈旧回声。
      if (guarded) {
        lastAppliedSync = null;
        programmaticScrollEchoes.clear();
      }
    },
    setLastSource,
    toggleEnabled
  };
};
