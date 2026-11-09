import type { APIRoute } from 'astro';
import { getBlogDerivedText, getVisibleBlogListItems } from '../../lib/content';
import { getSeriesTagKey } from '../../lib/blog-series';

export const prerender = true;

export const GET: APIRoute = async () => {
  const items = await getVisibleBlogListItems();
  const index = items.map(({ entry, href, isLatest, latestHref, versionLabel }) => {
    const { text } = getBlogDerivedText(entry);
    // 系列键只来自 frontmatter：列表项本身不带系列信息，系列呈现另有系列索引。
    const series = entry.data.series?.trim() || null;
    return {
      slug: entry.id,
      href,
      isLatest,
      latestHref,
      series,
      /*
        系列键是命名空间化的标签键（`series:<slug>`），客户端把它并进同一个键集合，
        于是系列与标签共用同一条筛选表达式与同一个 `+` / `/` 开关。
      */
      seriesKeys: series ? [getSeriesTagKey(series)] : [],
      versionLabel,
      title: entry.data.title ?? '',
      description: entry.data.description ?? '',
      tags: entry.data.tags ?? [],
      text,
      date: entry.data.date ? entry.data.date.toISOString() : null
    };
  });
  const cacheControl = import.meta.env.DEV
    ? 'no-store'
    : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl
    }
  });
};
