import {
  parseBlogDateInput,
  parseBlogPublishedAtInput
} from '../../utils/date-only';
import {
  formatDateTimeFieldError,
  resolveDateTimeWriteText
} from './datetime-field';
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
  normalizeOptionalText
} from './content-entry-utils';
import { isRecord } from '../is-record';

export type AdminBlogFrontmatter = {
  title: string;
  description?: string;
  date: string;
  publishedAt?: string;
  updatedAt?: string;
  tags: string[];
  draft: boolean;
  slug?: string;
  /** 版本线稳定键：同一内容的多个版本共用，语义与内容系列 `series` 无关。 */
  versionGroup?: string;
  versionLabel?: string;
  versionName?: string;
  versionSummary?: string;
  versionOrder?: number;
  /** 内容系列：有序阅读集合的稳定键，成员之间没有版本关系。 */
  series?: string;
  seriesName?: string;
  seriesOrder?: number;
  ogImage?: string;
  ogImageAlt?: string;
  badge?: string;
};

export type AdminBlogPublicSlugUsage = ReadonlyMap<string, readonly string[]>;
export type AdminBlogPublicSlugIndex = {
  usage: AdminBlogPublicSlugUsage;
  /** 同一版本组共用 slug 是合法的，唯一性校验据此放行。 */
  versionGroupByEntryId: ReadonlyMap<string, string | null>;
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
    versionGroup: getOptionalEditorString(input, 'versionGroup'),
    versionLabel: getOptionalEditorString(input, 'versionLabel'),
    versionName: getOptionalEditorString(input, 'versionName'),
    versionSummary: getOptionalEditorString(input, 'versionSummary'),
    versionOrder: getOptionalEditorString(input, 'versionOrder'),
    series: getOptionalEditorString(input, 'series'),
    seriesName: getOptionalEditorString(input, 'seriesName'),
    seriesOrder: getOptionalEditorString(input, 'seriesOrder'),
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
  const versionGroupByEntryId = new Map<string, string | null>();
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
    versionGroupByEntryId.set(candidateEntryId, normalizeOptionalText(frontmatterRecord.versionGroup) || null);
  }
  return { usage, versionGroupByEntryId };
};

export const validateBlogPublicSlug = async (
  state: {
    entryId?: string;
    publicEntryId: string;
  },
  frontmatter: Pick<AdminBlogFrontmatter, 'slug' | 'versionGroup'>,
  options: {
    slugUsage?: AdminBlogPublicSlugUsage;
    versionGroupByEntryId?: ReadonlyMap<string, string | null>;
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
    const slugIndex = options.slugUsage && options.versionGroupByEntryId
      ? { usage: options.slugUsage, versionGroupByEntryId: options.versionGroupByEntryId }
      : await loadBlogPublicSlugIndex();
    const currentVersionGroup = frontmatter.versionGroup?.trim() || null;
    const collisionEntryId = slugIndex.usage
      .get(publicSlug)
      ?.find((entryId) => {
        if (entryId === state.entryId) return false;
        // 同版本组共用 slug 是版本机制的正常形态，不做重复报错。
        return !currentVersionGroup
          || slugIndex.versionGroupByEntryId.get(entryId) !== currentVersionGroup;
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

/**
 * 版本顺序与系列次序的共用校验：空串表示不指定次序，非法值记一条字段级 issue 并当作未填写。
 * 两者的规则完全一致，抽成一处避免再复制一遍判断。
 */
const parseOptionalOrderField = (
  field: 'versionOrder' | 'seriesOrder',
  text: string,
  issues: AdminContentValidationIssue[]
): number | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) {
    issues.push(createIssue(field, `${field} 必须是非负整数`));
    return undefined;
  }
  return value;
};

export const buildBlogFrontmatterFromValues = (
  values: AdminBlogEditorValues,
  options: {
    /** payload 里完全没带 publishedAt 时的回填值（老客户端兼容）。 */
    preservedPublishedAt?: string;
    /** payload 里完全没带 updatedAt 时的回填值（老客户端兼容）。 */
    preservedUpdatedAt?: string;
    /** 文件里 updatedAt 的原文：只用于判断作者是否真的改了时间点。 */
    originalUpdatedAt?: string;
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
    issues.push(createIssue('publishedAt', formatDateTimeFieldError('blog.publishedAt')));
  }

  const explicitUpdatedAt = values.updatedAt.trim();
  const hasExplicitUpdatedAt = explicitUpdatedAt.length > 0;
  const updatedAtResult = hasExplicitUpdatedAt
    ? parseBlogDateInput(explicitUpdatedAt)
    : null;

  if (hasExplicitUpdatedAt && !updatedAtResult) {
    issues.push(createIssue('updatedAt', formatDateTimeFieldError('blog.updatedAt')));
  }

  const tags = parseTagsText(values.tagsText);
  issues.push(...validateRoutableTags(tags));

  // 版本顺序与系列次序共用「可选非负整数」规则：越小越靠前，留空表示不指定。
  const versionOrder = parseOptionalOrderField('versionOrder', values.versionOrder, issues);
  const seriesOrder = parseOptionalOrderField('seriesOrder', values.seriesOrder, issues);

  if (!dateResult || issues.length > 0) {
    return { issues };
  }

  const slug = values.slug.trim();
  const preservedPublishedAt = normalizeOptionalText(options.preservedPublishedAt);
  const preservedUpdatedAt = normalizeOptionalText(options.preservedUpdatedAt);
  const originalUpdatedAt = normalizeOptionalText(options.originalUpdatedAt) || preservedUpdatedAt;
  const publishedAtText = hasExplicitPublishedAt
    ? explicitPublishedAt
    : preservedPublishedAt;
  // updatedAt 保留时分：作者没改时间点就沿用原文（不改写 ISO/UTC 写法），改了才归一化成站点时区文本。
  const updatedAtText = hasExplicitUpdatedAt
    ? resolveDateTimeWriteText({ nextText: explicitUpdatedAt, originalText: originalUpdatedAt })
    : preservedUpdatedAt;
  const date = dateResult.dateText;
  const finalUpdatedAtResult = updatedAtText
    ? parseBlogDateInput(updatedAtText)
    : null;

  if (finalUpdatedAtResult && finalUpdatedAtResult.date.valueOf() < dateResult.date.valueOf()) {
    issues.push(createIssue('updatedAt', '更新时间不能早于发布日期 blog.date'));
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
      ...(values.versionGroup.trim() ? { versionGroup: values.versionGroup.trim() } : {}),
      ...(values.versionLabel.trim() ? { versionLabel: values.versionLabel.trim() } : {}),
      ...(values.versionName.trim() ? { versionName: values.versionName.trim() } : {}),
      ...(values.versionSummary.trim() ? { versionSummary: values.versionSummary.trim() } : {}),
      ...(versionOrder !== undefined ? { versionOrder } : {}),
      ...(values.series.trim() ? { series: values.series.trim() } : {}),
      ...(values.seriesName.trim() ? { seriesName: values.seriesName.trim() } : {}),
      ...(seriesOrder !== undefined ? { seriesOrder } : {}),
      ...(values.ogImage.trim() ? { ogImage: values.ogImage.trim() } : {}),
      ...(values.ogImageAlt.trim() ? { ogImageAlt: values.ogImageAlt.trim() } : {}),
      ...(values.badge.trim() ? { badge: values.badge.trim() } : {})
    }
  };
};
