import type {
  AdminBlogEditorValues,
  AdminDevlogEditorValues,
  AdminProjectsEditorValues
} from '../../../../lib/admin-console/content-editor-payload';
import type { EditorOutlineBlogSourceItem } from '../markdown/editor-outline-helpers';

/** 列表型集合（blog / projects / devlog）共用同一套工作区壳层。 */
type ListWorkspaceEditorValues =
  | AdminBlogEditorValues
  | AdminProjectsEditorValues
  | AdminDevlogEditorValues;

type BaseListEditorShellProps = {
  collection: 'blog' | 'projects' | 'devlog';
  endpoint: string;
  exportEndpoint: string;
  deleteEndpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
  returnHref: string;
  entryId: string;
  relativePath: string;
  defaultPublicSlug: string;
  revision: string;
  initialArticleInfoOpen?: boolean;
};

export type BlogEditorShellProps = BaseListEditorShellProps & {
  initialFrontmatter: ListWorkspaceEditorValues;
  initialBody: string;
  BlogOutlineItems?: EditorOutlineBlogSourceItem[];
};
