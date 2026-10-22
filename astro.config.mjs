import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import { createPublicMarkdownConfig } from './src/plugins/markdown-pipeline.mjs';
import { contentAssets } from './src/integrations/content-assets.mjs';
import {
  getSelectedAstroApiFonts,
  resolveTypographyFromRawUiSettings
} from './src/lib/fonts/registry';
import { site, hasSiteUrl } from './site.config.mjs';

const isProductionBuild = process.env.NODE_ENV === 'production';
const SITEMAP_ROUTE_ROOTS = new Set(['about', 'admin', 'archive', 'bits', 'blog', 'devlog', 'projects']);
const rawDeploymentBase = process.env.ASTRO_WHONO_BASE_PATH ?? '/';
const trimmedDeploymentBase = String(rawDeploymentBase).trim();

// Git Bash 的 MSYS 路径转换会把 "/blog" 这类值改写成 "C:/Program Files/Git/blog"，
// 导致深处的 "Missing parameter" 预渲染错误；在配置期直接报可读错误。
// 规避：命令前加 MSYS_NO_PATHCONV=1（或 MSYS2_ENV_CONV_EXCL=ASTRO_WHONO_BASE_PATH）。
if (/[:\s]/.test(trimmedDeploymentBase)) {
  throw new Error(
    `Invalid ASTRO_WHONO_BASE_PATH "${rawDeploymentBase}": looks like a filesystem path, not a URL base. ` +
      'If running under Git Bash, prefix the command with MSYS_NO_PATHCONV=1 to stop MSYS path conversion.',
  );
}

const normalizeDeploymentBase = (value) => {
  const segment = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  return segment ? `/${segment}/` : '/';
};

const deploymentBase = normalizeDeploymentBase(rawDeploymentBase);

const normalizeSitemapPathname = (page) => {
  let pathname = '/';

  try {
    pathname = new URL(page).pathname;
  } catch {
    [pathname = '/'] = page.split(/[?#]/, 1);
  }

  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const segments = normalizedPathname.split('/').filter(Boolean);
  const routeRootIndex = segments.findIndex((segment) => SITEMAP_ROUTE_ROOTS.has(segment));

  if (routeRootIndex > 0) {
    return `/${segments.slice(routeRootIndex).join('/')}`;
  }

  return normalizedPathname;
};

const isExcludedSitemapPathname = (pathname) =>
  pathname === '/admin'
  || pathname.startsWith('/admin/')
  || pathname === '/bits/draft-dialog';

const isExcludedSitemapEntry = (page) => isExcludedSitemapPathname(normalizeSitemapPathname(page));

/**
 * @astrojs/sitemap 只看到 URL，不知道博客版本关系。
 * 构建结束后用 /blog/index.json 的最新版 allowlist 移除旧版本与最新版 dated alias。
 */
const createSitemapBlogFilter = () => ({
  name: 'astro-whono:sitemap-blog-filter',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const distDirectory = fileURLToPath(dir);
      const indexPath = path.join(distDirectory, 'blog', 'index.json');
      if (!existsSync(indexPath)) return;

      const items = JSON.parse(readFileSync(indexPath, 'utf8'));
      const canonicalPaths = new Set(
        (Array.isArray(items) ? items : [])
          .filter((item) => item && item.isLatest === true && typeof item.href === 'string')
          .map((item) => item.href)
      );
      if (canonicalPaths.size === 0) return;

      const basePrefix = deploymentBase === '/' ? '' : deploymentBase.replace(/\/+$/, '');
      const sitemapFiles = readdirSync(distDirectory).filter((name) => /^sitemap-\d+\.xml$/.test(name));
      let removed = 0;

      for (const fileName of sitemapFiles) {
        const filePath = path.join(distDirectory, fileName);
        const xml = readFileSync(filePath, 'utf8');
        const nextXml = xml.replace(/<url>[\s\S]*?<\/url>/g, (block) => {
          const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
          if (!loc) return block;

          const pathname = new URL(loc).pathname;
          // RSS 与 blog/index.json 的 href 是未编码的 CJK 路径；sitemap 的 <loc> 是百分号编码的。
          // 先 decode，才能把中文 slug 与 canonicalPaths 对上，避免整类中文 URL 被误删。
          let decodedPathname = pathname;
          try {
            decodedPathname = decodeURIComponent(pathname);
          } catch {
            // 非法百分号编码保持原样，交给下面的 /blog/ 判断。
          }
          const stripped = basePrefix && decodedPathname.startsWith(basePrefix)
            ? decodedPathname.slice(basePrefix.length)
            : decodedPathname;
          if (!stripped.startsWith('/blog/')) return block;

          const segments = stripped.split('/').filter(Boolean);
          if (segments.length !== 2) return block;
          const canonicalPath = stripped.endsWith('/') ? stripped : `${stripped}/`;
          if (canonicalPaths.has(canonicalPath)) return block;

          removed += 1;
          return '';
        });

        if (nextXml !== xml) writeFileSync(filePath, nextXml, 'utf8');
      }

      if (removed > 0) {
        logger.info(`removed ${removed} non-canonical blog URL(s) from sitemap`);
      }
    }
  }
});

const integrations = [
  contentAssets(),
  ...(!isProductionBuild ? [svelte()] : []),
  ...(hasSiteUrl ? [sitemap({ filter: (page) => !isExcludedSitemapEntry(page) }), createSitemapBlogFilter()] : [])
];

// ui.typography 选中 astro-fonts-api 字体时，构建期由 Astro Fonts API 下载自托管；
// 只下载被选中的条目，默认配置下 fonts 数组为空。config 期手读 ui.json（dev 下改字体需重启）。
const FONT_PROVIDERS = {
  google: () => fontProviders.google(),
  fontsource: () => fontProviders.fontsource()
};

const readUiSettingsRaw = () => {
  try {
    return JSON.parse(readFileSync(new URL('./src/data/settings/ui.json', import.meta.url), 'utf8'));
  } catch {
    return undefined;
  }
};

// 编辑器岛在浏览器里解析日期时需要站点时区；浏览器读不到 site.json，配置期注入快照。
const readSiteTimezoneForClient = () => {
  try {
    const parsed = JSON.parse(readFileSync(new URL('./src/data/settings/site.json', import.meta.url), 'utf8'));
    const timezone = typeof parsed?.timezone === 'string' ? parsed.timezone.trim() : '';
    return timezone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
};

const selectedApiFonts = getSelectedAstroApiFonts(resolveTypographyFromRawUiSettings(readUiSettingsRaw()));
const fonts = selectedApiFonts.flatMap((entry) => {
  if (!entry.familyName) return [];

  if (entry.provider === 'local') {
    if (!entry.localVariants?.length) return [];
    return [{
      provider: fontProviders.local(),
      name: entry.familyName,
      cssVariable: `--font-${entry.id}`,
      options: {
        variants: entry.localVariants.map((variant) => ({
          weight: variant.weight,
          style: variant.style,
          src: [variant.src]
        }))
      }
    }];
  }

  if (!entry.provider || !FONT_PROVIDERS[entry.provider]) return [];
  return [{
    provider: FONT_PROVIDERS[entry.provider](),
    name: entry.familyName,
    cssVariable: `--font-${entry.id}`,
    weights: [...entry.weights],
    styles: ['normal'],
    subsets: entry.subsets ? [...entry.subsets] : ['latin']
  }];
});

export default defineConfig({
  // Required for RSS generation. Prefer SITE_URL; fallback keeps build passing.
  site: site.url,
  base: deploymentBase,
  // DEV 使用 server output 允许 Theme Console 的 /api/admin/settings/ 处理读写；
  // 构建阶段回到 static，让 /admin/ 保持只读提示，并避免把该路径当作生产公开 API。
  output: isProductionBuild ? 'static' : 'server',
  integrations,
  ...(fonts.length ? { fonts } : {}),
  trailingSlash: 'always',
  redirects: {
    // 重定向目标写部署 base：Astro 只为源路径推导 base，不会改写 redirect 目标。
    '/admin/images': `${deploymentBase}admin/resources/`
  },
  // Astro 7 起 compressHTML 默认值改为 'jsx'(按 JSX 规则吞行内空格);
  // 显式固定为 v6 的 HTML-aware 压缩,避免中英混排的行内空格被移除。
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto'
  },
  vite: {
    // 本次启动实际注册进 fonts[] 的 cssVariable 快照。BaseLayout 据此过滤 <Font> 渲染：
    // dev 下 ui.json 热改字体（config 期快照不含新条目）时跳过渲染而非让 Astro 抛
    // FontFamilyNotFound 崩掉全站；重启后生效。
    define: {
      'import.meta.env.ASTRO_WHONO_FONT_CSS_VARIABLES': JSON.stringify(
        fonts.map((font) => font.cssVariable).join(',')
      ),
      'import.meta.env.ASTRO_WHONO_SITE_TIMEZONE': JSON.stringify(readSiteTimezoneForClient())
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    optimizeDeps: {
      include: [
        'emoji-picker-element',
        '@lucide/svelte/icons/*',
        '@codemirror/commands',
        '@codemirror/lang-markdown',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/highlight'
      ]
    }
  },
  markdown: createPublicMarkdownConfig({ base: deploymentBase })
});
