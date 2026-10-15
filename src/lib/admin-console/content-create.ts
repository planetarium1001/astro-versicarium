import { createHash } from 'node:crypto';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug,
  slugifyEntryTitle
} from '../../utils/slug-rules';
import { buildAdminContentEntryEditorPayloadFromState } from './content-editor-payload';
import type { AdminBitsEditorValues, AdminBlogEditorValues } from './content-editor-payload';
import {
  buildBlogFrontmatterFromValues,
  loadBlogPublicSlugUsage,
  type AdminBlogFrontmatter,
  type AdminBlogPublicSlugUsage,
  parseAdminBlogEditorInput,
  validateBlogPublicSlug
} from './content-blog-frontmatter';
import type { AdminContentValidationIssue } from './content-entry-contract';
import {
  type AdminContentCreatableCollectionKey
} from './content-collections';
import {
  AdminContentEntryResolutionError,
  getAdminContentEntrySourcePathCandidates,
  loadAdminContentSourceState,
  toAdminContentRelativeProjectPath
} from './content-entry-source';
import {
  createAdminContentValidationIssue as createIssue,
  isRecord
} from './content-entry-utils';
import { getAdminContentEntryEditHref } from './content-routes';
import {
  buildBitsFrontmatterFromValues,
  parseAdminDevlogEditorInput,
  parseAdminProjectsEditorInput
} from './content-write-plan';
import { patchMarkdownFrontmatter } from './frontmatter';

type AdminContentCreateBaseInput = {
  frontmatter: unknown;
};

type AdminBlogContentCreateInput = AdminContentCreateBaseInput & {
  collection: 'blog';
  entryId: string;
};

type AdminBitsContentCreateInput = AdminContentCreateBaseInput & {
  collection: 'bits';
};

type AdminTitleListContentCreateInput = AdminContentCreateBaseInput & {
  collection: 'projects' | 'devlog';
  entryId: string;
};

type AdminContentCreateInput =
  | AdminBlogContentCreateInput
  | AdminTitleListContentCreateInput
  | AdminBitsContentCreateInput;

type AdminContentCreatePlan = {
  collection: AdminContentCreatableCollectionKey;
  entryId: string;
  publicEntryId: string;
  defaultPublicSlug: string;
  sourcePath: string;
  relativePath: string;
  sourceText: string;
  editHref: string;
  issues: AdminContentValidationIssue[];
};

const EMPTY_MARKDOWN_SOURCE = '---\n---\n\n';
const AUTO_SLUG_HASH_LENGTHS = [4, 5, 6] as const;
const BITS_CREATE_DATETIME_RE = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::00)?(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/;

/**
 * 规范化创建用的 entryId：去 `.md` / 去 `/index` / 拒绝 `.` 与 `..`，并对每个路径段做一次 slug 化。
 * 客户端用 `buildContentEntryId` 生成 `YYYY-MM-DD-title`，但接口也可能被手工调用，
 * 带空格或特殊字符的文件名会破坏目录结构。`slugifyEntryTitle` 对已合规的 id 幂等。
 */
const normalizeCreateEntryId = (entryId: string): string => {
  const withoutExtension = entryId.trim().replace(/\\/g, '/').replace(/\.md$/i, '');
  const normalized = withoutExtension.endsWith('/index')
    ? withoutExtension.slice(0, -'/index'.length)
    : withoutExtension;
  if (!normalized || normalized.startsWith('/') || normalized.includes('//')) {
    throw new AdminContentEntryResolutionError('invalid-entry-id', `不支持的 content entryId：${entryId}`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new AdminContentEntryResolutionError('invalid-entry-id', `不支持的 content entryId：${entryId}`);
  }

  const slugified = segments.map((segment) => slugifyEntryTitle(segment));
  if (slugified.some((segment) => !segment)) {
    throw new AdminContentEntryResolutionError('invalid-entry-id', `entryId 不能 slug 化为空：${entryId}`);
  }

  return slugified.join('/');
};

const buildBlogCreateValues = (values: AdminBlogEditorValues): AdminBlogEditorValues => ({
  ...values,
  draft: true
});

const buildBitsCreateValues = (date: string): AdminBitsEditorValues => ({
  title: '',
  description: '',
  date,
  tagsText: '',
  draft: true,
  authorName: '',
  authorAvatar: '',
  imagesText: ''
});

const getShortBlogDateSlugPart = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '000000';

  const year = match[1] ?? '0000';
  const month = match[2] ?? '00';
  const day = match[3] ?? '00';
  return `${year.slice(-2)}${month}${day}`;
};

const buildStableSlugHash = (
  parts: readonly string[],
  length: number
): string => {
  const digest = createHash('sha1').update(parts.join('\n')).digest('hex').slice(0, 12);
  return Number.parseInt(digest, 16).toString(36).padStart(length, '0').slice(0, length);
};

const isBlogPublicSlugAvailable = async (
  publicEntryId: string,
  slugUsage: AdminBlogPublicSlugUsage,
  slug?: string
): Promise<boolean> => {
  const frontmatter: Pick<AdminBlogFrontmatter, 'slug'> = slug === undefined ? {} : { slug };
  return (await validateBlogPublicSlug({ publicEntryId }, frontmatter, { slugUsage })).length === 0;
};

const buildFallbackBlogPublicSlug = (
  frontmatter: AdminBlogFrontmatter,
  entryId: string,
  hashLength: number
): string =>
  `blog-${getShortBlogDateSlugPart(frontmatter.date)}-${buildStableSlugHash(
    [frontmatter.title, frontmatter.date, entryId],
    hashLength
  )}`;

const resolveBlogCreateFrontmatterSlug = async ({
  entryId,
  publicEntryId,
  frontmatter,
  slugUsage
}: {
  entryId: string;
  publicEntryId: string;
  frontmatter: AdminBlogFrontmatter;
  slugUsage: AdminBlogPublicSlugUsage;
}): Promise<AdminBlogFrontmatter> => {
  if (frontmatter.slug?.trim()) return frontmatter;
  if (await isBlogPublicSlugAvailable(publicEntryId, slugUsage)) return frontmatter;

  const titleSlug = flattenEntryIdToSlug(contentSourceEntryIdToPublicEntryId(frontmatter.title));
  if (titleSlug && await isBlogPublicSlugAvailable(publicEntryId, slugUsage, titleSlug)) {
    return { ...frontmatter, slug: titleSlug };
  }

  for (const hashLength of AUTO_SLUG_HASH_LENGTHS) {
    const slug = buildFallbackBlogPublicSlug(frontmatter, entryId, hashLength);
    if (await isBlogPublicSlugAvailable(publicEntryId, slugUsage, slug)) {
      return { ...frontmatter, slug };
    }
  }

  return {
    ...frontmatter,
    slug: buildFallbackBlogPublicSlug(
      frontmatter,
      entryId,
      AUTO_SLUG_HASH_LENGTHS.at(-1) ?? 6
    )
  };
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const findExistingFile = async (filePaths: readonly string[]): Promise<string | null> => {
  for (const filePath of filePaths) {
    if (await fileExists(filePath)) return filePath;
  }
  return null;
};

const isValidCalendarDate = (year: string, month: string, day: string): boolean => {
  const normalized = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return normalized.getUTCFullYear() === Number(year)
    && normalized.getUTCMonth() + 1 === Number(month)
    && normalized.getUTCDate() === Number(day);
};

const normalizeBitsCreateOffset = (offset: string): string =>
  offset === 'Z' || offset.includes(':') ? offset : `${offset.slice(0, 3)}:${offset.slice(3)}`;

const parseBitsCreateDate = (
  frontmatter: unknown
): { entryId?: string; date?: string; issues: AdminContentValidationIssue[] } => {
  if (!isRecord(frontmatter)) {
    return { issues: [createIssue('frontmatter', 'frontmatter 必须是对象')] };
  }

  const input = typeof frontmatter.date === 'string' ? frontmatter.date.trim() : '';
  if (!input) {
    return { issues: [createIssue('date', 'bits.date 不能为空')] };
  }

  const match = BITS_CREATE_DATETIME_RE.exec(input);
  if (!match) {
    return { issues: [createIssue('date', 'bits.date 必须是带时区的 YYYY-MM-DDTHH:mm:ss±HH:mm 格式')] };
  }

  const [, year, month, day, hour, minute, offset] = match;
  if (!year || !month || !day || !hour || !minute || !offset || !isValidCalendarDate(year, month, day)) {
    return { issues: [createIssue('date', 'bits.date 不是合法日期时间')] };
  }

  return {
    entryId: `bits-${year}-${month}-${day}-${hour}${minute}`,
    date: `${year}-${month}-${day}T${hour}:${minute}:00${normalizeBitsCreateOffset(offset)}`,
    issues: []
  };
};

const assertUnsupportedCreateCollection = (collection: never): never => {
  throw new AdminContentEntryResolutionError('invalid-entry-id', `当前 collection 暂未实现新增：${String(collection)}`);
};

const buildBlogContentCreatePlan = async (
  input: AdminBlogContentCreateInput
): Promise<AdminContentCreatePlan> => {
  const collection = input.collection;
  const entryId = normalizeCreateEntryId(input.entryId);
  const sourcePathCandidates = getAdminContentEntrySourcePathCandidates(collection, entryId);
  const [sourcePath] = sourcePathCandidates;
  if (!sourcePath) {
    throw new AdminContentEntryResolutionError('source-not-found', `未找到 content 源文件候选：${collection}/${entryId}`);
  }
  const relativePath = toAdminContentRelativeProjectPath(sourcePath);
  const publicEntryId = contentSourceEntryIdToPublicEntryId(entryId) || entryId;
  const defaultPublicSlug = flattenEntryIdToSlug(publicEntryId);

  const parsed = parseAdminBlogEditorInput(input.frontmatter);
  if (!parsed.values) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: parsed.issues
    };
  }

  const next = buildBlogFrontmatterFromValues(buildBlogCreateValues(parsed.values));
  if (!next.frontmatter) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: next.issues
    };
  }

  const existingSourcePath = await findExistingFile(sourcePathCandidates);
  if (existingSourcePath) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: [createIssue('entryId', `源文件已存在：${toAdminContentRelativeProjectPath(existingSourcePath)}`)]
    };
  }

  const slugUsage = await loadBlogPublicSlugUsage();
  const frontmatter = await resolveBlogCreateFrontmatterSlug({
    entryId,
    publicEntryId,
    frontmatter: next.frontmatter,
    slugUsage
  });

  const slugIssues = await validateBlogPublicSlug({ publicEntryId }, frontmatter, { slugUsage });
  if (slugIssues.length > 0) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref: getAdminContentEntryEditHref(collection, entryId),
      issues: slugIssues
    };
  }

  return {
    collection,
    entryId,
    publicEntryId,
    defaultPublicSlug,
    sourcePath,
    relativePath,
    sourceText: patchMarkdownFrontmatter(
      EMPTY_MARKDOWN_SOURCE,
      Object.entries(frontmatter).map(([key, value]) => ({
        path: [key],
        value,
        action: 'set' as const
      }))
    ),
    editHref: getAdminContentEntryEditHref(collection, entryId),
    issues: []
  };
};

const buildBitsContentCreatePlan = async (
  input: AdminBitsContentCreateInput
): Promise<AdminContentCreatePlan> => {
  const collection = input.collection;
  const parsedDate = parseBitsCreateDate(input.frontmatter);
  if (!parsedDate.entryId || !parsedDate.date) {
    return {
      collection,
      entryId: '',
      publicEntryId: '',
      defaultPublicSlug: '',
      sourcePath: '',
      relativePath: '',
      sourceText: '',
      editHref: '',
      issues: parsedDate.issues
    };
  }

  const entryId = parsedDate.entryId;
  const sourcePathCandidates = getAdminContentEntrySourcePathCandidates(collection, entryId);
  const [sourcePath] = sourcePathCandidates;
  if (!sourcePath) {
    throw new AdminContentEntryResolutionError('source-not-found', `未找到 content 源文件候选：${collection}/${entryId}`);
  }
  const relativePath = toAdminContentRelativeProjectPath(sourcePath);
  const publicEntryId = contentSourceEntryIdToPublicEntryId(entryId) || entryId;
  const defaultPublicSlug = flattenEntryIdToSlug(publicEntryId);
  const editHref = getAdminContentEntryEditHref(collection, entryId);

  const existingSourcePath = await findExistingFile(sourcePathCandidates);
  if (existingSourcePath) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref,
      issues: [createIssue('entryId', `源文件已存在：${toAdminContentRelativeProjectPath(existingSourcePath)}`)]
    };
  }

  const next = buildBitsFrontmatterFromValues(buildBitsCreateValues(parsedDate.date));
  if (!next.frontmatter) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref,
      issues: next.issues
    };
  }

  return {
    collection,
    entryId,
    publicEntryId,
    defaultPublicSlug,
    sourcePath,
    relativePath,
    sourceText: patchMarkdownFrontmatter(
      EMPTY_MARKDOWN_SOURCE,
      Object.entries(next.frontmatter).map(([key, value]) => ({
        path: [key],
        value,
        action: 'set' as const
      }))
    ),
    editHref,
    issues: []
  };
};

/**
 * projects / devlog 都是列表型集合，创建计划结构一致，共用一份实现。
 * 新字段不在建条目时写入，由编辑页的字段矩阵负责。
 */
const buildTitleListContentCreatePlan = async (
  input: AdminTitleListContentCreateInput
): Promise<AdminContentCreatePlan> => {
  const collection = input.collection;
  const parsed = collection === 'projects'
    ? parseAdminProjectsEditorInput(input.frontmatter)
    : parseAdminDevlogEditorInput(input.frontmatter);
  if (!parsed.values) {
    return {
      collection,
      entryId: '',
      publicEntryId: '',
      defaultPublicSlug: '',
      sourcePath: '',
      relativePath: '',
      sourceText: '',
      editHref: '',
      issues: parsed.issues
    };
  }

  const entryId = normalizeCreateEntryId(input.entryId);
  const sourcePathCandidates = getAdminContentEntrySourcePathCandidates(collection, entryId);
  const [sourcePath] = sourcePathCandidates;
  if (!sourcePath) {
    throw new AdminContentEntryResolutionError('source-not-found', `未找到 content 源文件候选：${collection}/${entryId}`);
  }
  const relativePath = toAdminContentRelativeProjectPath(sourcePath);
  const publicEntryId = contentSourceEntryIdToPublicEntryId(entryId) || entryId;
  const defaultPublicSlug = flattenEntryIdToSlug(publicEntryId);
  const editHref = getAdminContentEntryEditHref(collection, entryId);

  const existingSourcePath = await findExistingFile(sourcePathCandidates);
  if (existingSourcePath) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref,
      issues: [createIssue('entryId', `源文件已存在：${toAdminContentRelativeProjectPath(existingSourcePath)}`)]
    };
  }

  const title = parsed.values.title.trim();
  if (!title) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref,
      issues: [createIssue('title', 'frontmatter.title 不能为空')]
    };
  }

  const dateText = parsed.values.date.trim();
  const date = dateText ? new Date(dateText) : new Date();
  if (Number.isNaN(date.valueOf())) {
    return {
      collection,
      entryId,
      publicEntryId,
      defaultPublicSlug,
      sourcePath,
      relativePath,
      sourceText: '',
      editHref,
      issues: [createIssue('date', 'frontmatter.date 必须是有效的 YYYY-MM-DD 或 ISO 8601 日期时间')]
    };
  }

  const frontmatter: Record<string, unknown> = {
    title,
    date: date.toISOString(),
    draft: true
  };

  return {
    collection,
    entryId,
    publicEntryId,
    defaultPublicSlug,
    sourcePath,
    relativePath,
    sourceText: patchMarkdownFrontmatter(
      EMPTY_MARKDOWN_SOURCE,
      Object.entries(frontmatter).map(([key, value]) => ({
        path: [key],
        value,
        action: 'set' as const
      }))
    ),
    editHref,
    issues: []
  };
};

export const buildAdminContentCreatePlan = async (
  input: AdminContentCreateInput
): Promise<AdminContentCreatePlan> => {
  switch (input.collection) {
    case 'blog':
      return buildBlogContentCreatePlan(input);
    case 'projects':
    case 'devlog':
      return buildTitleListContentCreatePlan(input);
    case 'bits':
      return buildBitsContentCreatePlan(input);
    default:
      return assertUnsupportedCreateCollection(input);
  }
};

export const ensureAdminContentCreateParentDirectory = async (
  plan: Pick<AdminContentCreatePlan, 'sourcePath'>
): Promise<void> => {
  await mkdir(path.dirname(plan.sourcePath), { recursive: true });
};

export const readAdminContentCreatedEditorPayload = async (
  plan: Pick<AdminContentCreatePlan, 'collection' | 'entryId' | 'editHref'>
) => ({
  editHref: plan.editHref,
  payload: buildAdminContentEntryEditorPayloadFromState(
    await loadAdminContentSourceState(plan.collection, plan.entryId)
  )
});
