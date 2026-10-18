import { existsSync } from 'node:fs';
import path from 'node:path';

export const CONTENT_ASSET_URL_PREFIX = '/content-assets/';

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);

export const isRemoteAssetReference = (value) =>
  /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//');

export const isSiteAssetReference = (value) =>
  value.startsWith('/images/site/');

export const isImageAssetPath = (value) =>
  IMAGE_EXTENSIONS.has(path.extname(value).toLowerCase());

export const isMarkdownAssetPath = (value) =>
  MARKDOWN_EXTENSIONS.has(path.extname(value).toLowerCase());

export const isAttachmentAssetPath = (value) =>
  !isImageAssetPath(value) && !isMarkdownAssetPath(value);

const splitSuffix = (value) => {
  const index = value.search(/[?#]/);
  if (index === -1) return { pathname: value, suffix: '' };
  return { pathname: value.slice(0, index), suffix: value.slice(index) };
};

const isInside = (parent, child) => {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
};

/**
 * 把内容里的资源引用解析为 content 根内的绝对路径。
 * 支持条目相对、同级、images/、assets/ 回退、_shared 与 content 根内跨目录。
 */
export const resolveContentAssetReference = ({
  reference,
  sourceFilePath,
  projectRoot = process.cwd(),
  contentRoot = path.join(projectRoot, 'content')
}) => {
  const trimmed = String(reference ?? '').trim();
  if (!trimmed || isRemoteAssetReference(trimmed)) return null;

  const { pathname, suffix } = splitSuffix(trimmed);
  if (!pathname) return null;

  if (pathname.startsWith('/')) {
    if (!isSiteAssetReference(pathname)) return null;
    return {
      kind: 'site',
      absolutePath: path.join(projectRoot, 'public', ...pathname.replace(/^\/+/, '').split('/')),
      contentRelativePath: null,
      suffix
    };
  }

  const sourceDirectory = path.dirname(sourceFilePath);
  const candidates = [];
  const normalized = pathname.replace(/\\/g, '/');

  candidates.push(path.resolve(sourceDirectory, normalized));
  if (!normalized.startsWith('.')) {
    candidates.push(path.resolve(sourceDirectory, 'images', normalized));
    candidates.push(path.resolve(sourceDirectory, 'assets', normalized));
  }

  const absolutePath = candidates.find((candidate) => existsSync(candidate));
  if (!absolutePath || !isInside(contentRoot, absolutePath)) return null;

  return {
    kind: 'local',
    absolutePath,
    contentRelativePath: path.relative(contentRoot, absolutePath).replace(/\\/g, '/'),
    suffix
  };
};

export const toContentAssetUrl = (contentRelativePath, base = '/') => {
  const normalizedBase = String(base || '/').endsWith('/') ? String(base || '/') : `${base}/`;
  const encoded = contentRelativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${normalizedBase}${CONTENT_ASSET_URL_PREFIX.slice(1)}${encoded}`;
};

export const stripBasePath = (pathname, base = '/') => {
  const normalizedBase = String(base || '/').replace(/\/+$/, '');
  if (!normalizedBase || normalizedBase === '/') return pathname;
  return pathname.startsWith(normalizedBase)
    ? pathname.slice(normalizedBase.length) || '/'
    : pathname;
};
