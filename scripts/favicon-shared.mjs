import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 默认图标路径，必须与 `src/utils/favicon-defaults.ts` 的 DEFAULT_SITE_FAVICON 保持一致。
 * 生成器在 Node 里直接运行，不能 import TS，所以这里单独维护一份。
 */
export const FAVICON_DEFAULT_PATHS = {
  svg: '/favicon.svg',
  png: '/favicon-32x32.png'
};

/** 生成目录，相对项目根目录。 */
export const FAVICON_GENERATED_DIR = path.join('public', 'images', 'site', 'generated');

/** 读取 `src/data/settings/site.json`；文件缺失或损坏时返回空对象。 */
export const readSiteSettings = (projectRoot) => {
  try {
    return JSON.parse(
      readFileSync(path.join(projectRoot, 'src', 'data', 'settings', 'site.json'), 'utf8')
    );
  } catch {
    return {};
  }
};

/** 把 `/images/...` 这类 public 路径解析成绝对文件路径；不存在时返回 null。 */
export const resolvePublicFile = (projectRoot, value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace(/^\/+/, '');
  const filePath = path.join(projectRoot, 'public', ...normalized.split('/'));
  return existsSync(filePath) ? filePath : null;
};

/** 生成器使用的源图，顺序与渲染回退保持一致。 */
export const resolveFaviconSourceImage = (projectRoot, favicon = {}) =>
  resolvePublicFile(projectRoot, favicon.png)
  ?? resolvePublicFile(projectRoot, favicon.source)
  ?? resolvePublicFile(projectRoot, favicon.svg)
  ?? resolvePublicFile(projectRoot, FAVICON_DEFAULT_PATHS.png)
  ?? resolvePublicFile(projectRoot, FAVICON_DEFAULT_PATHS.svg);

const normalizeFaviconPath = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
  return normalized ? `/${normalized}` : null;
};

/** 设置里的路径是否仍是模板默认路径。 */
export const isDefaultFaviconPath = (value, kind) =>
  normalizeFaviconPath(value) === FAVICON_DEFAULT_PATHS[kind];

/** 源图是否仍是模板默认图；模板默认配置不接管根 ICO。 */
export const isDefaultFaviconSource = (projectRoot, source) =>
  source === resolvePublicFile(projectRoot, FAVICON_DEFAULT_PATHS.png)
  || source === resolvePublicFile(projectRoot, FAVICON_DEFAULT_PATHS.svg);

/**
 * 根 ICO 是否由生成器写入。
 *
 * - 文件缺失、内容与本次生成一致，或上次就是生成器写的：写入；
 * - 配置了非默认源图（自定义图标）：以配置为准写入；
 * - 其余情况（用户手工替换的 ICO）保持原样。
 */
export const shouldWriteRootIco = ({
  currentHash,
  generatedHash,
  previousMarker,
  sourceIsDefault
}) => currentHash === null
  || currentHash === generatedHash
  || (previousMarker?.rootIco === true && previousMarker?.rootIcoHash === currentHash)
  || !sourceIsDefault;

/**
 * 自定义标签页图标不在默认路径时，根路径的默认图标会被浏览器、旧 HTML 或探测请求误用。
 * 返回需要覆盖/移除的根路径计划；模板默认配置返回 null。
 *
 * 计划项：
 * - `{ type, source }`：用指定的 public 文件覆盖；
 * - `{ type, generated }`：用生成目录里的文件覆盖；
 * - `{ remove: true }`：从产物/开发服务里移除。
 */
export const resolveFaviconProbePlan = (projectRoot) => {
  const settings = readSiteSettings(projectRoot);
  const favicon = settings?.favicon ?? {};
  const svg = resolvePublicFile(projectRoot, favicon.svg);
  const png = resolvePublicFile(projectRoot, favicon.png);
  const customSvg = svg && !isDefaultFaviconPath(favicon.svg, 'svg') ? svg : null;
  const customPng = png && !isDefaultFaviconPath(favicon.png, 'png') ? png : null;

  if (!customSvg && !customPng) return null;

  return {
    '/favicon.svg': customSvg
      ? { type: 'image/svg+xml', source: customSvg }
      : { remove: true },
    '/favicon-32x32.png': { type: 'image/png', generated: 'favicon-32x32.png' },
    '/apple-touch-icon.png': { type: 'image/png', generated: 'apple-touch-icon.png' }
  };
};
