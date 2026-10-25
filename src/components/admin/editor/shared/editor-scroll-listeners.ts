import type { EditorScrollSource } from './editor-shell-helpers';

type EditorScrollListenerOptions = {
  getBodyElement: () => HTMLElement | null;
  getPreviewElement: () => HTMLElement | null;
  isBothMode: () => boolean;
  isSyncEnabled: () => boolean;
  isSyncAvailable: () => boolean;
  onPaneScroll: (source: EditorScrollSource) => void;
  queueLastSource: () => void;
  clearElement: (element: HTMLElement) => void;
};

// 返回值直接作为 $effect 的 cleanup；不满足双栏条件时无需清理。
export const attachEditorScrollListeners = ({
  getBodyElement,
  getPreviewElement,
  isBothMode,
  isSyncEnabled,
  isSyncAvailable,
  onPaneScroll,
  queueLastSource,
  clearElement
}: EditorScrollListenerOptions): (() => void) | undefined => {
  const bodyElement = getBodyElement();
  const previewElement = getPreviewElement();
  if (!bodyElement || !previewElement || !isBothMode()) return undefined;

  const handleBodyScroll = () => {
    onPaneScroll('body');
  };

  const handlePreviewScroll = () => {
    onPaneScroll('preview');
  };

  const handlePreviewContentLoad = () => {
    if (isSyncEnabled() && isSyncAvailable()) {
      queueLastSource();
    }
  };

  bodyElement.addEventListener('scroll', handleBodyScroll, { passive: true });
  previewElement.addEventListener('scroll', handlePreviewScroll, { passive: true });
  previewElement.addEventListener('load', handlePreviewContentLoad, true);

  if (isSyncEnabled()) {
    queueLastSource();
  }

  return () => {
    bodyElement.removeEventListener('scroll', handleBodyScroll);
    previewElement.removeEventListener('scroll', handlePreviewScroll);
    previewElement.removeEventListener('load', handlePreviewContentLoad, true);
    clearElement(bodyElement);
    clearElement(previewElement);
  };
};
