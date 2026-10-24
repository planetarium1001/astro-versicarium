import type { ComponentProps } from 'svelte';
import type EditorTopControls from './EditorTopControls.svelte';
import type { MarkdownCommandDispatcher } from '../markdown/editor-markdown-command-dispatcher';
import type { StatusState } from './editor-shell-helpers';
import type { createEditorShellController } from './editor-shell-controller.svelte';

type EditorShellController = ReturnType<typeof createEditorShellController>;

type EditorTopControlsSharedKeys =
  | 'outlineOpen'
  | 'outlineVisible'
  | 'outlineToggleLabel'
  | 'outlineControlDisabled'
  | 'syntaxOpen'
  | 'syntaxVisible'
  | 'syntaxToggleLabel'
  | 'syntaxControlDisabled'
  | 'lineNumbersEnabled'
  | 'lineNumbersToggleLabel'
  | 'markdownHighlightTheme'
  | 'editorLayoutIsSplit'
  | 'editorLayoutToggleLabel'
  | 'editorLayoutToggleIcon'
  | 'singleViewActive'
  | 'singleViewReturnLabel'
  | 'splitBothIsCompact'
  | 'compactPaneToggleLabel'
  | 'compactPaneToggleText'
  | 'editViewToggleLabel'
  | 'previewViewToggleLabel'
  | 'effectiveViewMode'
  | 'onApplyTool'
  | 'onApplyHeading'
  | 'onApplyCallout'
  | 'onInsertText'
  | 'onOpenGallery'
  | 'onToggleOutline'
  | 'onToggleSyntax'
  | 'onToggleLineNumbers'
  | 'onSelectMarkdownHighlightTheme'
  | 'onToggleLayout'
  | 'onToggleView'
  | 'onReturnToBothView'
  | 'onToggleCompactPane'
  | 'statusText'
  | 'statusState'
  | 'canWriteContent'
  | 'dirty'
  | 'returnHref'
  | 'exportHref';

export type EditorTopControlsSharedProps = Pick<
  ComponentProps<typeof EditorTopControls>,
  EditorTopControlsSharedKeys
>;

type EditorTopControlsSharedInput = {
  shell: EditorShellController;
  dispatcher: MarkdownCommandDispatcher;
  onOpenGallery: () => void;
  statusText: string;
  statusState: StatusState;
  canWriteContent: boolean;
  dirty: boolean;
  returnHref: string;
  exportHref: string;
};

// 面板 id 与按钮文案随工作区不同，留在各工作区覆盖。
export const buildEditorTopControlsProps = ({
  shell,
  dispatcher,
  onOpenGallery,
  statusText,
  statusState,
  canWriteContent,
  dirty,
  returnHref,
  exportHref
}: EditorTopControlsSharedInput): EditorTopControlsSharedProps => ({
  outlineOpen: shell.outlineOpen,
  outlineVisible: shell.outlineVisible,
  outlineToggleLabel: shell.outlineToggleLabel,
  outlineControlDisabled: shell.outlineControlDisabled,
  syntaxOpen: shell.syntaxOpen,
  syntaxVisible: shell.syntaxVisible,
  syntaxToggleLabel: shell.syntaxToggleLabel,
  syntaxControlDisabled: shell.syntaxControlDisabled,
  lineNumbersEnabled: shell.lineNumbers,
  lineNumbersToggleLabel: shell.lineNumbersToggleLabel,
  markdownHighlightTheme: shell.markdownHighlightTheme,
  editorLayoutIsSplit: shell.layout === 'split',
  editorLayoutToggleLabel: shell.layoutToggleLabel,
  editorLayoutToggleIcon: shell.layoutToggleIcon,
  singleViewActive: shell.singleViewActive,
  singleViewReturnLabel: shell.singleViewReturnLabel,
  splitBothIsCompact: shell.splitBothIsCompact,
  compactPaneToggleLabel: shell.compactPaneToggleLabel,
  compactPaneToggleText: shell.compactPaneToggleText,
  editViewToggleLabel: shell.editViewToggleLabel,
  previewViewToggleLabel: shell.previewViewToggleLabel,
  effectiveViewMode: shell.effectiveViewMode,
  onApplyTool: dispatcher.applyTool,
  onApplyHeading: dispatcher.applyHeading,
  onApplyCallout: dispatcher.applyCallout,
  onInsertText: dispatcher.insertText,
  onOpenGallery,
  onToggleOutline: shell.toggleOutline,
  onToggleSyntax: shell.toggleSyntax,
  onToggleLineNumbers: shell.toggleLineNumbers,
  onSelectMarkdownHighlightTheme: shell.selectMarkdownHighlightTheme,
  onToggleLayout: shell.toggleLayout,
  onToggleView: shell.toggleViewMode,
  onReturnToBothView: shell.returnToBothView,
  onToggleCompactPane: shell.toggleCompactPaneMode,
  statusText,
  statusState,
  canWriteContent,
  dirty,
  returnHref,
  exportHref
});
