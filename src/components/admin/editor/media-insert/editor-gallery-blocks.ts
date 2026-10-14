import {
  findBlogGalleryBlockAroundSelection,
  findBlogGalleryBlockAtSelection,
  type BlogGalleryBlock,
  type BlogGalleryBlockSearchOptions
} from '../../../../lib/admin-console/blog-gallery-blocks';
import type { EditorTextSelection } from '../markdown/editor-markdown-transforms';
import type { GalleryBlockDraft } from './gallery-insert-helpers';

export type EditableGalleryBlock = Omit<BlogGalleryBlock, 'draft'> & {
  draft: GalleryBlockDraft;
};

type EditableGalleryBlockSearchOptions = BlogGalleryBlockSearchOptions;

const toEditableGalleryBlock = (block: BlogGalleryBlock | null): EditableGalleryBlock | null =>
  block as EditableGalleryBlock | null;

export const findEditableGalleryBlockAtSelection = (
  source: string,
  selection: EditorTextSelection
): EditableGalleryBlock | null =>
  toEditableGalleryBlock(findBlogGalleryBlockAtSelection(source, selection));

export const findEditableGalleryBlockAroundSelection = (
  source: string,
  selection: EditorTextSelection,
  options: EditableGalleryBlockSearchOptions = {}
): EditableGalleryBlock | null =>
  toEditableGalleryBlock(findBlogGalleryBlockAroundSelection(source, selection, options));
