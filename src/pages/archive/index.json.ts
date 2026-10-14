import type { APIRoute } from 'astro';
import {
  getBlogDerivedText,
  getBlogSlug,
  getVisibleDevlogs,
  getVisibleProjects,
  getVisibleblogs
} from '../../lib/content';
import { stripTrailingLinks } from '../../lib/trailing-links';

/**
 * `/archive/index.json` 覆盖 blog + projects + devlog 三个集合，
 * 是归档页客户端筛选与计数的唯一数据源；bits 不进归档。
 */
type ArchiveIndexItem = {
  kind: 'blog' | 'projects' | 'devlog';
  id: string;
  key: string;
  /**
   * 与 DOM 的 [data-entry-item][data-slug] 对齐的匹配键（= key）。
   * entry-search.ts 用它与 DOM 的 data-slug 做集合匹配，缺了它标签筛选会失效。
   */
  slug: string;
  title: string;
  description: string;
  tags: string[];
  text: string;
  date: string | null;
  href: string;
  project?: string;
  type?: string;
};

export const prerender = true;

export const GET: APIRoute = async () => {
  const [blogs, projects, devlogs] = await Promise.all([
    getVisibleblogs(),
    getVisibleProjects(),
    getVisibleDevlogs()
  ]);

  const blogItems = blogs.map((entry): ArchiveIndexItem => {
    const slug = getBlogSlug(entry);
    return {
      kind: 'blog',
      id: entry.id,
      key: `blog:${slug}`,
      slug: `blog:${slug}`,
      title: entry.data.title ?? '',
      description: entry.data.description ?? '',
      tags: entry.data.tags ?? [],
      text: getBlogDerivedText(entry).text,
      date: entry.data.date ? entry.data.date.toISOString() : null,
      href: `/blog/${slug}/`
    };
  });

  const projectItems = projects.map((entry): ArchiveIndexItem => ({
    kind: 'projects',
    id: entry.id,
    key: `projects:${entry.id}`,
    slug: `projects:${entry.id}`,
    title: entry.data.title ?? '',
    description: entry.data.description ?? '',
    // projects 已取消 tags 字段：归档的标签作用域不再暴露项目标签。
    tags: [],
    text: [entry.data.subtitle, entry.data.description].filter(Boolean).join(' '),
    date: entry.data.date ? entry.data.date.toISOString() : null,
    href: `/projects/#${entry.id}`,
    type: entry.data.type ?? ''
  }));

  const devlogItems = devlogs.map((entry): ArchiveIndexItem => {
    // 外链写在正文 markdown 末尾的链接组里；检索文本用去掉链接组的正文，避免链接文字污染。
    const bodyText = stripTrailingLinks(entry.body ?? '').replace(/\s+/g, ' ').trim();
    return {
      kind: 'devlog',
      id: entry.id,
      key: `devlog:${entry.id}`,
      slug: `devlog:${entry.id}`,
      title: entry.data.title ?? '',
      description: entry.data.description ?? '',
      // 归档页「更新」的 tag 作用域 = 项目名称（与 /devlog/ 的 #项目 一致），不把 kind 当标签暴露。
      tags: [entry.data.project].filter((value): value is string => Boolean(value)),
      text: [entry.data.project, entry.data.kind, entry.data.description, bodyText].filter(Boolean).join(' '),
      date: entry.data.date ? entry.data.date.toISOString() : null,
      href: `/devlog/#${entry.id}`,
      project: entry.data.project
    };
  });

  const index = [...blogItems, ...projectItems, ...devlogItems];

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
