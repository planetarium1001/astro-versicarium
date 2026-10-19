// 该模块会被浏览器端 Svelte 岛（编辑器、列表操作）间接引入，不能直接读 process。
// 构建期服务端仍通过 process.env 注入 SITE_URL；浏览器环境退化为无环境变量。
const env =
  typeof process === 'object' && process !== null && process.env ? process.env : {};

const rawSiteUrl = (env.SITE_URL ?? '').trim();
const siteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, '') : '';
const hasSiteUrl = siteUrl.length > 0;
const fallbackSiteUrl = 'https://example.invalid';
const siteUrlWarningFlag = 'ASTRO_WHONO_SITE_URL_WARNING_SHOWN';

if (
  !hasSiteUrl &&
  env.NODE_ENV === 'production' &&
  env[siteUrlWarningFlag] !== '1'
) {
  env[siteUrlWarningFlag] = '1';
  console.warn(
    '[astro-whono] SITE_URL is not set. RSS will use example.invalid; canonical/og will be omitted; sitemap will not be generated and robots will not include Sitemap.'
  );
}

/** 内容根目录：作者内容与代码分离；改此常量即可调整内容根名称。 */
export const CONTENT_ROOT = 'content';

/** 站点默认时区；site.json 的 timezone 与 SITE_TIMEZONE 可覆盖。 */
export const DEFAULT_SITE_TIMEZONE = 'Asia/Shanghai';

export const site = {
  url: hasSiteUrl ? siteUrl : fallbackSiteUrl,
  title: 'Astro Whono Tweaked',
  brandTitle: 'Astro Whono Tweaked',
  author: 'Planetarium',
  authorAvatar: 'author/avatar.svg',
  description: '面向开发者的极简 Astro 主题，适合撰写技术文章、项目记录与开发日志。'
};

// 前端每页条目数：列表页写入 `[data-entry-filters][data-page-size]`，客户端分页读取。
export const PAGE_SIZE_BLOG = 12;
export const PAGE_SIZE_BITS = 20;
export const PAGE_SIZE_ARCHIVE = 20;

export { hasSiteUrl, siteUrl };
