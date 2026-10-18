import rss from '@astrojs/rss';
import {
  getBlogEntryHrefMap,
  getVisibleBlogRouting
} from '../../lib/content';
import { createWithBase } from '../../utils/format';
import { getThemeSettings } from '../../lib/theme-settings';

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);
const { settings } = getThemeSettings();

export async function GET(context) {
  return buildBlogFeed(context);
}

/** 站点订阅源与 /blog/rss.xml 同内容（/rss.xml 仅博客）；每个 series 只发最新版。 */
export async function buildBlogFeed(context, overrides = {}) {
  const routing = await getVisibleBlogRouting({ includeDraft: false });
  const hrefByEntryId = getBlogEntryHrefMap(routing);

  return rss({
    title: overrides.title ?? `${settings.site.title} · 博客`,
    description: overrides.description ?? '博客更新',
    site: context.site,
    items: routing.latestEntries.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.publishedAt ?? entry.data.date,
      description: entry.data.description,
      link: withBase(hrefByEntryId.get(entry.id) ?? `/blog/${entry.id}/`)
    }))
  });
}
