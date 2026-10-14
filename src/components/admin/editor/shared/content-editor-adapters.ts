import type {
  AdminBitsEditorValues,
  AdminContentWorkspaceEditorValues,
  AdminBlogEditorValues,
  AdminDevlogEditorValues,
  AdminProjectsEditorValues
} from '../../../../lib/admin-console/content-editor-payload';
import type { AdminContentWriteCollectionKey } from '../../../../lib/admin-console/content-collections';
import type { AdminAboutEditorValues } from '../../../../lib/admin-console/content-about-contract';
import { getAdminContentCollectionCapability } from '../../../../lib/admin-console/content-collections';
import {
  getAdminAboutWriteFieldLabel,
  isAdminAboutFrontmatterIssuePath
} from '../../../../lib/admin-console/content-about-contract';
import { hasOwn } from '../../../../lib/admin-console/content-entry-utils';

type ContentEditorCapabilities = {
  body: boolean;
  preview: boolean;
  bodyImageInsert: boolean;
  bodyGalleryInsert: boolean;
  imageArray: boolean;
  blogOutline: boolean;
  delete: boolean;
};

type ContentEditorAdapter<
  Values extends AdminContentWorkspaceEditorValues = AdminContentWorkspaceEditorValues
> = {
  collection: AdminContentWriteCollectionKey;
  capabilities: ContentEditorCapabilities;
  frontmatterIssuePaths: ReadonlySet<string>;
  isFrontmatterIssuePath: (path: string) => boolean;
  cloneValues: (value: Values) => Values;
  isEqualValues: (left: Values | null, right: Values | null) => boolean;
  getWriteFieldLabel: (field: string) => string;
  getDeleteTitle: (value: Values, entryId: string) => string;
};

const cloneBlogValues = (value: AdminBlogEditorValues): AdminBlogEditorValues => ({
  title: value.title,
  description: value.description,
  date: value.date,
  publishedAt: value.publishedAt,
  updatedAt: value.updatedAt,
  tagsText: value.tagsText,
  draft: value.draft,
  slug: value.slug,
  cover: value.cover,
  badge: value.badge
});

const cloneBitsValues = (value: AdminBitsEditorValues): AdminBitsEditorValues => ({
  title: value.title,
  description: value.description,
  date: value.date,
  tagsText: value.tagsText,
  draft: value.draft,
  authorName: value.authorName,
  authorAvatar: value.authorAvatar,
  imagesText: value.imagesText
});

const cloneProjectsValues = (value: AdminProjectsEditorValues): AdminProjectsEditorValues => ({
  title: value.title,
  subtitle: value.subtitle,
  description: value.description,
  type: value.type,
  icon: value.icon,
  date: value.date,
  draft: value.draft
});

const cloneDevlogValues = (value: AdminDevlogEditorValues): AdminDevlogEditorValues => ({
  title: value.title,
  date: value.date,
  project: value.project,
  kind: value.kind,
  description: value.description,
  draft: value.draft
});

const cloneAboutValues = (): AdminAboutEditorValues => ({});

export const isBlogEditorValues = (value: AdminContentWorkspaceEditorValues | null): value is AdminBlogEditorValues =>
  Boolean(value && 'publishedAt' in value && 'updatedAt' in value && 'cover' in value && 'badge' in value);

export const isBitsEditorValues = (value: AdminContentWorkspaceEditorValues | null): value is AdminBitsEditorValues =>
  Boolean(value && 'authorName' in value && 'authorAvatar' in value && 'imagesText' in value);

export const isProjectsEditorValues = (
  value: AdminContentWorkspaceEditorValues | null
): value is AdminProjectsEditorValues =>
  // projects 是唯一同时有 subtitle 与 icon 的列表型集合。
  Boolean(value && 'subtitle' in value && 'icon' in value);

export const isDevlogEditorValues = (
  value: AdminContentWorkspaceEditorValues | null
): value is AdminDevlogEditorValues =>
  // devlog 没有 links 字段，用 description 判别（只有 devlog 同时有 project 与 description）。
  Boolean(value && 'project' in value && 'description' in value);

// 编辑器值是扁平字段袋（仅字符串/布尔基本类型），按 own 键名与值逐项比较即可，不依赖键顺序。
const isEqualContentEditorValues = <Values extends AdminContentWorkspaceEditorValues>(
  left: Values | null,
  right: Values | null
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  return keys.length === Object.keys(rightRecord).length
    && keys.every((key) => hasOwn(rightRecord, key) && leftRecord[key] === rightRecord[key]);
};

const getContentWriteFieldLabel = (
  field: string,
  labels: Readonly<Record<string, string>>
): string =>
  labels[field] ?? field;

const hasExactFrontmatterIssuePath = (paths: ReadonlySet<string>, path: string): boolean =>
  paths.has(path);

const BLOG_FRONTMATTER_ISSUE_PATHS = new Set([
  'title',
  'date',
  'publishedAt',
  'updatedAt',
  'description',
  'tags',
  'slug',
  'badge',
  'cover'
]);

const BITS_FRONTMATTER_ISSUE_PATHS = new Set([
  'title',
  'date',
  'description',
  'tags',
  'draft',
  'authorName',
  'authorAvatar',
  'imagesText'
]);

const isBitsFrontmatterIssuePath = (path: string): boolean =>
  BITS_FRONTMATTER_ISSUE_PATHS.has(path) || path.startsWith('images[');

const PROJECTS_FRONTMATTER_ISSUE_PATHS = new Set([
  'title',
  'subtitle',
  'description',
  'type',
  'icon',
  'date',
  'draft'
]);

const DEVLOG_FRONTMATTER_ISSUE_PATHS = new Set([
  'title',
  'date',
  'project',
  'kind',
  'description',
  'draft'
]);

const PROJECTS_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  subtitle: '副标题',
  description: '描述',
  type: '类型',
  icon: '图标',
  date: '日期',
  draft: '草稿状态',
  body: '正文'
};

const DEVLOG_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  date: '日期',
  project: '项目',
  kind: '类型标签',
  description: '摘要',
  draft: '草稿状态',
  body: '正文'
};

const BLOG_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  description: '摘要',
  date: '日期',
  publishedAt: '发布时间',
  updatedAt: '更新日期',
  tags: '标签',
  draft: '草稿状态',
  slug: '链接别名',
  cover: '封面图',
  badge: '徽标',
  body: '正文'
};

const BITS_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  description: '摘要',
  date: '时间',
  tags: '标签',
  draft: '草稿状态',
  authorName: '作者名称',
  authorAvatar: '作者头像',
  author: '作者',
  images: '图片',
  imagesText: '图片',
  body: '正文'
};

const buildContentEditorCapabilities = (
  collection: AdminContentWriteCollectionKey,
  editorCapabilities: Pick<
    ContentEditorCapabilities,
    'body' | 'preview' | 'bodyImageInsert' | 'bodyGalleryInsert' | 'imageArray' | 'blogOutline'
  >
): ContentEditorCapabilities => {
  const collectionCapability = getAdminContentCollectionCapability(collection);
  return {
    ...editorCapabilities,
    delete: collectionCapability.deletable
  };
};

const BLOG_ADAPTER: ContentEditorAdapter<AdminBlogEditorValues> = {
  collection: 'blog',
  capabilities: buildContentEditorCapabilities('blog', {
    body: true,
    preview: true,
    bodyImageInsert: true,
    bodyGalleryInsert: true,
    imageArray: false,
    blogOutline: true
  }),
  frontmatterIssuePaths: BLOG_FRONTMATTER_ISSUE_PATHS,
  isFrontmatterIssuePath: (path) => hasExactFrontmatterIssuePath(BLOG_FRONTMATTER_ISSUE_PATHS, path),
  cloneValues: cloneBlogValues,
  isEqualValues: isEqualContentEditorValues,
  getWriteFieldLabel: (field) => getContentWriteFieldLabel(field, BLOG_FIELD_LABELS),
  getDeleteTitle: (value, entryId) => value.title || entryId
};

const BITS_ADAPTER: ContentEditorAdapter<AdminBitsEditorValues> = {
  collection: 'bits',
  capabilities: buildContentEditorCapabilities('bits', {
    body: true,
    preview: true,
    bodyImageInsert: false,
    bodyGalleryInsert: false,
    imageArray: true,
    blogOutline: false
  }),
  frontmatterIssuePaths: BITS_FRONTMATTER_ISSUE_PATHS,
  isFrontmatterIssuePath: isBitsFrontmatterIssuePath,
  cloneValues: cloneBitsValues,
  isEqualValues: isEqualContentEditorValues,
  getWriteFieldLabel: (field) => getContentWriteFieldLabel(field, BITS_FIELD_LABELS),
  getDeleteTitle: (value, entryId) => value.title || entryId
};

const PROJECTS_ADAPTER: ContentEditorAdapter<AdminProjectsEditorValues> = {
  collection: 'projects',
  capabilities: buildContentEditorCapabilities('projects', {
    body: true,
    preview: true,
    bodyImageInsert: true,
    bodyGalleryInsert: true,
    imageArray: false,
    blogOutline: false
  }),
  frontmatterIssuePaths: PROJECTS_FRONTMATTER_ISSUE_PATHS,
  isFrontmatterIssuePath: (path) => hasExactFrontmatterIssuePath(PROJECTS_FRONTMATTER_ISSUE_PATHS, path),
  cloneValues: cloneProjectsValues,
  isEqualValues: isEqualContentEditorValues,
  getWriteFieldLabel: (field) => getContentWriteFieldLabel(field, PROJECTS_FIELD_LABELS),
  getDeleteTitle: (value, entryId) => value.title || entryId
};

const DEVLOG_ADAPTER: ContentEditorAdapter<AdminDevlogEditorValues> = {
  collection: 'devlog',
  capabilities: buildContentEditorCapabilities('devlog', {
    body: true,
    preview: true,
    bodyImageInsert: true,
    bodyGalleryInsert: true,
    imageArray: false,
    blogOutline: false
  }),
  frontmatterIssuePaths: DEVLOG_FRONTMATTER_ISSUE_PATHS,
  isFrontmatterIssuePath: (path) => hasExactFrontmatterIssuePath(DEVLOG_FRONTMATTER_ISSUE_PATHS, path),
  cloneValues: cloneDevlogValues,
  isEqualValues: isEqualContentEditorValues,
  getWriteFieldLabel: (field) => getContentWriteFieldLabel(field, DEVLOG_FIELD_LABELS),
  getDeleteTitle: (value, entryId) => value.title || entryId
};

const ABOUT_ADAPTER: ContentEditorAdapter<AdminAboutEditorValues> = {
  collection: 'about',
  capabilities: buildContentEditorCapabilities('about', {
    body: true,
    preview: true,
    bodyImageInsert: false,
    bodyGalleryInsert: false,
    imageArray: false,
    blogOutline: false
  }),
  frontmatterIssuePaths: new Set<string>(),
  isFrontmatterIssuePath: isAdminAboutFrontmatterIssuePath,
  cloneValues: cloneAboutValues,
  isEqualValues: isEqualContentEditorValues,
  getWriteFieldLabel: getAdminAboutWriteFieldLabel,
  getDeleteTitle: () => '关于'
};

type ContentEditorAdapterMap = {
  blog: ContentEditorAdapter<AdminBlogEditorValues>;
  projects: ContentEditorAdapter<AdminProjectsEditorValues>;
  bits: ContentEditorAdapter<AdminBitsEditorValues>;
  devlog: ContentEditorAdapter<AdminDevlogEditorValues>;
  about: ContentEditorAdapter<AdminAboutEditorValues>;
};

const CONTENT_EDITOR_ADAPTERS = {
  blog: BLOG_ADAPTER,
  projects: PROJECTS_ADAPTER,
  bits: BITS_ADAPTER,
  devlog: DEVLOG_ADAPTER,
  about: ABOUT_ADAPTER
} as const satisfies ContentEditorAdapterMap;

export const getContentEditorAdapter = <Collection extends AdminContentWriteCollectionKey>(
  collection: Collection
): ContentEditorAdapterMap[Collection] =>
  CONTENT_EDITOR_ADAPTERS[collection];
