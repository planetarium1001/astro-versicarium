<script lang="ts">
import { containsMarkdownMath } from '../../../../lib/markdown-math';
import { ensureMarkdownMathStylesheet } from '../../../../lib/markdown-math-styles';
import {
  ADMIN_EDITOR_DEFAULTS_STORAGE_KEY,
  ADMIN_EDITOR_DISPLAY_PREFERENCE_STORAGE_KEY,
  ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readStoredAdminEditorDefaults
} from '../../../../lib/admin-console/ui-prefs-keys';
import { closeClosestAdminDetailsMenu } from '../../../../scripts/admin-content/details-menu';
import {
  renderContentPreview,
  saveContentEntry,
  type AdminContentPreviewResult,
  type AdminContentIssue,
  type AdminContentWriteResult
} from '../shared/content-editor-client';
import { getContentEditorAdapter } from '../shared/content-editor-adapters';
import EditorFooterActions from '../shared/EditorFooterActions.svelte';
import EditorTopControls from '../shared/EditorTopControls.svelte';
import EditorWorkspace from '../shared/EditorWorkspace.svelte';
import { ADMIN_EDITOR_DETAILS_MENU_SELECTORS } from '../shared/editor-page-integration';
import { createEditorPageLifecycle } from '../shared/editor-page-lifecycle';
import {
  buildContentExportHref,
  EDITOR_OUTLINE_TARGET_SCROLL_OFFSET_RATIO,
  getEditorBodyCharCount,
  getEditorScrollSyncToggleLabel,
  getPreviewDebounceMs,
  normalizeEditorBodyValue,
  type StatusState
} from '../shared/editor-shell-helpers';
import {
  createEditorShellController,
  createFallbackOutlineTabNormalizer
} from '../shared/editor-shell-controller.svelte';
import {
  extractMarkdownOutline,
  type MarkdownOutlineJumpCommand,
  type MarkdownOutlineItem
} from '../markdown/editor-outline-helpers';
import type { MarkdownToolbarCommand } from '../markdown/markdown-tools';
import { createEditorScrollBinding } from '../shared/editor-scroll-binding.svelte';
import { attachEditorScrollListeners } from '../shared/editor-scroll-listeners';
import { buildEditorTopControlsProps } from '../shared/editor-top-controls-props';
import { createMarkdownCommandDispatcher } from '../markdown/editor-markdown-command-dispatcher';
import { createEditorPreviewRequestGuard } from '../shared/editor-preview-request-guard';
import { FIXED_PAGE_EDITOR_COPY } from './fixed-page-editor-copy';
import type { AboutEditorIslandProps } from './about-editor-island-props';

const PAGE_ACTIONS_HOST_SELECTOR = '[data-admin-editor-page-actions-host]';
const OUTLINE_PANEL_ID = 'admin-about-editor-outline-panel';
const SYNTAX_PANEL_ID = 'admin-about-editor-syntax-panel';
const ABOUT_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY = `${ADMIN_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY}:about`;

let {
  endpoint,
  exportEndpoint,
  previewEndpoint,
  returnHref,
  entryId,
  revision,
  initialBody
}: AboutEditorIslandProps = $props();

const editorAdapter = getContentEditorAdapter('about');
const collection = 'about' as const;
const exportHref = $derived(buildContentExportHref(exportEndpoint, collection, entryId));

const createInitialSnapshot = () => ({
  revision,
  body: normalizeEditorBodyValue(initialBody)
});

const initialSnapshot = createInitialSnapshot();

let topActionsEl = $state<HTMLDivElement | null>(null);
let currentRevision = $state(initialSnapshot.revision);
let baselineBody = $state(initialSnapshot.body);
let body = $state(initialSnapshot.body);
let busy = $state(false);
let statusState = $state<StatusState>('idle');
let statusText = $state('');
let errors = $state<string[]>([]);
let issues = $state<AdminContentIssue[]>([]);
let writeResult = $state<AdminContentWriteResult | null>(null);
let previewResult = $state<AdminContentPreviewResult | null>(null);
let previewBusy = $state(false);
let previewError = $state('');
let previewWarnings = $state<string[]>([]);
const previewRequestGuard = createEditorPreviewRequestGuard();
const readDevAdminEditorDefaults = () =>
  import.meta.env.DEV ? readStoredAdminEditorDefaults(ADMIN_EDITOR_DEFAULTS_STORAGE_KEY) : null;
const shell = createEditorShellController({
  layoutStorageKey: ADMIN_EDITOR_LAYOUT_STORAGE_KEY,
  displayPreferenceStorageKey: ADMIN_EDITOR_DISPLAY_PREFERENCE_STORAGE_KEY,
  sidePanelPreferenceStorageKey: ABOUT_EDITOR_SIDE_PANEL_PREFERENCE_STORAGE_KEY,
  readAdminDefaults: readDevAdminEditorDefaults,
  normalizeOutlineTab: createFallbackOutlineTabNormalizer('blogs', 'headings')
});
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let outlineJumpCommand = $state<MarkdownOutlineJumpCommand | null>(null);
let editorShellEl = $state<HTMLElement | null>(null);
let syncScrollEnabled = $state(true);
let outlineJumpCommandId = 0;

const scrollBinding = createEditorScrollBinding({
  getEffectiveViewMode: () => shell.effectiveViewMode,
  isSyncEnabled: () => syncScrollEnabled,
  setSyncEnabled: (enabled) => {
    syncScrollEnabled = enabled;
  },
  isSyncAvailable: () => scrollSyncAvailable
});

const markdownCommandDispatcher = createMarkdownCommandDispatcher({
  isBusy: () => busy,
  onCommand: (command) => {
    toolbarCommand = command;
  }
});

const bodyDirty = $derived(body !== baselineBody);
const dirty = $derived(bodyDirty);
const canWriteContent = $derived(!busy && dirty);
const bodyLineCount = $derived(body.length === 0 ? 1 : body.split(/\r\n|\r|\n/).length);
const bodyCharCount = $derived(getEditorBodyCharCount(body));
const visibleWriteResult = $derived(!dirty ? writeResult : null);
const markdownOutlineItems = $derived(
  shell.outlineVisible && shell.outlineActiveTab === 'headings'
    ? extractMarkdownOutline(body)
    : []
);
const outlineListItems = $derived([]);
const previewHtml = $derived(previewResult?.html ?? '');
const previewSnapshotKey = $derived(body);
const scrollSyncAvailable = $derived(
  shell.effectiveViewMode === 'both'
    && Boolean(scrollBinding.bodyScrollElement && scrollBinding.previewScrollElement)
);
const scrollSyncToggleLabel = $derived(getEditorScrollSyncToggleLabel({
  available: scrollSyncAvailable,
  enabled: syncScrollEnabled
}));
const scrollSyncControlDisabled = $derived(!scrollSyncAvailable);
const scrollTopControlDisabled = $derived(
  !scrollBinding.bodyScrollElement && !scrollBinding.previewScrollElement
);

const setStatus = (state: StatusState, text: string) => {
  statusState = state;
  statusText = text;
};

const clearWriteFeedback = () => {
  errors = [];
  issues = [];
  writeResult = null;
};

const markDirty = () => {
  clearWriteFeedback();
  if (statusState === 'error' || statusState === 'warn') return;
  if (dirty) setStatus('idle', '');
};

const handleImageToolRequest = () => {
  setStatus('warn', FIXED_PAGE_EDITOR_COPY.unsupportedImageInsert);
};

const openGalleryInsert = () => {
  setStatus('warn', FIXED_PAGE_EDITOR_COPY.unsupportedGalleryInsert);
};

const handleGalleryEditRequest = () => {
  setStatus('warn', FIXED_PAGE_EDITOR_COPY.unsupportedGalleryInsert);
};

const scrollBodyToOutlineTarget = (item: MarkdownOutlineItem): boolean => {
  if (!scrollBinding.bodyScrollElement) return false;

  outlineJumpCommandId += 1;
  outlineJumpCommand = {
    id: outlineJumpCommandId,
    item,
    targetOffsetRatio: EDITOR_OUTLINE_TARGET_SCROLL_OFFSET_RATIO
  };
  return true;
};

const handleBodyOutlineJump = (element: HTMLElement) => {
  scrollBinding.controller.markElementScrolling(element);
};

const handleOutlineHeadingSelect = (item: MarkdownOutlineItem) => {
  if (shell.effectiveViewMode === 'preview') return;

  scrollBinding.controller.cancelQueued();
  const bodyScrolled = scrollBodyToOutlineTarget(item);
  if (bodyScrolled) {
    scrollBinding.controller.setLastSource('body');
  }
};

const abortActivePreviewRequest = (invalidate = false) => {
  previewRequestGuard.abortActiveRequest({ invalidate });
  if (invalidate) previewBusy = false;
};

const resetToBaseline = () => {
  body = baselineBody;
  clearWriteFeedback();
  setStatus('idle', '');
};

const closeActionMenu = (target: EventTarget | null) => {
  if (target instanceof HTMLElement) {
    closeClosestAdminDetailsMenu(target, '.admin-editor-shell__action-more');
  }
};

const handleActionMenuReset = (event: MouseEvent) => {
  closeActionMenu(event.currentTarget);
  resetToBaseline();
};

const handleActionMenuDownload = (event: MouseEvent) => {
  closeActionMenu(event.currentTarget);
};

const commitLatestBody = (latestBody: string | null) => {
  const nextBody = latestBody === null ? body : normalizeEditorBodyValue(latestBody);
  body = nextBody;
  baselineBody = nextBody;
};

const applyLatestBodyBaseline = (latestBody: string | null) => {
  if (latestBody === null) return false;

  baselineBody = normalizeEditorBodyValue(latestBody);
  return true;
};

const requestContentWrite = async () => {
  busy = true;
  clearWriteFeedback();
  setStatus('loading', FIXED_PAGE_EDITOR_COPY.saving);

  try {
    const saveOutcome = await saveContentEntry({
      endpoint,
      collection,
      entryId,
      revision: currentRevision,
      body
    });

    if (saveOutcome.revision && saveOutcome.responseOk) currentRevision = saveOutcome.revision;

    if (!saveOutcome.responseOk || !saveOutcome.payloadOk) {
      issues = saveOutcome.issues;
      const nextErrors = saveOutcome.errors.length > 0
        ? saveOutcome.errors
        : [FIXED_PAGE_EDITOR_COPY.saveFallbackError];
      if (saveOutcome.status === 409 && applyLatestBodyBaseline(saveOutcome.latestBody)) {
        if (saveOutcome.revision) currentRevision = saveOutcome.revision;
        errors = [
          ...nextErrors,
          '已载入磁盘最新版本作为冲突基线，当前编辑内容仍保留。请核对后再次保存，或通过“还原更改”载入磁盘版本。'
        ];
        setStatus('warn', '检测到外部更新，草稿已保留');
        return;
      }

      errors = nextErrors;
      setStatus(saveOutcome.status === 409 ? 'warn' : 'error', saveOutcome.status === 409 ? '检测到外部更新' : '保存失败');
      return;
    }

    const result = saveOutcome.result;
    if (!result) {
      errors = ['响应体缺少 result 字段，请检查开发日志'];
      setStatus('error', '写入响应异常');
      return;
    }

    writeResult = result;
    commitLatestBody(saveOutcome.latestBody);
    setStatus(result.changed ? 'ok' : 'ready', result.changed ? FIXED_PAGE_EDITOR_COPY.saved : '当前没有变更');
  } catch {
    errors = ['保存请求失败，请稍后重试'];
    setStatus('error', '保存请求失败');
  } finally {
    busy = false;
  }
};

const requestPreview = async (snapshotKey: string) => {
  const previewRequest = previewRequestGuard.beginRequest(snapshotKey);

  previewBusy = true;
  previewError = '';
  previewWarnings = [];

  try {
    const previewOutcome = await renderContentPreview({
      endpoint: previewEndpoint,
      collection,
      entryId,
      source: snapshotKey,
      signal: previewRequest.signal
    });

    if (!previewRequest.isCurrentForSource(previewSnapshotKey)) return;

    const nextPreviewResult = previewOutcome.result;
    if (!previewOutcome.responseOk || !previewOutcome.payloadOk || !nextPreviewResult) {
      issues = previewOutcome.issues;
      previewError = previewOutcome.errors[0] ?? '预览生成失败，请检查响应与控制台日志';
      return;
    }

    issues = [];
    previewResult = nextPreviewResult;
    previewWarnings = nextPreviewResult.warnings;
  } catch {
    if (previewRequest.signal.aborted || !previewRequest.isCurrent()) return;
    previewError = '预览请求失败，请稍后重试';
  } finally {
    if (previewRequest.isCurrent()) {
      previewBusy = false;
      previewRequestGuard.finishRequest(previewRequest);
    }
  }
};

$effect(() => {
  shell.restorePreferences();
});

$effect(() => {
  return createEditorPageLifecycle({
    shellElement: editorShellEl,
    actionsElement: topActionsEl,
    pageActionsHostSelector: PAGE_ACTIONS_HOST_SELECTOR,
    onInlineSize: shell.setInlineSize,
    detailsMenuSelectors: ADMIN_EDITOR_DETAILS_MENU_SELECTORS,
    navigationGuard: {
      isDirty: () => dirty,
      message: FIXED_PAGE_EDITOR_COPY.leaveConfirm,
      onBlocked: () => {
        setStatus('warn', '请先保存或还原');
      }
    }
  });
});

$effect(() => attachEditorScrollListeners({
  getBodyElement: () => scrollBinding.bodyScrollElement,
  getPreviewElement: () => scrollBinding.previewScrollElement,
  isBothMode: () => shell.effectiveViewMode === 'both',
  isSyncEnabled: () => syncScrollEnabled,
  isSyncAvailable: () => scrollSyncAvailable,
  onPaneScroll: scrollBinding.handlePaneScroll,
  queueLastSource: () => scrollBinding.controller.queueLastSource(),
  clearElement: (element) => scrollBinding.controller.clearElement(element)
}));

$effect(() => {
  shell.syncSyntaxMaximized();
});

$effect(() => {
  if (containsMarkdownMath(body)) {
    ensureMarkdownMathStylesheet();
  }
});

$effect(() => {
  return () => {
    scrollBinding.destroy();
    previewRequestGuard.destroy();
  };
});

$effect(() => {
  const snapshotKey = previewSnapshotKey;
  if (previewRequestGuard.consumeInitialRequest()) {
    void requestPreview(snapshotKey);
    return;
  }

  if (snapshotKey === previewRequestGuard.getLatestSource()) {
    previewRequestGuard.clearScheduledRequest();
    return;
  }

  abortActivePreviewRequest(true);
  return previewRequestGuard.scheduleRequest(
    snapshotKey,
    Math.max(320, getPreviewDebounceMs(body)),
    requestPreview
  );
});

</script>

<section
  class="admin-about-editor admin-editor-shell"
  bind:this={editorShellEl}
  data-admin-about-editor-workspace
  data-layout={shell.layout}
  data-view={shell.viewMode}
  data-effective-view={shell.effectiveViewMode}
  data-side-panel={shell.sidePanelLayout}
>
  <EditorTopControls
    bind:actionMenuElement={topActionsEl}
    {...buildEditorTopControlsProps({
      shell,
      dispatcher: markdownCommandDispatcher,
      onOpenGallery: openGalleryInsert,
      statusText,
      statusState,
      canWriteContent,
      dirty,
      returnHref,
      exportHref
    })}
    outlinePanelId={OUTLINE_PANEL_ID}
    syntaxPanelId={SYNTAX_PANEL_ID}
    {busy}
    toolbarPreset="full"
    imageToolEnabled={editorAdapter.capabilities.bodyImageInsert}
    galleryToolEnabled={editorAdapter.capabilities.bodyGalleryInsert}
    aboutDirectiveToolsEnabled
    actionLabel={FIXED_PAGE_EDITOR_COPY.actionLabel}
    moreLabel={FIXED_PAGE_EDITOR_COPY.moreLabel}
    saveLabel={FIXED_PAGE_EDITOR_COPY.saveLabel}
    downloadLabel="下载源文件"
    showDelete={editorAdapter.capabilities.delete}
    onSave={requestContentWrite}
    onReset={handleActionMenuReset}
    onDownload={handleActionMenuDownload}
  />

  <EditorWorkspace
    bind:value={body}
    disabled={busy}
    {toolbarCommand}
    {outlineJumpCommand}
    lineNumbersEnabled={shell.lineNumbers}
    markdownHighlightTheme={shell.markdownHighlightTheme}
    effectiveViewMode={shell.effectiveViewMode}
    {bodyLineCount}
    {bodyCharCount}
    {errors}
    {issues}
    {previewError}
    {previewWarnings}
    writeResult={visibleWriteResult}
    {syncScrollEnabled}
    {scrollSyncToggleLabel}
    {scrollSyncControlDisabled}
    {scrollTopControlDisabled}
    getWriteFieldLabel={editorAdapter.getWriteFieldLabel}
    mediaEditEnabled={editorAdapter.capabilities.bodyImageInsert}
    galleryEditEnabled={editorAdapter.capabilities.bodyGalleryInsert}
    aboutDirectiveHighlightEnabled
    {previewHtml}
    {previewBusy}
    previewArticleClass="about-body"
    sidePanelsVisible={shell.sidePanelsVisible}
    sidePanelLayout={shell.sidePanelLayout}
    outlinePanelId={OUTLINE_PANEL_ID}
    syntaxPanelId={SYNTAX_PANEL_ID}
    outlineActiveTab={shell.outlineActiveTab}
    {markdownOutlineItems}
    {outlineListItems}
    outlineListEnabled={false}
    outlineHeadingsTabLabel={FIXED_PAGE_EDITOR_COPY.outlineHeadingsTabLabel}
    outlineHeadingsTabIcon="square-chart-gantt"
    outlineHeadingsEmptyText="暂无 H2/H3 标题"
    outlinePanelLabel={FIXED_PAGE_EDITOR_COPY.outlinePanelLabel}
    onBodyScrollElementChange={scrollBinding.setBodyScrollElement}
    onBodyOutlineJump={handleBodyOutlineJump}
    onImageToolRequest={handleImageToolRequest}
    onGalleryEditRequest={handleGalleryEditRequest}
    onBodyChange={markDirty}
    onPreviewScrollElementChange={scrollBinding.setPreviewScrollElement}
    onShortcutTool={markdownCommandDispatcher.applyTool}
    onToggleScrollSync={scrollBinding.toggleSync}
    onScrollToTop={scrollBinding.scrollToTop}
    onOutlineTabChange={shell.setOutlineTab}
    onOutlineHeadingSelect={handleOutlineHeadingSelect}
    onSyntaxMaximizeToggle={shell.toggleSyntaxMaximize}
  />

  <EditorFooterActions
    {statusText}
    {statusState}
    {busy}
    {dirty}
    {canWriteContent}
    saveLabel={FIXED_PAGE_EDITOR_COPY.saveLabel}
    onReset={resetToBaseline}
    onSave={requestContentWrite}
  />
</section>
