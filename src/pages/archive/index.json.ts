import type { APIRoute } from 'astro';
import { getArchiveRows } from '../../lib/archive';
import { getThemeSettings } from '../../lib/theme-settings';

/**
 * `/archive/index.json` 覆盖 blog + projects + devlog 三个集合，
 * 是归档页客户端筛选与计数的唯一数据源；bits 不进归档。
 */
type ArchiveIndexItem = {
  kind: 'blog' | 'projects' | 'devlog';
  id: string;
  key: string;
  /**
   * 与 DOM 的 [data-entry-item][data-slug] 对齐的匹配键（= key）；
   * entry-search.ts 依赖它与 data-slug 做集合匹配。
   */
  slug: string;
  title: string;
  description: string;
  tags: string[];
  text: string;
  date: string | null;
  href: string;
  versionLabel?: string;
  isLatest?: boolean;
  series?: string | null;
  project?: string;
  type?: string;
};

export const prerender = true;

export const GET: APIRoute = async () => {
  const { settings } = getThemeSettings();
  const rows = await getArchiveRows({ versionMode: settings.page.archive.versionMode });

  const index: ArchiveIndexItem[] = rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    key: row.key,
    slug: row.key,
    title: row.title,
    description: row.description,
    tags: row.tags,
    text: row.text,
    date: row.date.toISOString(),
    href: row.href,
    ...(row.versionLabel ? { versionLabel: row.versionLabel } : {}),
    ...(row.isLatest === undefined ? {} : { isLatest: row.isLatest }),
    ...(row.series ? { series: row.series } : {}),
    ...(row.project ? { project: row.project } : {})
  }));

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
