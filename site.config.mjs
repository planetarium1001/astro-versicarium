const rawSiteUrl = (process.env.SITE_URL ?? '').trim();
const siteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, '') : '';
const hasSiteUrl = siteUrl.length > 0;
const fallbackSiteUrl = 'https://example.invalid';
const siteUrlWarningFlag = 'ASTRO_WHONO_SITE_URL_WARNING_SHOWN';

if (
  !hasSiteUrl &&
  process.env.NODE_ENV === 'production' &&
  process.env[siteUrlWarningFlag] !== '1'
) {
  process.env[siteUrlWarningFlag] = '1';
  console.warn(
    '[astro-whono] SITE_URL is not set. RSS will use example.invalid; canonical/og will be omitted; sitemap will not be generated and robots will not include Sitemap.'
  );
}

export const site = {
  url: hasSiteUrl ? siteUrl : fallbackSiteUrl,
  title: 'Astro Themes by Whono',
  brandTitle: 'Whono',
  author: 'Whono',
  authorAvatar: 'author/avatar.webp',
  description: '一个 Astro 主题的展示站：轻量、可维护、可复用。'
};

// 服务端分页已取消，这三个值是前端每页条目数：列表页写入
// `[data-entry-filters][data-page-size]`，客户端分页读取。
export const PAGE_SIZE_BLOG = 12;
export const PAGE_SIZE_BITS = 20;
export const PAGE_SIZE_ARCHIVE = 20;

export { hasSiteUrl, siteUrl };
