import {
  getCollection,
  type CollectionEntry,
  type CollectionKey
} from 'astro:content';
import { existsSync } from 'node:fs';
import { flattenEntryIdToSlug } from '../utils/slug-rules';
import { deriveMarkdownText, truncateText } from '../utils/excerpt';
import {
  buildBlogRouting,
  getBlogEntryHrefMap,
  getBlogVersionInfo,
  getLatestBlogEntries,
  type BlogRouteInfo,
  type BlogRoutingResult
} from './blog-routing';
export { createWithBase } from '../utils/format';
export { getBlogEntryHrefMap } from './blog-routing';

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

// 列表页 SSR 渲染全部条目，筛选与分页由客户端负责。

const isContentSourceFilePresent = <K extends CollectionKey>(entry: CollectionEntry<K>): boolean => {
  if (!import.meta.env.DEV) return true;

  // DEV-only 同步 existsSync 防御，仅服务公开页 / 公开内容 getter 在 dev preview 下避免显示已删除条目。
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

const orderBlogVersions = (a: BlogEntry, b: BlogEntry): number => {
  const dateOrder = orderByEntryDateDesc(a, b);
  if (dateOrder !== 0) return dateOrder;
  const versionOrder = (b.data.versionOrder ?? 0) - (a.data.versionOrder ?? 0);
  if (versionOrder !== 0) return versionOrder;
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
type BlogDerivedText = {
  plainText: string;
  text: string;
  excerpt: string;
};

export const getBlogSlug = (entry: BlogEntry) =>
  entry.data.slug ?? flattenEntryIdToSlug(entry.id);

export type BlogListItem = {
  entry: BlogEntry;
  href: string;
  isLatest: boolean;
  versionLabel: string;
  latestHref: string;
  series: string | null;
  versionCount: number;
};

export type BlogRouteEntry = BlogRouteInfo<BlogEntry> & {
  prev: { href: string; title: string } | null;
  next: { href: string; title: string } | null;
};

const shouldMemoizeBlogQueries = import.meta.env.PROD;
const MAX_BLOG_INDEX_TEXT = 600;

let sortedblogsPromise: Promise<BlogEntry[]> | null = null;
let visibleblogsPromise: Promise<BlogEntry[]> | null = null;
const BlogDerivedTextById = new Map<string, BlogDerivedText>();
const warnedMissingPublishedAt = new Set<string>();

const cloneBlogEntries = (entries: readonly BlogEntry[]) => entries.slice();

const shouldUseDefaultBlogCache = (includeDraft?: boolean) =>
  shouldMemoizeBlogQueries && includeDraft !== true;

const warnMissingPublishedAt = (entries: readonly BlogEntry[]) => {
  if (!import.meta.env.PROD) return;
  for (const entry of entries) {
    if (entry.data.draft === true || entry.data.publishedAt) continue;
    if (warnedMissingPublishedAt.has(entry.id)) continue;
    warnedMissingPublishedAt.add(entry.id);
    console.warn(
      `[astro-whono] blog "${entry.id}" has no publishedAt; falling back to date ${entry.data.dateText ?? entry.data.date.toISOString()}.`
    );
  }
};

const loadSortedblogs = async ({ includeDraft }: BlogQueryOptions = {}) => {
  const blogs = await getPublished('blog', {
    ...(includeDraft === undefined ? {} : { includeDraft }),
    orderBy: orderBlogVersions
  });
  warnMissingPublishedAt(blogs);
  // 构建期校验 series/slug/route 冲突；任何公开查询都会先触发。
  buildBlogRouting(blogs);
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

/** 全部公开版本，用于首页、博客列表与站内搜索。 */
export async function getVisibleblogs(options: BlogQueryOptions = {}) {
  if (!shouldUseDefaultBlogCache(options.includeDraft)) {
    return getSortedblogs(options);
  }

  visibleblogsPromise ??= getSortedblogs();
  return cloneBlogEntries(await visibleblogsPromise);
}

/** 每个 series 只保留最新版，用于 RSS、sitemap 与版本导航。 */
export async function getLatestVisibleblogs(options: BlogQueryOptions = {}) {
  return getLatestBlogEntries(await getVisibleblogs(options));
}

export async function getVisibleBlogRouting(
  options: BlogQueryOptions = {}
): Promise<BlogRoutingResult<BlogEntry>> {
  return buildBlogRouting(await getVisibleblogs(options));
}

export async function getVisibleBlogListItems(
  options: BlogQueryOptions = {}
): Promise<BlogListItem[]> {
  const entries = await getVisibleblogs(options);
  const routing = buildBlogRouting(entries);
  const hrefByEntryId = getBlogEntryHrefMap(routing);
  const versionCountByEntryId = new Map<string, number>();
  for (const group of routing.groups) {
    for (const version of group.versions) {
      versionCountByEntryId.set(version.id, group.versions.length);
    }
  }

  return entries.map((entry) => {
    const info = getBlogVersionInfo(routing, entry);
    return {
      entry,
      href: hrefByEntryId.get(entry.id) ?? `/blog/${getBlogSlug(entry)}/`,
      isLatest: info.isLatest,
      versionLabel: info.versionLabel,
      latestHref: info.latestHref,
      series: info.series,
      versionCount: versionCountByEntryId.get(entry.id) ?? 1
    } satisfies BlogListItem;
  });
}

export async function getVisibleBlogRouteEntries(
  options: BlogQueryOptions = {}
): Promise<BlogRouteEntry[]> {
  const entries = await getVisibleblogs(options);
  const routing = buildBlogRouting(entries);
  const hrefByEntryId = getBlogEntryHrefMap(routing);
  const orderedEntries = entries.slice().sort(orderBlogVersions);
  const neighborsByEntryId = new Map<string, {
    prev: { href: string; title: string } | null;
    next: { href: string; title: string } | null;
  }>();

  orderedEntries.forEach((entry, index) => {
    const prev = orderedEntries[index - 1] ?? null;
    const next = orderedEntries[index + 1] ?? null;
    neighborsByEntryId.set(entry.id, {
      prev: prev
        ? { href: hrefByEntryId.get(prev.id) ?? `/blog/${getBlogSlug(prev)}/`, title: prev.data.title }
        : null,
      next: next
        ? { href: hrefByEntryId.get(next.id) ?? `/blog/${getBlogSlug(next)}/`, title: next.data.title }
        : null
    });
  });

  return routing.routes.map((route) => ({
    ...route,
    ...(neighborsByEntryId.get(route.entry.id) ?? { prev: null, next: null })
  }));
}
