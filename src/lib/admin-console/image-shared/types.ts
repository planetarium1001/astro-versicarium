import { CONTENT_ROOT } from '../../../../site.config.mjs';
import type { AdminImageBrowseGroup, AdminImageOrigin, AdminImageScopeKey } from '../image-contract';
import type { AdminImageBrowseFilterOption, AdminImageBrowseResolvedGroup } from '../image-browse';
import type { AdminImageCloudListItem } from '../image-cloud-storage';
import type { AdminImageDirectory, AdminImageFieldContext } from '../image-params';

type AdminImageOwnerOption = {
  value: string;
  label: string;
  count: number;
};

export type AdminImageListItem = {
  path: string;
  value: string;
  origin: AdminImageOrigin;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
  browseGroup: Exclude<AdminImageBrowseGroup, 'all'>;
  browseGroupLabel: string;
  browseSubgroup: string;
  browseSubgroupLabel: string | null;
  preferredValue: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

export type AdminImageListResult = {
  field: AdminImageFieldContext | null;
  directory: string;
  owner: string;
  ownerOptions: AdminImageOwnerOption[];
  scope: AdminImageScopeKey | '';
  group: string;
  subgroup: string;
  groupOptions: AdminImageBrowseFilterOption[];
  subgroupOptions: AdminImageBrowseFilterOption[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  items: AdminImageListItem[];
};

export type AdminImageMetaResult = {
  kind: 'local' | 'remote';
  path: string | null;
  value: string;
  origin: AdminImageOrigin | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
  previewSrc: string | null;
};

export type AdminImageAssetRecord = {
  path: string;
  origin: AdminImageOrigin;
  fileName: string;
  owner: string | null;
  ownerLabel: string | null;
  cloudMeta?: Pick<AdminImageCloudListItem, 'url' | 'size' | 'mimeType' | 'lastModified'>;
};

export type AdminImageAssetBrowseMeta = {
  browseGroup: AdminImageBrowseResolvedGroup;
  browseGroupLabel: string;
  browseSubgroup: string;
  browseSubgroupLabel: string | null;
  preferredValue: string | null;
  hiddenFromBrowse: boolean;
};

export type AdminImageBrowseAsset = AdminImageAssetRecord & { value: string } & AdminImageAssetBrowseMeta;

export type ContentCollectionKey = keyof typeof CONTENT_COLLECTION_LABELS;

export type AdminImageContentOwner = {
  value: string;
  label: string;
  aliases: string[];
};

export type LocalImageTarget = {
  path: string;
  value: string;
  origin: AdminImageOrigin;
  previewSrc: string | null;
};

export type AdminImageInspectionMeta = Pick<AdminImageMetaResult, 'width' | 'height' | 'size' | 'mimeType'>;


export const MARKDOWN_EXT_RE = /\.(?:md|mdx)$/i;
export const RELATIVE_CONTENT_ASSET_RE = /!\[[^\]]*]\(([^)]+)\)|<img[^>]+src=["']([^"']+)["']/g;

export const CONTENT_COLLECTION_LABELS = {
  blog: '博客',
  projects: '项目',
  bits: '动态',
  devlog: '更新'
} as const;
export const OWNER_PATH_SEPARATORS = ['/', '.', '-', '_'] as const;
export const ADMIN_IMAGE_SCAN_ROOTS = [
  {
    origin: 'public',
    prefix: 'public',
    pathSegments: ['public']
  },
  {
    origin: 'src/assets',
    prefix: 'src/assets',
    pathSegments: ['src', 'assets']
  },
  {
    origin: 'content',
    prefix: CONTENT_ROOT,
    pathSegments: [CONTENT_ROOT]
  }
] as const satisfies readonly {
  origin: AdminImageOrigin;
  prefix: Exclude<AdminImageDirectory, ''>;
  pathSegments: readonly string[];
}[];

/**
 * 站点级插画统一放在 `public/images/pages/**`，维持「一级目录 === collection 名」的不变量。
 * 保留三个入口，存量图片仍能归到对应子分组。
 */
export const ADMIN_IMAGE_PAGE_ALLOWLIST = [
  { prefix: 'public/images/pages/archive/', subgroup: 'archive', label: 'Archive' },
  { prefix: 'public/images/pages/home/', subgroup: 'home', label: 'Home' },
  { prefix: 'public/images/pages/about/', subgroup: 'about', label: 'About' }
] as const;

export const ADMIN_IMAGE_ASSET_SUBGROUP_LABELS = {
  avatar: '头像',
  other: '其他'
} as const;

export const SYSTEM_ASSET_FILE_PATTERNS = [
  /^favicon(?:[-\w]*)?\.(?:avif|gif|jpe?g|png|svg|webp)$/i,
  /^apple-touch-icon(?:[-\w]*)?\.(?:avif|gif|jpe?g|png|svg|webp)$/i,
  /^preview-[^/]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i
] as const;
