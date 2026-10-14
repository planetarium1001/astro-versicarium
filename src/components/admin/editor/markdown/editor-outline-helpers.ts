import type { MarkdownOutlineItem } from '../../../../lib/admin-console/editor-outline';

export {
  buildEditorOutlineListItems,
  buildBlogOutlineListItems,
  extractMarkdownOutline,
  getMarkdownOutlineSelectionRange
} from '../../../../lib/admin-console/editor-outline';

export type {
  EditorOutlineListItem,
  EditorOutlineListSourceItem,
  EditorOutlineBlogListItem,
  EditorOutlineBlogSourceItem,
  EditorOutlineTab,
  MarkdownOutlineItem,
  MarkdownOutlineSelectionRange
} from '../../../../lib/admin-console/editor-outline';

export type MarkdownOutlineJumpCommand = {
  id: number;
  item: MarkdownOutlineItem;
  targetOffsetRatio?: number;
};
