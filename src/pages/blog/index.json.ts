import type { APIRoute } from 'astro';
import { getBlogDerivedText, getBlogSlug, getVisibleblogs } from '../../lib/content';

export const prerender = true;

export const GET: APIRoute = async () => {
  const visibleblogs = await getVisibleblogs();
  const index = visibleblogs.map((entry) => {
    const { text } = getBlogDerivedText(entry);
    return {
      slug: getBlogSlug(entry),
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
