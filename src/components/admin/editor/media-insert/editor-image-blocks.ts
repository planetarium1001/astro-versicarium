import {
  findBlogImageBlockAtSelection,
  type BlogImageBlock
} from '../../../../lib/admin-console/blog-image-blocks';
import type { EditorTextSelection } from '../markdown/editor-markdown-transforms';
import type { ImageBlockDraft } from './image-insert-helpers';

export type EditableImageBlock = Omit<BlogImageBlock, 'draft'> & {
  draft: ImageBlockDraft;
};

const toEditableImageBlock = (block: BlogImageBlock | null): EditableImageBlock | null =>
  block as EditableImageBlock | null;

export const findEditableImageBlockAtSelection = (
  source: string,
  selection: EditorTextSelection
): EditableImageBlock | null =>
  toEditableImageBlock(findBlogImageBlockAtSelection(source, selection));
