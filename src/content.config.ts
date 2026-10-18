import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { BLOG_PUBLIC_SLUG_RE } from './utils/slug-rules';
import { normalizeBitsAvatarPath } from './utils/format';
import { formatContentDateError, parseContentDateInput } from './utils/date-only';
import { entryDirLoader } from './lib/content-loader';

const slugRule = z
  .string()
  .trim()
  .regex(BLOG_PUBLIC_SLUG_RE, 'slug must be lowercase kebab-case（允许 CJK）');

const seriesRule = z
  .string()
  .trim()
  .regex(BLOG_PUBLIC_SLUG_RE, 'series must be lowercase kebab-case（允许 CJK）');

const versionOrderRule = z.number().int().min(0);

const baseFields = {
  date: z.unknown(),
  draft: z.boolean().default(false),
  entry: z.boolean().optional()
};

const blogVersionFields = {
  series: seriesRule.optional(),
  versionLabel: z.string().trim().optional(),
  versionName: z.string().trim().optional(),
  versionSummary: z.string().trim().optional(),
  versionOrder: versionOrderRule.optional()
};

type NormalizedDate = {
  date: Date;
  dateText: string;
  hasTime: boolean;
};

const parseDateOrReport = (
  value: unknown,
  field: string,
  ctx: z.RefinementCtx
): NormalizedDate | null => {
  const parsed = parseContentDateInput(value);
  if (!parsed) {
    ctx.addIssue({
      code: 'custom',
      path: [field],
      message: formatContentDateError(field)
    });
    return null;
  }
  return parsed;
};

const hasOwnValue = (value: unknown): boolean =>
  value != null && !(typeof value === 'string' && value.trim() === '');

const normalizeDateFields = (
  data: {
    date: unknown;
    publishedAt?: unknown;
    updatedAt?: unknown;
  },
  ctx: z.RefinementCtx
): {
  date: Date;
  dateText: string;
  dateHasTime: boolean;
  publishedAt?: Date;
  publishedAtText?: string;
  publishedAtHasTime?: boolean;
  updatedAt?: Date;
  updatedAtText?: string;
  updatedAtHasTime?: boolean;
} | null => {
  const date = parseDateOrReport(data.date, 'date', ctx);
  if (!date) return null;

  let publishedAt: NormalizedDate | null = null;
  if (hasOwnValue(data.publishedAt)) {
    publishedAt = parseDateOrReport(data.publishedAt, 'publishedAt', ctx);
    if (!publishedAt) return null;
  }

  let updatedAt: NormalizedDate | null = null;
  if (hasOwnValue(data.updatedAt)) {
    updatedAt = parseDateOrReport(data.updatedAt, 'updatedAt', ctx);
    if (!updatedAt) return null;
  }

  if (updatedAt && updatedAt.date.valueOf() < date.date.valueOf()) {
    ctx.addIssue({
      code: 'custom',
      path: ['updatedAt'],
      message: 'updatedAt must not be earlier than date'
    });
    return null;
  }

  return {
    date: date.date,
    dateText: date.dateText,
    dateHasTime: date.hasTime,
    ...(publishedAt
      ? {
          publishedAt: publishedAt.date,
          publishedAtText: publishedAt.dateText,
          publishedAtHasTime: publishedAt.hasTime
        }
      : {}),
    ...(updatedAt
      ? {
          updatedAt: updatedAt.date,
          updatedAtText: updatedAt.dateText,
          updatedAtHasTime: updatedAt.hasTime
        }
      : {})
  };
};

const stripRawDateFields = <T extends Record<string, unknown>>(
  data: T
): Omit<T, 'date' | 'publishedAt' | 'updatedAt'> => {
  const { date: _date, publishedAt: _publishedAt, updatedAt: _updatedAt, ...rest } = data;
  return rest;
};

type ContentImageMetadata = {
  src: string;
  width: number;
  height: number;
  format: string;
};

type EntryImageFunction = () => z.ZodType<ContentImageMetadata>;

const httpsUrlRule = z
  .string()
  .trim()
  .url('image URL must be a valid URL')
  .refine((value) => value.startsWith('https://'), 'image URL must use https://');

const createEntryImage = (
  image: EntryImageFunction
): z.ZodType<ContentImageMetadata | string> => z.union([image(), httpsUrlRule]);

const createOptionalEntryImage = (
  image: EntryImageFunction
): z.ZodType<ContentImageMetadata | string | null | undefined> =>
  createEntryImage(image).nullable().optional();

const createOptionalOgImage = (
  image: EntryImageFunction
): z.ZodType<ContentImageMetadata | string | null | undefined> =>
  z
    .union([z.literal('none'), createEntryImage(image)])
    .optional()
    .transform((value) => (value === 'none' ? null : value));

const bitsImage = (image: EntryImageFunction) =>
  z.object({
    src: createEntryImage(image),
    alt: z.string().trim().optional()
  });

const bitsAuthorAvatar = z
  .string()
  .superRefine((value, ctx) => {
    const normalized = normalizeBitsAvatarPath(value);
    if (normalized === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'author.avatar 只允许相对图片路径（例如 author/avatar.webp），不要带 public/、不要以 / 开头，也不要使用 URL、..、?、#'
      });
    }
  })
  .transform((value) => normalizeBitsAvatarPath(value) ?? value);

const bitsAuthor = z.object({
  name: z.string().trim().optional(),
  avatar: bitsAuthorAvatar.optional()
});

const commonDateShape = {
  ...baseFields
};

const blog = defineCollection({
  loader: entryDirLoader({ collection: 'blog' }),
  schema: ({ image }) =>
    z
      .object({
        ...commonDateShape,
        ...blogVersionFields,
        title: z.string().trim(),
        description: z.string().trim().optional(),
        publishedAt: z.unknown().optional(),
        updatedAt: z.unknown().optional(),
        tags: z.array(z.string()).default([]),
        slug: slugRule.optional(),
        ogImage: createOptionalOgImage(image),
        ogImageAlt: z.string().trim().optional(),
        articleDateDisplay: z.enum(['published', 'updated', 'both']).optional(),
        cardDateDisplay: z.enum(['published', 'updated', 'both']).optional(),
        dateGranularity: z.enum(['date', 'datetime']).optional(),
        badge: z.string().trim().optional()
      })
      .transform((data, ctx) => {
        const dates = normalizeDateFields(data, ctx);
        if (!dates) return z.NEVER;
        const { ogImage, ...rest } = stripRawDateFields(data);
        return {
          ...rest,
          ...dates,
          ogImage
        };
      })
});

const bits = defineCollection({
  loader: entryDirLoader({ collection: 'bits' }),
  schema: ({ image }) =>
    z
      .object({
        date: z.unknown(),
        title: z.string().trim().optional(),
        description: z.string().trim().optional(),
        tags: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
        entry: z.boolean().optional(),
        slug: slugRule.optional(),
        images: z.array(bitsImage(image)).optional(),
        author: bitsAuthor.optional()
      })
      .transform((data, ctx) => {
        const date = parseDateOrReport(data.date, 'date', ctx);
        if (!date) return z.NEVER;
        return {
          ...data,
          date: date.date,
          dateText: date.dateText,
          dateHasTime: date.hasTime
        };
      })
});

const projects = defineCollection({
  loader: entryDirLoader({ collection: 'projects' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().trim(),
        subtitle: z.string().trim().optional(),
        description: z.string().trim().optional(),
        type: z.string().trim().optional(),
        icon: createOptionalEntryImage(image),
        image: createOptionalEntryImage(image),
        ...commonDateShape
      })
      .transform((data, ctx) => {
        const date = parseDateOrReport(data.date, 'date', ctx);
        if (!date) return z.NEVER;
        return {
          ...data,
          date: date.date,
          dateText: date.dateText,
          dateHasTime: date.hasTime
        };
      })
});

const devlog = defineCollection({
  loader: entryDirLoader({ collection: 'devlog' }),
  schema: z
    .object({
      title: z.string().trim(),
      project: z.string().trim(),
      projectSlug: seriesRule.optional(),
      kind: z.string().trim().optional(),
      description: z.string().trim().optional(),
      ...commonDateShape
    })
    .transform((data, ctx) => {
      const date = parseDateOrReport(data.date, 'date', ctx);
      if (!date) return z.NEVER;
      return {
        ...data,
        date: date.date,
        dateText: date.dateText,
        dateHasTime: date.hasTime
      };
    })
});

const about = defineCollection({
  loader: entryDirLoader({
    collection: 'about',
    fixedPage: { entryId: 'index', sourcePath: 'content/about/index.md' }
  }),
  schema: z.looseObject({})
});

export const collections = { blog, projects, bits, devlog, about };
