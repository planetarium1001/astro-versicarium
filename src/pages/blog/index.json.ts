import type { APIRoute } from 'astro';
import { getBlogDerivedText, getVisibleBlogListItems } from '../../lib/content';

export const prerender = true;

export const GET: APIRoute = async () => {
  const items = await getVisibleBlogListItems();
  const index = items.map(({ entry, href, isLatest, latestHref, series, versionLabel }) => {
    const { text } = getBlogDerivedText(entry);
    return {
      slug: entry.id,
      href,
      isLatest,
      latestHref,
      series,
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
