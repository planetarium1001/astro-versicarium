import { parseBlogDateInput } from '../../utils/date-only';
import {
  buildAdminAboutEditorPayload,
  type AdminAboutEditorPayload,
  type AdminAboutEditorValues
} from './content-about-contract';
import {
  getAdminContentCollectionCapability,
  type AdminContentCollectionKey,
  type AdminContentEntryWriteCollectionKey
} from './content-collections';
import {
  AdminContentEntryResolutionError,
  getAdminContentReadOnlyReason,
  loadAdminContentSourceState,
  type AdminContentSourceState
} from './content-entry-source';
import {
  createAdminContentValidationIssue as createIssue,
  isRecord,
  normalizeOptionalText
} from './content-entry-utils';
import type { AdminContentValidationIssue } from './content-entry-contract';

export type AdminBlogEditorValues = {
  title: string;
  description: string;
  date: string;
  publishedAt: string;
  updatedAt: string;
  tagsText: string;
  draft: boolean;
  slug: string;
  cover: string;
  badge: string;
};

export type AdminBitsEditorValues = {
  title: string;
  description: string;
  date: string;
  tagsText: string;
  draft: boolean;
  authorName: string;
  authorAvatar: string;
  imagesText: string;
};

/** projects 是列表型集合：正文走 markdown，frontmatter 字段全部是普通文本框。 */
export type AdminProjectsEditorValues = {
  title: string;
  subtitle: string;
  description: string;
  type: string;
  icon: string;
  image: string;
  date: string;
  draft: boolean;
};

/**
 * devlog 是列表型集合。没有 `links` 字段：外链写在正文 markdown 里，
 * 因此既没有 `linksText`，后台也不需要行编辑器。
 */
export type AdminDevlogEditorValues = {
  title: string;
  date: string;
  project: string;
  kind: string;
  description: string;
  draft: boolean;
};

export type AdminContentEditorValues =
  | AdminBlogEditorValues
  | AdminProjectsEditorValues
  | AdminBitsEditorValues
  | AdminDevlogEditorValues
  | AdminAboutEditorValues;

export type AdminContentWorkspaceEditorValues =
  | AdminBlogEditorValues
  | AdminProjectsEditorValues
  | AdminBitsEditorValues
  | AdminDevlogEditorValues
  | AdminAboutEditorValues;

export type AdminBlogEditorPayload = {
  collection: 'blog';
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  bodyText: string;
  values: AdminBlogEditorValues;
};

export type AdminBitsEditorPayload = {
  collection: 'bits';
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  bodyText: string;
  values: AdminBitsEditorValues;
};

export type AdminProjectsEditorPayload = {
  collection: 'projects';
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  bodyText: string;
  values: AdminProjectsEditorValues;
};

export type AdminDevlogEditorPayload = {
  collection: 'devlog';
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  revision: string;
  relativePath: string;
  writable: true;
  readonlyReason: null;
  bodyText: string;
  values: AdminDevlogEditorValues;
};

export type AdminContentEditorPayload =
  | AdminBlogEditorPayload
  | AdminProjectsEditorPayload
  | AdminBitsEditorPayload
  | AdminDevlogEditorPayload
  | AdminAboutEditorPayload;

export type AdminContentWorkspaceEditorPayload =
  | AdminBlogEditorPayload
  | AdminProjectsEditorPayload
  | AdminBitsEditorPayload
  | AdminDevlogEditorPayload
  | AdminAboutEditorPayload;

export const getStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
    : [];

/** 读取必填字符串字段；类型不符时记录 issue 并返回空串。 */
export const getRequiredStringField = (
  input: Record<string, unknown>,
  field: string,
  issues: AdminContentValidationIssue[]
): string => {
  const value = input[field];
  if (typeof value === 'string') return value;
  issues.push(createIssue(field, `frontmatter.${field} 必须是字符串`));
  return '';
};

/** 读取必填布尔字段；类型不符时记录 issue 并返回 false。 */
export const getRequiredBooleanField = (
  input: Record<string, unknown>,
  field: string,
  issues: AdminContentValidationIssue[]
): boolean => {
  const value = input[field];
  if (typeof value === 'boolean') return value;
  issues.push(createIssue(field, `frontmatter.${field} 必须是布尔值`));
  return false;
};

const getDateString = (frontmatter: Record<string, unknown>, key: string, fallback: string): string => {
  const value = frontmatter[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

const getBlogDateText = (value: unknown): string => {
  const parsed = parseBlogDateInput(value);
  return parsed?.dateText ?? normalizeOptionalText(value);
};

const toBlogEditorValues = (state: AdminContentSourceState): AdminBlogEditorValues => {
  const frontmatter = state.rawFrontmatter;
  const rawDate = getDateString(frontmatter, 'date', '');
  const rawPublishedAt = normalizeOptionalText(frontmatter.publishedAt);
  const dateResult = parseBlogDateInput(rawDate);

  return {
    title: normalizeOptionalText(frontmatter.title),
    description: normalizeOptionalText(frontmatter.description),
    date: dateResult?.dateText ?? rawDate,
    publishedAt: rawPublishedAt || dateResult?.publishedAtText || '',
    updatedAt: getBlogDateText(frontmatter.updatedAt),
    tagsText: getStringArray(frontmatter.tags).join('\n'),
    draft: frontmatter.draft === true,
    slug: normalizeOptionalText(frontmatter.slug),
    cover: normalizeOptionalText(frontmatter.cover),
    badge: normalizeOptionalText(frontmatter.badge)
  };
};

const toBitsEditorValues = (state: AdminContentSourceState): AdminBitsEditorValues => {
  const frontmatter = state.rawFrontmatter;
  const author = isRecord(frontmatter.author) ? frontmatter.author : null;

  return {
    title: normalizeOptionalText(frontmatter.title),
    description: normalizeOptionalText(frontmatter.description),
    date: getDateString(frontmatter, 'date', ''),
    tagsText: getStringArray(frontmatter.tags).join('\n'),
    draft: frontmatter.draft === true,
    authorName: normalizeOptionalText(author?.name),
    authorAvatar: normalizeOptionalText(author?.avatar),
    imagesText: Array.isArray(frontmatter.images) ? JSON.stringify(frontmatter.images, null, 2) : ''
  };
};

const toProjectsEditorValues = (state: AdminContentSourceState): AdminProjectsEditorValues => {
  const frontmatter = state.rawFrontmatter;
  return {
    title: normalizeOptionalText(frontmatter.title),
    subtitle: normalizeOptionalText(frontmatter.subtitle),
    description: normalizeOptionalText(frontmatter.description),
    type: normalizeOptionalText(frontmatter.type),
    icon: normalizeOptionalText(frontmatter.icon),
    image: normalizeOptionalText(frontmatter.image),
    date: getDateString(frontmatter, 'date', ''),
    draft: frontmatter.draft === true
  };
};

const toDevlogEditorValues = (state: AdminContentSourceState): AdminDevlogEditorValues => {
  const frontmatter = state.rawFrontmatter;
  return {
    title: normalizeOptionalText(frontmatter.title),
    date: getDateString(frontmatter, 'date', ''),
    project: normalizeOptionalText(frontmatter.project),
    kind: normalizeOptionalText(frontmatter.kind),
    description: normalizeOptionalText(frontmatter.description),
    draft: frontmatter.draft === true
  };
};

export const buildAdminContentEntryEditorPayloadFromState = (
  state: AdminContentSourceState
): AdminContentEditorPayload => {
  const { collection } = state;
  if (collection === 'blog') {
    return {
      collection,
      entryId: state.entryId,
      publicEntryId: state.publicEntryId,
      defaultPublicSlug: state.defaultPublicSlug,
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      bodyText: state.bodyText,
      values: toBlogEditorValues(state)
    };
  }

  if (collection === 'projects') {
    return {
      collection,
      entryId: state.entryId,
      publicEntryId: state.publicEntryId,
      defaultPublicSlug: state.defaultPublicSlug,
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      bodyText: state.bodyText,
      values: toProjectsEditorValues(state)
    };
  }

  if (collection === 'bits') {
    return {
      collection,
      entryId: state.entryId,
      publicEntryId: state.publicEntryId,
      defaultPublicSlug: state.defaultPublicSlug,
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      bodyText: state.bodyText,
      values: toBitsEditorValues(state)
    };
  }

  if (collection === 'devlog') {
    return {
      collection,
      entryId: state.entryId,
      publicEntryId: state.publicEntryId,
      defaultPublicSlug: state.defaultPublicSlug,
      revision: state.revision,
      relativePath: state.relativePath,
      writable: true,
      readonlyReason: null,
      bodyText: state.bodyText,
      values: toDevlogEditorValues(state)
    };
  }

  return buildAdminAboutEditorPayload(state);
};

/** 校验 collection 支持条目写盘，否则抛出条目解析错误。 */
export const assertAdminContentEntryWritable = (collection: AdminContentCollectionKey): void => {
  if (getAdminContentCollectionCapability(collection).entryWritable) return;
  throw new AdminContentEntryResolutionError(
    'invalid-entry-id',
    getAdminContentReadOnlyReason(collection) ?? `当前 collection 暂不支持写盘：${collection}`
  );
};

export const readAdminContentEntryEditorPayload = async (
  collection: AdminContentEntryWriteCollectionKey,
  entryId: string
): Promise<AdminContentEditorPayload> => {
  assertAdminContentEntryWritable(collection);

  return buildAdminContentEntryEditorPayloadFromState(await loadAdminContentSourceState(collection, entryId));
};
