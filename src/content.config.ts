import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { BLOG_PUBLIC_SLUG_RE } from './utils/slug-rules';
import { normalizeBitsAvatarPath } from './utils/format';
import { parseBlogDateInput, parseBlogPublishedAtInput } from './utils/date-only';
import { normalizeBitsImageSource } from './lib/bits-image-source';

const slugRule = z
  .string()
  .regex(BLOG_PUBLIC_SLUG_RE, 'slug must be lowercase kebab-case（允许 CJK）');

const BlogBaseFields = {
  title: z.string(),
  description: z.string().optional(),
  date: z.unknown(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  publishedAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  // Optional custom permalink. If present, it overrides the default public slug
  // derived from the entry id / path.
  slug: slugRule.optional()
};

const BlogShape = {
  ...BlogBaseFields,
  cover: z.string().optional(),
  badge: z.string().optional()
};

const BlogSchema = z.object(BlogShape).transform((data, ctx) => {
  const dateResult = parseBlogDateInput(data.date);
  if (!dateResult) {
    ctx.addIssue({
      code: 'custom',
      path: ['date'],
      message: 'date must be a valid YYYY-MM-DD date or ISO 8601 datetime with timezone'
    });
    return z.NEVER;
  }

  const publishedAtInput = data.publishedAt;
  const hasExplicitPublishedAt =
    publishedAtInput != null &&
    !(typeof publishedAtInput === 'string' && publishedAtInput.trim() === '');
  const publishedAt = hasExplicitPublishedAt
    ? parseBlogPublishedAtInput(publishedAtInput)
    : dateResult.publishedAt;

  if (hasExplicitPublishedAt && !publishedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'publishedAt must be a valid ISO 8601 datetime with timezone'
    });
    return z.NEVER;
  }

  const hasExplicitUpdatedAt =
    data.updatedAt != null &&
    !(typeof data.updatedAt === 'string' && data.updatedAt.trim() === '');
  const updatedAtInput = data.updatedAt;
  const updatedAtResult = hasExplicitUpdatedAt ? parseBlogDateInput(updatedAtInput) : null;

  if (hasExplicitUpdatedAt && !updatedAtResult) {
    ctx.addIssue({
      code: 'custom',
      path: ['updatedAt'],
      message: 'updatedAt must be a valid YYYY-MM-DD date or ISO 8601 datetime with timezone'
    });
    return z.NEVER;
  }

  if (updatedAtResult && updatedAtResult.date.valueOf() < dateResult.date.valueOf()) {
    ctx.addIssue({
      code: 'custom',
      path: ['updatedAt'],
      message: 'updatedAt must not be earlier than date'
    });
    return z.NEVER;
  }

  const {
    publishedAt: _publishedAt,
    updatedAt: _updatedAt,
    ...normalizedData
  } = data;

  return {
    ...normalizedData,
    date: dateResult.date,
    ...(publishedAt ? { publishedAt } : {}),
    ...(updatedAtResult ? { updatedAt: updatedAtResult.date } : {})
  };
});

const bitsImage = z.object({
  src: z
    .string()
    .superRefine((value, ctx) => {
      if (!normalizeBitsImageSource(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'images[].src 只允许 public/** 下的相对图片路径或 https:// 远程 URL，不要带 public/、不要以 / 开头，也不要使用 http、..、?、#'
        });
      }
    })
    .transform((value) => normalizeBitsImageSource(value) ?? value),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional()
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
      return;
    }
  })
  .transform((value) => normalizeBitsAvatarPath(value) ?? value);

const bitsAuthor = z.object({
  name: z.string().optional(),
  avatar: bitsAuthorAvatar.optional()
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: BlogSchema
});

const bits = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/bits' }),
  schema: z.object({
    // Bits can be untitled.
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    slug: slugRule.optional(),

    // Optional media for card display.
    images: z.array(bitsImage).optional(),
    author: bitsAuthor.optional()
  })
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    // type 完全开放：写什么显示什么，渲染为标题前小胶囊。
    type: z.string().optional(),
    icon: z.string().optional(),
    /**
     * 没有 tags 与 repo/demo：仓库、演示等外链统一写在正文末尾的链接组里
     * （见 src/lib/trailing-links.ts），列表卡片与弹窗渲染成右对齐链接行。
     */
    date: z.coerce.date(),
    draft: z.boolean().default(false)
  })
});

const devlog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/devlog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // project 为自由字符串，不做链接。
    project: z.string(),
    // kind 完全开放（建议 feature / fix / improvement / breaking / docs）。
    kind: z.string().optional(),
    description: z.string().optional(),
    /**
     * 没有 links 字段：外链写进正文 markdown 末尾的链接组（可多行 `[文字](https://…)`），
     * 便于整条内容直接粘贴到 GitHub release 或 commit。渲染时由共享的末尾链接机制
     * 解析成右对齐链接行（见 src/lib/trailing-links.ts）。
     */
    draft: z.boolean().default(false)
  })
});

const about = defineCollection({
  loader: glob({ pattern: 'index.md', base: './src/content/about' }),
  schema: z.looseObject({})
});

export const collections = { blog, projects, bits, devlog, about };
