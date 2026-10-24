import { IMAGE_LOCAL_EXT_RE } from '../image-params';
import { toAdminContentAbsoluteProjectPath } from '../content-entry-source';
import type { AdminContentCollectionKey } from '../content-collections';

export type AdminMediaKind = 'image' | 'file';
export type AdminMediaReferenceStatus = 'referenced' | 'unreferenced' | 'orphan';
export type AdminMediaReferenceFilter = AdminMediaReferenceStatus | 'all';
export type AdminMediaTypeFilter = AdminMediaKind | 'all';
export type AdminMediaOrigin = 'content' | 'public';

export type AdminMediaItem = {
  path: string;
  origin: AdminMediaOrigin;
  kind: AdminMediaKind;
  fileName: string;
  mimeType: string | null;
  size: number;
  mtimeMs: number | null;
  collection: AdminContentCollectionKey;
  series: string;
  seriesLabel: string;
  hasSeries: boolean;
  version: string;
  versionLabel: string;
  entryId: string;
  entryLabel: string;
  entryExists: boolean;
  directory: string;
  referenceCount: number;
  referenced: boolean;
  referenceStatus: AdminMediaReferenceStatus;
  previewSrc: string | null;
};

export type AdminMediaFilterOption = {
  value: string;
  label: string;
  count: number;
  collection?: AdminContentCollectionKey;
  series?: string;
  entryId?: string;
};

export type AdminMediaTreeNode = {
  id: string;
  kind: 'collection' | 'series' | 'version' | 'directory' | 'shared';
  label: string;
  count: number;
  imageCount: number;
  fileCount: number;
  orphanCount: number;
  collection: AdminContentCollectionKey;
  series: string;
  version: string;
  entryId: string;
  directory: string;
  children: AdminMediaTreeNode[];
};

export type AdminMediaBreadcrumb = {
  id: string;
  label: string;
  filters: Partial<AdminMediaListRequest>;
};

export type AdminMediaListRequest = {
  collection: string;
  series: string;
  version: string;
  entry: string;
  directory: string;
  reference: AdminMediaReferenceFilter;
  type: AdminMediaTypeFilter;
  from: string;
  to: string;
  query: string;
  page: number;
  limit: number;
};

export type AdminMediaListResult = {
  items: AdminMediaItem[];
  page: number;
  totalPages: number;
  totalCount: number;
  filters: AdminMediaListRequest;
  tree: AdminMediaTreeNode[];
  breadcrumb: AdminMediaBreadcrumb[];
  referenceOptions: AdminMediaFilterOption[];
  typeOptions: AdminMediaFilterOption[];
  options: {
    series: AdminMediaFilterOption[];
    versions: AdminMediaFilterOption[];
    directories: AdminMediaFilterOption[];
  };
};

export type MediaEntryMeta = {
  collection: AdminContentCollectionKey;
  entryId: string;
  dirRel: string;
  series: string;
  seriesLabel: string;
  hasSeries: boolean;
  version: string;
  versionLabel: string;
  entryLabel: string;
  title: string;
  date: Date | null;
  exists: boolean;
};

export const MARKDOWN_EXT_RE = /\.(?:md|mdx)$/i;
export const ASSET_DIR_NAMES = new Set(['images', 'files', 'assets']);
const IGNORED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
export const UNASSIGNED_SERIES = '(未归类)';
export const UNASSIGNED_VERSION = '(未归类)';
export const UNASSIGNED_LABEL = '未归属条目';
export const SHARED_ENTRY_ID = '_shared';
export const SHARED_LABEL = '共享资源';
export const DEFAULT_LIMIT = 40;
export const MAX_LIMIT = 100;

export const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const isImageFile = (fileName: string): boolean => IMAGE_LOCAL_EXT_RE.test(fileName);

export const isIgnoredFile = (fileName: string): boolean =>
  IGNORED_FILE_NAMES.has(fileName)
  || fileName.startsWith('.')
  || /\.(?:tmp|bak)$/i.test(fileName);

export const toPreviewSrc = (assetPath: string): string | null => {
  if (assetPath.startsWith('public/')) return `/${assetPath.slice('public/'.length)}`;
  if (assetPath.startsWith('content/')) {
    return `/@fs/${encodeURI(toAdminContentAbsoluteProjectPath(assetPath))}`;
  }
  return null;
};
