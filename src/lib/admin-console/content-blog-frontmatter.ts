import {
  parseBlogDateInput,
  parseBlogPublishedAtInput
} from '../../utils/date-only';
import {
  BLOG_PUBLIC_SLUG_RE,
  RESERVED_BLOG_SLUGS,
  contentSourceEntryIdToPublicEntryId,
  flattenEntryIdToSlug
} from '../../utils/slug-rules';
import { isRoutableTagKey, toTagKey } from '../tags';
import {
  getRequiredBooleanField,
  getRequiredStringField,
  type AdminBlogEditorValues
} from './content-editor-payload';
import type { AdminContentValidationIssue } from './content-entry-contract';
import {
  listAdminCollectionSourceFiles,
  readAdminSourceFrontmatterRecord,
  resolveAdminContentEntryIdFromSourcePath
} from './content-entry-source';
import {
  createAdminContentValidationIssue as createIssue,
  hasOwn,
  isRecord,
  normalizeOptionalText
} from './content-entry-utils';

export type AdminBlogFrontmatter = {
  title: string;
  description?: string;
  date: string;
  publishedAt?: string;
  updatedAt?: string;
  tags: string[];
  draft: boolean;
  slug?: string;
  series?: string;
  versionLabel?: string;
  versionName?: string;
  versionSummary?: string;
  versionOrder?: number;
  ogImage?: string;
  ogImageAlt?: string;
  badge?: string;
};

export type AdminBlogPublicSlugUsage = ReadonlyMap<string, readonly string[]>;
export type AdminBlogPublicSlugIndex = {
  usage: AdminBlogPublicSlugUsage;
  seriesByEntryId: ReadonlyMap<string, string | null>;
};

export type AdminBlogOptionalInputMode = 'missing' | 'present';

const getOptionalEditorString = (input: Record<string, unknown>, field: string): string =>
  typeof input[field] === 'string' ? input[field] : '';

export const parseAdminBlogEditorInput = (
  input: unknown
): {
  values?: AdminBlogEditorValues;
  publishedAtInputMode: AdminBlogOptionalInputMode;
  updatedAtInputMode: AdminBlogOptionalInputMode;
  issues: AdminContentValidationIssue[];
} => {
  if (!isRecord(input)) {
    return {
      publishedAtInputMode: 'missing',
      updatedAtInputMode: 'missing',
      issues: [createIssue('frontmatter', 'frontmatter 必须是对象')]
    };
  }

  const issues: AdminContentValidationIssue[] = [];
  const rawPublishedAtInput = input.publishedAt;
  const hasPublishedAtInput = hasOwn(input, 'publishedAt')
    && typeof rawPublishedAtInput === 'string';
  const rawUpdatedAtInput = input.updatedAt;
  const hasUpdatedAtInput = hasOwn(input, 'updatedAt')
    && typeof rawUpdatedAtInput === 'string';
  const values: AdminBlogEditorValues = {
    title: getRequiredStringField(input, 'title', issues),
    description: getRequiredStringField(input, 'description', issues),
    date: getRequiredStringField(input, 'date', issues),
    publishedAt: hasPublishedAtInput ? rawPublishedAtInput : '',
    updatedAt: hasUpdatedAtInput ? rawUpdatedAtInput : '',
    tagsText: getRequiredStringField(input, 'tagsText', issues),
    draft: getRequiredBooleanField(input, 'draft', issues),

    slug: getRequiredStringField(input, 'slug', issues),
    series: getOptionalEditorString(input, 'series'),
    versionLabel: getOptionalEditorString(input, 'versionLabel'),
    versionName: getOptionalEditorString(input, 'versionName'),
    versionSummary: getOptionalEditorString(input, 'versionSummary'),
    versionOrder: getOptionalEditorString(input, 'versionOrder'),
    ogImage: getOptionalEditorString(input, 'ogImage'),
    ogImageAlt: getOptionalEditorString(input, 'ogImageAlt'),
    badge: getRequiredStringField(input, 'badge', issues)
  };

  return issues.length > 0
    ? {
        publishedAtInputMode: hasPublishedAtInput ? 'present' : 'missing',
        updatedAtInputMode: hasUpdatedAtInput ? 'present' : 'missing',
        issues
      }
    : {
        values,
        publishedAtInputMode: hasPublishedAtInput ? 'present' : 'missing',
        updatedAtInputMode: hasUpdatedAtInput ? 'present' : 'missing',
        issues
      };
};

export const parseTagsText = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

export const validateRoutableTags = (tags: readonly string[]): AdminContentValidationIssue[] =>
  tags
    .filter((tag) => !isRoutableTagKey(toTagKey(tag)))
    .map((tag) => createIssue('tagsText', `tag "${tag}" 规范化后无法生成可路由的归档路由键，请调整该标签`));

const resolveDefaultPublicEntryId = (sourceEntryId: string): string => {
  const publicEntryId = contentSourceEntryIdToPublicEntryId(sourceEntryId);
  return publicEntryId || sourceEntryId;
};

const resolveBlogPublicSlug = (publicEntryId: string, explicitSlug?: string): string =>
  explicitSlug && explicitSlug.trim().length > 0
    ? explicitSlug.trim()
    : flattenEntryIdToSlug(publicEntryId);

export const loadBlogPublicSlugIndex = async (): Promise<AdminBlogPublicSlugIndex> => {
  const usage = new Map<string, string[]>();
  const seriesByEntryId = new Map<string, string | null>();
  const blogFiles = await listAdminCollectionSourceFiles('blog');
  for (const filePath of blogFiles) {
    const candidateEntryId = resolveAdminContentEntryIdFromSourcePath('blog', filePath);
    const frontmatterRecord = await readAdminSourceFrontmatterRecord(filePath);
    const candidatePublicEntryId = resolveDefaultPublicEntryId(candidateEntryId);
    const candidateSlug = resolveBlogPublicSlug(candidatePublicEntryId, normalizeOptionalText(frontmatterRecord.slug));
    const entryIds = usage.get(candidateSlug);
    if (entryIds) {
      entryIds.push(candidateEntryId);
    } else {
      usage.set(candidateSlug, [candidateEntryId]);
    }
    seriesByEntryId.set(candidateEntryId, normalizeOptionalText(frontmatterRecord.series) || null);
  }
  return { usage, seriesByEntryId };
};

export const loadBlogPublicSlugUsage = async (): Promise<AdminBlogPublicSlugUsage> =>
  (await loadBlogPublicSlugIndex()).usage;

export const validateBlogPublicSlug = async (
  state: {
    entryId?: string;
    publicEntryId: string;
  },
  frontmatter: Pick<AdminBlogFrontmatter, 'slug' | 'series'>,
  options: {
    slugUsage?: AdminBlogPublicSlugUsage;
    seriesByEntryId?: ReadonlyMap<string, string | null>;
  } = {}
): Promise<AdminContentValidationIssue[]> => {
  const issues: AdminContentValidationIssue[] = [];
  const publicSlug = resolveBlogPublicSlug(state.publicEntryId, frontmatter.slug);

  if (!BLOG_PUBLIC_SLUG_RE.test(publicSlug)) {
    issues.push(
      createIssue(
        'slug',
        frontmatter.slug
          ? 'blog.slug 必须是小写 kebab-case'
          : '当前条目路径拍平后的公开 slug 不合法，请设置合法 slug 或调整文件路径'
      )
    );
  }

  if (RESERVED_BLOG_SLUGS.has(publicSlug)) {
    issues.push(
      createIssue(
        'slug',
        `公开 slug "${publicSlug}" 与 /archive 或 /blog 下的保留路由冲突，请修改 slug`
      )
    );
  }

  if (issues.length > 0) {
    return issues;
  }

  try {
    const slugIndex = options.slugUsage && options.seriesByEntryId
      ? { usage: options.slugUsage, seriesByEntryId: options.seriesByEntryId }
      : await loadBlogPublicSlugIndex();
    const currentSeries = frontmatter.series?.trim() || null;
    const collisionEntryId = slugIndex.usage
      .get(publicSlug)
      ?.find((entryId) => {
        if (entryId === state.entryId) return false;
        return !currentSeries || slugIndex.seriesByEntryId.get(entryId) !== currentSeries;
      }) ?? null;
    if (collisionEntryId) {
      issues.push(
        createIssue(
          'slug',
          `公开 slug "${publicSlug}" 已被其他 blog 占用：${collisionEntryId}`
        )
      );
      return issues;
    }
  } catch (error) {
    issues.push(
      createIssue(
        'slug',
        `无法完成 blog.slug 唯一性校验：${error instanceof Error ? error.message : 'unknown error'}`
      )
    );
  }

  return issues;
};

export const buildBlogFrontmatterFromValues = (
  values: AdminBlogEditorValues,
  options: {
    preservedPublishedAt?: string;
    preservedUpdatedAt?: string;
  } = {}
): { frontmatter?: AdminBlogFrontmatter; issues: AdminContentValidationIssue[] } => {
  const issues: AdminContentValidationIssue[] = [];
  const title = values.title.trim();
  if (!title) {
    issues.push(createIssue('title', 'title 不能为空'));
  }

  const dateResult = parseBlogDateInput(values.date);
  if (!dateResult) {
    issues.push(createIssue('date', 'blog.date 必须是 YYYY-MM-DD 或带时区的 ISO 8601 日期时间'));
  }

  const explicitPublishedAt = values.publishedAt.trim();
  const hasExplicitPublishedAt = explicitPublishedAt.length > 0;
  const publishedAt = hasExplicitPublishedAt
    ? parseBlogPublishedAtInput(explicitPublishedAt)
    : null;

  if (hasExplicitPublishedAt && !publishedAt) {
    issues.push(createIssue('publishedAt', 'blog.publishedAt 必须是带时区的 ISO 8601 日期时间'));
  }

  const explicitUpdatedAt = values.updatedAt.trim();
  const hasExplicitUpdatedAt = explicitUpdatedAt.length > 0;
  const updatedAtResult = hasExplicitUpdatedAt
    ? parseBlogDateInput(explicitUpdatedAt)
    : null;

  if (hasExplicitUpdatedAt && !updatedAtResult) {
    issues.push(createIssue('updatedAt', 'blog.updatedAt 必须是 YYYY-MM-DD 或带时区的 ISO 8601 日期时间'));
  }

  const tags = parseTagsText(values.tagsText);
  issues.push(...validateRoutableTags(tags));

  const versionOrderText = values.versionOrder.trim();
  const versionOrder = versionOrderText ? Number(versionOrderText) : undefined;
  if (versionOrderText && (versionOrder === undefined || !Number.isInteger(versionOrder) || versionOrder < 0)) {
    issues.push(createIssue('versionOrder', 'versionOrder 必须是非负整数'));
  }

  if (!dateResult || issues.length > 0) {
    return { issues };
  }

  const slug = values.slug.trim();
  const preservedPublishedAt = normalizeOptionalText(options.preservedPublishedAt);
  const preservedUpdatedAt = normalizeOptionalText(options.preservedUpdatedAt);
  const publishedAtText = hasExplicitPublishedAt
    ? explicitPublishedAt
    : preservedPublishedAt;
  const updatedAtText = hasExplicitUpdatedAt
    ? updatedAtResult?.dateText
    : preservedUpdatedAt;
  const date = dateResult.dateText;
  const finalUpdatedAtResult = hasExplicitUpdatedAt
    ? updatedAtResult
    : updatedAtText
      ? parseBlogDateInput(updatedAtText)
      : null;

  if (finalUpdatedAtResult && finalUpdatedAtResult.date.valueOf() < dateResult.date.valueOf()) {
    issues.push(createIssue('updatedAt', 'blog.updatedAt 不能早于 blog.date'));
    return { issues };
  }

  return {
    issues,
    frontmatter: {
      title,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      date,
      ...(publishedAtText ? { publishedAt: publishedAtText } : {}),
      ...(updatedAtText ? { updatedAt: updatedAtText } : {}),
      tags,
      draft: values.draft === true,

      ...(slug ? { slug } : {}),
      ...(values.series.trim() ? { series: values.series.trim() } : {}),
      ...(values.versionLabel.trim() ? { versionLabel: values.versionLabel.trim() } : {}),
      ...(values.versionName.trim() ? { versionName: values.versionName.trim() } : {}),
      ...(values.versionSummary.trim() ? { versionSummary: values.versionSummary.trim() } : {}),
      ...(versionOrder !== undefined ? { versionOrder } : {}),
      ...(values.ogImage.trim() ? { ogImage: values.ogImage.trim() } : {}),
      ...(values.ogImageAlt.trim() ? { ogImageAlt: values.ogImageAlt.trim() } : {}),
      ...(values.badge.trim() ? { badge: values.badge.trim() } : {})
    }
  };
};
