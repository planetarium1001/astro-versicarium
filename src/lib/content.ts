import {
  getCollection,
  type CollectionEntry,
  type CollectionKey
} from 'astro:content';
import { existsSync } from 'node:fs';
import {
  BLOG_PUBLIC_SLUG_RE,
  RESERVED_BLOG_SLUGS,
  flattenEntryIdToSlug
} from '../utils/slug-rules';
import { deriveMarkdownText, truncateText } from '../utils/excerpt';
export { createWithBase } from '../utils/format';

type OrderBy<K extends CollectionKey> = (a: CollectionEntry<K>, b: CollectionEntry<K>) => number;
type CollectionEntryWithSourcePath = {
  filePath?: unknown;
};
type CollectionEntryDataWithDraft = {
  draft?: unknown;
};

export type GetPublishedOptions<K extends CollectionKey> = {
  orderBy?: OrderBy<K>;
  includeDraft?: boolean;
};

/**
 * 判断 slug 是否与 `/archive/`、`/blog/` 下的同级静态路由冲突。路由收窄为单段后只需精确匹配。
 *
 * 主要防线是 `assertUniqueBlogSlugs`（构建期抛错），此判断只是 `getVisibleblogs` 的补充防护。
 */
const isReservedSlug = (slug: string) => RESERVED_BLOG_SLUGS.has(slug);

// 列表页 SSR 渲染全部条目，筛选与分页由客户端负责。

const isContentSourceFilePresent = <K extends CollectionKey>(entry: CollectionEntry<K>): boolean => {
  if (!import.meta.env.DEV) return true;

  // DEV-only 同步 existsSync 防御，仅服务公开页 / 公开内容 getter 在 dev preview 下避免显示已删除条目。
  // Admin Content 列表已迁移到源文件索引层，不依赖也不扩散此过滤。
  // 同步 IO 成本若随公开内容规模增长变得可见，应作为公开侧优化单独处理。
  const filePath = (entry as CollectionEntryWithSourcePath).filePath;
  return typeof filePath !== 'string' || filePath.length === 0 || existsSync(filePath);
};

const isDraftContentEntry = <K extends CollectionKey>(entry: CollectionEntry<K>): boolean =>
  (entry.data as CollectionEntryDataWithDraft).draft === true;

export async function getPublished<K extends CollectionKey>(
  name: K,
  opts: GetPublishedOptions<K> = {}
) {
  const prod = import.meta.env.PROD;
  const includeDraft = opts.includeDraft ?? !prod;
  const filter = includeDraft ? undefined : (entry: CollectionEntry<K>) => !isDraftContentEntry(entry);
  const items = (await getCollection(name, filter)).filter(isContentSourceFilePresent);

  if (!opts.orderBy) return items;
  return items.slice().sort(opts.orderBy);
}

export type BlogEntry = CollectionEntry<'blog'>;
type ProjectsEntry = CollectionEntry<'projects'>;
type DevlogEntry = CollectionEntry<'devlog'>;

type AnchorListQueryOptions = { includeDraft?: boolean };

const orderByEntryDateDesc = <Entry extends { data: { date: Date } }>(
  a: Entry,
  b: Entry
): number => b.data.date.valueOf() - a.data.date.valueOf();

const orderByEntryDateDescThenId = <Entry extends { id: string; data: { date: Date } }>(
  a: Entry,
  b: Entry
): number => {
  const dateOrder = orderByEntryDateDesc(a, b);
  if (dateOrder !== 0) return dateOrder;
  // 同日期条目以 entryId 升序为第二键，保证构建可复现
  return a.id.localeCompare(b.id, 'en');
};

/** projects：列表型集合，无详情路由，公开定位为 `/projects/#<entryId>`。 */
export const getVisibleProjects = async (
  options: AnchorListQueryOptions = {}
): Promise<ProjectsEntry[]> => {
  const entries = await getPublished('projects', {
    ...(options.includeDraft === undefined ? {} : { includeDraft: options.includeDraft }),
    orderBy: orderByEntryDateDesc
  });
  return entries;
};

/** devlog：列表型集合，无详情路由，公开定位为 `/devlog/#<entryId>`。 */
export const getVisibleDevlogs = async (
  options: AnchorListQueryOptions = {}
): Promise<DevlogEntry[]> => {
  const entries = await getPublished('devlog', {
    ...(options.includeDraft === undefined ? {} : { includeDraft: options.includeDraft }),
    orderBy: orderByEntryDateDescThenId
  });
  return entries;
};
type BlogQueryOptions = Pick<GetPublishedOptions<'blog'>, 'includeDraft'>;
type BlogRouteEntry = {
  slug: string;
  entry: BlogEntry;
  prev: BlogEntry | null;
  next: BlogEntry | null;
};
type BlogDerivedText = {
  plainText: string;
  text: string;
  excerpt: string;
};

export const getBlogSlug = (entry: BlogEntry) =>
  entry.data.slug ?? flattenEntryIdToSlug(entry.id);

const assertUniqueBlogSlugs = (entries: readonly BlogEntry[]) => {
  const seen = new Map<string, string>();
  const duplicates = new Map<string, string[]>();

  for (const entry of entries) {
    const slug = getBlogSlug(entry);
    const slugSource = entry.data.slug ? 'frontmatter.slug' : `entry.id (flattened from "${entry.id}")`;

    // 保留字检查，与 schema 校验共同构成第一道防线
    if (isReservedSlug(slug)) {
      throw new Error(
        [
          'blog route slug conflict detected.',
          `  Entry:       ${entry.id}`,
          `  Public slug: ${slug}`,
          `  Source:      ${slugSource}`,
          `  Reason:      "${slug}" is reserved for sibling static routes under /archive/ and /blog/.`,
          '  How to fix:  change frontmatter.slug, or rename the file/path so the final public slug is no longer reserved.'
        ].join('\n')
      );
    }

    // 格式校验，兜住拼接结果不合法的 entryId
    if (!BLOG_PUBLIC_SLUG_RE.test(slug)) {
      throw new Error(
        [
          'Invalid public blog slug detected.',
          `  Entry:       ${entry.id}`,
          `  Public slug: ${slug}`,
          `  Source:      ${slugSource}`,
          '  Reason:      final public slug must be lowercase kebab-case.',
          '  How to fix:  provide a valid frontmatter.slug, or rename files/folders to kebab-case.'
        ].join('\n')
      );
    }

    // 唯一性校验，重复时汇总全部冲突条目后统一抛错
    const firstEntryId = seen.get(slug);
    if (!firstEntryId) {
      seen.set(slug, entry.id);
      continue;
    }

    const duplicateIds = duplicates.get(slug) ?? [firstEntryId];
    duplicateIds.push(entry.id);
    duplicates.set(slug, duplicateIds);
  }

  if (duplicates.size === 0) return;

  const detail = Array.from(duplicates.entries())
    .map(([slug, entryIds]) => `"${slug}" <- ${entryIds.join(', ')}`)
    .join('; ');

  throw new Error(
    `Duplicate blog slug detected. Public blog slugs must be unique after path flattening. ${detail}`
  );
};

const shouldMemoizeBlogQueries = import.meta.env.PROD;
const MAX_BLOG_INDEX_TEXT = 600;

let sortedblogsPromise: Promise<BlogEntry[]> | null = null;
let visibleblogsPromise: Promise<BlogEntry[]> | null = null;
const BlogDerivedTextById = new Map<string, BlogDerivedText>();

const cloneBlogEntries = (entries: readonly BlogEntry[]) => entries.slice();

const shouldUseDefaultBlogCache = (includeDraft?: boolean) =>
  shouldMemoizeBlogQueries && includeDraft !== true;

const loadSortedblogs = async ({ includeDraft }: BlogQueryOptions = {}) => {
  const blogs = await getPublished('blog', {
    ...(includeDraft === undefined ? {} : { includeDraft }),
    orderBy: orderByEntryDateDesc
  });
  assertUniqueBlogSlugs(blogs);
  return blogs;
};

const buildBlogDerivedText = (entry: BlogEntry): BlogDerivedText => {
  const { plainText, excerptText } = deriveMarkdownText(entry.body ?? '');

  return {
    plainText,
    text: plainText.length > MAX_BLOG_INDEX_TEXT ? plainText.slice(0, MAX_BLOG_INDEX_TEXT) : plainText,
    excerpt: truncateText(excerptText, 120)
  };
};

export function getBlogDerivedText(entry: BlogEntry): BlogDerivedText {
  if (!shouldMemoizeBlogQueries) {
    return buildBlogDerivedText(entry);
  }

  let derivedText = BlogDerivedTextById.get(entry.id);
  if (!derivedText) {
    derivedText = buildBlogDerivedText(entry);
    BlogDerivedTextById.set(entry.id, derivedText);
  }

  return derivedText;
}

export async function getSortedblogs(options: BlogQueryOptions = {}) {
  if (!shouldUseDefaultBlogCache(options.includeDraft)) {
    return loadSortedblogs(options);
  }

  sortedblogsPromise ??= loadSortedblogs();
  return cloneBlogEntries(await sortedblogsPromise);
}

/** 公开可见的博客条目：slug 未占用 `/archive/`、`/blog/` 下的同级静态路由名。 */
export const isVisibleBlogEntry = (entry: BlogEntry): boolean => !isReservedSlug(getBlogSlug(entry));

export async function getVisibleblogs(options: BlogQueryOptions = {}) {
  if (!shouldUseDefaultBlogCache(options.includeDraft)) {
    const blogs = await getSortedblogs(options);
    return blogs.filter(isVisibleBlogEntry);
  }

  visibleblogsPromise ??= getSortedblogs().then((blogs) => blogs.filter(isVisibleBlogEntry));
  return cloneBlogEntries(await visibleblogsPromise);
}

export async function getVisibleBlogRouteEntries(options: BlogQueryOptions = {}) {
  const blogs = await getVisibleblogs(options);
  return blogs.map((entry, index) => ({
    slug: getBlogSlug(entry),
    entry,
    prev: blogs[index - 1] ?? null,
    next: blogs[index + 1] ?? null
  })) satisfies BlogRouteEntry[];
}
