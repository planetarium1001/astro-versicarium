import type { BlogRoutingEntryData, BlogRoutingResult } from './blog-routing';

/**
 * 博客内容系列的纯模型：不依赖 astro:content，可被文章页、筛选项与测试复用。
 * 系列成员是并列的独立文章，没有「最新版 / 历史版」之分；版本组只负责去重，
 * 保证同一内容的多个版本在系列清单里只占一行。
 */

export type BlogSeriesEntryData = BlogRoutingEntryData & {
  series?: string | undefined;
  seriesName?: string | undefined;
  seriesOrder?: number | undefined;
};

export type BlogSeriesEntry = {
  id: string;
  data: BlogSeriesEntryData;
};

export type BlogSeriesMember = {
  /** 同一版本组只出现一次，取组内最新版的 canonical 路由。 */
  versionGroupKey: string;
  entryId: string;
  title: string;
  href: string;
  dateText: string;
  /** 1-based 阅读次序，由排序结果得出，与版本号无关。 */
  index: number;
};

export type BlogSeriesGroup = {
  slug: string;
  /** 排序后第一个非空 `seriesName`，缺省回退 slug。 */
  name: string;
  total: number;
  members: BlogSeriesMember[];
};

/** 筛选面板与文章页共用标签表达式的命名空间键，避免出现第二套 URL 参数。 */
export const BLOG_SERIES_TAG_PREFIX = 'series:';

export const getSeriesTagKey = (slug: string): string => `${BLOG_SERIES_TAG_PREFIX}${slug}`;

/** 与标签筛选同一套 URL：`/blog/?tags=series%3A<slug>&mode=and`。 */
export const getSeriesFilterHref = (slug: string): string =>
  `/blog/?tags=${encodeURIComponent(getSeriesTagKey(slug))}&mode=and`;

/** 未填 `seriesOrder` 的文件视为无穷大排在末尾，而不是当作 0 抢到首位。 */
const MISSING_ORDER = Number.POSITIVE_INFINITY;

type SeriesCandidate = {
  versionGroupKey: string;
  entryId: string;
  title: string;
  href: string;
  dateText: string;
  seriesName: string;
  order: number;
  date: Date;
};

const readSeriesOrder = (data: BlogSeriesEntryData): number =>
  typeof data.seriesOrder === 'number' && Number.isFinite(data.seriesOrder)
    ? data.seriesOrder
    : MISSING_ORDER;

const compareSeriesCandidates = (left: SeriesCandidate, right: SeriesCandidate): number => {
  // 显式比较而非相减：两边都缺 order 时 Infinity - Infinity 是 NaN。
  if (left.order !== right.order) return left.order < right.order ? -1 : 1;

  const dateOrder = left.date.valueOf() - right.date.valueOf();
  if (dateOrder !== 0) return dateOrder;

  return left.entryId.localeCompare(right.entryId, 'en');
};

/**
 * 系列索引只需要「每个版本组一行」的最小投影：版本组键、组的规范地址与组内最新版。
 * 公开路由结果与后台的版本组投影都能满足这一形状，系列模型因此不必依赖完整路由类型。
 */
export type BlogSeriesGroupSource<TEntry extends BlogSeriesEntry> = {
  versionGroupKey: string;
  /** 组的规范地址；后台不渲染链接时可以为空串。 */
  canonicalPath: string;
  latest: TEntry;
};

/**
 * 按版本组收拢成系列索引：每个版本组只贡献一行（组内最新版），
 * 因此系列清单不会把同一内容的多个版本重复列出。
 * Map 的插入顺序跟随入参组的顺序，最近有更新的系列排在前面。
 */
export const buildBlogSeriesIndexFromGroups = <TEntry extends BlogSeriesEntry>(
  entries: readonly TEntry[],
  groups: Iterable<BlogSeriesGroupSource<TEntry>>
): Map<string, BlogSeriesGroup> => {
  // 条目以调用方传入的集合为准：groups 可能由更宽的集合构建（例如含草稿）。
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const candidatesBySlug = new Map<string, SeriesCandidate[]>();

  for (const group of groups) {
    const representative = entryById.get(group.latest.id) ?? group.latest;
    const slug = representative.data.series?.trim();
    if (!slug) continue;

    const candidate: SeriesCandidate = {
      versionGroupKey: group.versionGroupKey,
      entryId: representative.id,
      title: representative.data.title,
      href: group.canonicalPath,
      dateText: representative.data.dateText ?? '',
      seriesName: representative.data.seriesName?.trim() ?? '',
      order: readSeriesOrder(representative.data),
      date: representative.data.date
    };

    const candidates = candidatesBySlug.get(slug);
    if (candidates) {
      candidates.push(candidate);
    } else {
      candidatesBySlug.set(slug, [candidate]);
    }
  }

  const index = new Map<string, BlogSeriesGroup>();
  for (const [slug, candidates] of candidatesBySlug) {
    candidates.sort(compareSeriesCandidates);
    index.set(slug, {
      slug,
      name: candidates.find((candidate) => candidate.seriesName)?.seriesName ?? slug,
      total: candidates.length,
      members: candidates.map((candidate, position) => ({
        versionGroupKey: candidate.versionGroupKey,
        entryId: candidate.entryId,
        title: candidate.title,
        href: candidate.href,
        dateText: candidate.dateText,
        index: position + 1
      }))
    });
  }

  return index;
};

/** 公开路由结果的便捷入口：路由组本身就是「每个版本组一行」的投影。 */
export const buildBlogSeriesIndex = <TEntry extends BlogSeriesEntry>(
  entries: readonly TEntry[],
  routing: BlogRoutingResult<TEntry>
): Map<string, BlogSeriesGroup> => buildBlogSeriesIndexFromGroups(entries, routing.groups);
