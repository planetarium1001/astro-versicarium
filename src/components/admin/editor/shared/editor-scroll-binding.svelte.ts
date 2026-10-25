import { tick } from 'svelte';
import {
  applyPreviewHtmlPreservingScroll,
  captureEditorScrollSnapshot,
  EDITOR_SCROLLBAR_VISIBILITY_TIMEOUT_MS,
  restoreEditorScrollSnapshot,
  type EditorScrollSource,
  type EditorViewMode
} from './editor-shell-helpers';
import {
  createEditorScrollSyncController,
  type EditorScrollSyncController
} from './editor-scroll-sync';

type EditorScrollBindingOptions = {
  getEffectiveViewMode: () => EditorViewMode;
  isSyncEnabled: () => boolean;
  setSyncEnabled: (enabled: boolean) => void;
  isSyncAvailable: () => boolean;
  // 预览 HTML 由组件状态派生的工作区不配置写入函数，也不会调用滚动保持刷新。
  setPreviewHtml?: (html: string) => void;
};

export type EditorScrollBinding = {
  readonly bodyScrollElement: HTMLElement | null;
  readonly previewScrollElement: HTMLElement | null;
  readonly controller: EditorScrollSyncController;
  setBodyScrollElement: (element: HTMLElement | null) => void;
  setPreviewScrollElement: (element: HTMLElement | null) => void;
  handlePaneScroll: (source: EditorScrollSource) => void;
  toggleSync: () => void;
  scrollToTop: () => void;
  refreshPreviewHtml: (html: string) => Promise<void>;
  destroy: () => void;
};

export const waitForAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

export const createEditorScrollBinding = ({
  getEffectiveViewMode,
  isSyncEnabled,
  setSyncEnabled,
  isSyncAvailable,
  setPreviewHtml
}: EditorScrollBindingOptions): EditorScrollBinding => {
  let bodyScrollElement = $state<HTMLElement | null>(null);
  let previewScrollElement = $state<HTMLElement | null>(null);

  const getScrollElement = (source: EditorScrollSource): HTMLElement | null =>
    source === 'body' ? bodyScrollElement : previewScrollElement;

  const controller = createEditorScrollSyncController({
    getScrollElement,
    isEnabled: isSyncEnabled,
    setEnabled: setSyncEnabled,
    isAvailable: isSyncAvailable,
    scrollbarVisibilityTimeoutMs: EDITOR_SCROLLBAR_VISIBILITY_TIMEOUT_MS
  });

  const setBodyScrollElement = (element: HTMLElement | null) => {
    bodyScrollElement = element;
  };

  const setPreviewScrollElement = (element: HTMLElement | null) => {
    previewScrollElement = element;
  };

  const handlePaneScroll = (source: EditorScrollSource) => {
    controller.handlePaneScroll(source);
  };

  const toggleSync = () => {
    controller.toggleEnabled();
  };

  const scrollToTop = () => {
    controller.scrollToTop(getEffectiveViewMode());
  };

  const refreshPreviewHtml = async (html: string) => {
    const applyHtml = setPreviewHtml;
    if (!applyHtml) {
      throw new Error('滚动绑定未配置 setPreviewHtml，无法刷新预览 HTML');
    }

    await applyPreviewHtmlPreservingScroll({
      captureScrollPosition: () => captureEditorScrollSnapshot(previewScrollElement),
      applyHtml: () => {
        applyHtml(html);
      },
      waitForRender: () => tick(),
      restoreScrollPosition: (snapshot) => {
        restoreEditorScrollSnapshot(snapshot, previewScrollElement);
      },
      waitForLayoutSettle: () => waitForAnimationFrame(),
      cancelQueuedScrollSync: () => controller.cancelQueued(),
      setScrollSyncGuarded: (guarded) => {
        controller.setGuarded(guarded);
      },
      releaseScrollSyncGuard: (frameDelay) => controller.releaseGuard(frameDelay),
      isScrollSyncActive: () => isSyncEnabled() && isSyncAvailable(),
      realignScrollSync: () => controller.queueLastSource()
    });
  };

  const destroy = () => {
    controller.destroy();
  };

  return {
    get bodyScrollElement() {
      return bodyScrollElement;
    },
    get previewScrollElement() {
      return previewScrollElement;
    },
    controller,
    setBodyScrollElement,
    setPreviewScrollElement,
    handlePaneScroll,
    toggleSync,
    scrollToTop,
    refreshPreviewHtml,
    destroy
  };
};
