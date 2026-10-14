import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  collectBlogImageBlocks,
  collectBlogImageIgnoredRanges,
  getHtmlAttributeValue,
  isRangeIgnored,
  normalizeMarkdownImageSource
} from './blog-image-blocks';
import { collectBlogGalleryImageSources } from './blog-gallery-blocks';

type MarkdownBodyLocalImageReference = {
  kind: 'markdown' | 'figure' | 'gallery';
  src: string;
  absolutePath: string;
  relativePath: string;
};

type FindMissingMarkdownBodyLocalImageReferencesInput = {
  bodyText: string;
  sourcePath: string;
  projectRoot?: string;
  fileExists?: (absolutePath: string) => boolean;
};

type ImageSourceReference = Pick<MarkdownBodyLocalImageReference, 'kind' | 'src'>;

const FIGURE_RE = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SOURCE_TAG_RE = /<source\b[^>]*>/gi;

/** 解析 `srcset` 的候选 URL（去掉 `1x` / `800w` 之类的描述符）。 */
const parseSrcsetCandidates = (srcset: string): string[] =>
  srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0]?.trim() ?? '')
    .filter(Boolean);

const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

type LocalImagePathPart = {
  /**
   * `relative` —— 相对源文件目录解析（如 `./assets/a.webp`）
   * `public`   —— 以 `/` 开头，按 `public/` 解析（如 `/images/blog/x/a.webp`）
   */
  kind: 'relative' | 'public';
  pathPart: string;
};

/**
 * 校验器必须同时支持相对路径与 `/images/...` 绝对路径。
 * 旧实现遇到前导 `/` 直接返回 null，正文图改用绝对路径后存盘缺图拦截会整体失效。
 */
const getLocalImagePathPart = (src: string): LocalImagePathPart | null => {
  const normalized = normalizeMarkdownImageSource(src);
  // 协议相对（//cdn...）与带 scheme（https:、data:）的都不算本地引用。
  if (!normalized || normalized.startsWith('//') || /^[A-Za-z][A-Za-z\d+.-]*:/.test(normalized)) {
    return null;
  }

  const withoutQuery = (normalized.split(/[?#]/, 1)[0] ?? '').trim().replace(/\\/g, '/');
  if (!withoutQuery) return null;

  if (withoutQuery.startsWith('/')) {
    const pathPart = withoutQuery.replace(/^\/+/, '');
    return pathPart ? { kind: 'public', pathPart } : null;
  }

  return { kind: 'relative', pathPart: withoutQuery };
};

const collectFigureImageSources = (source: string): ImageSourceReference[] => {
  const ignoredRanges = collectBlogImageIgnoredRanges(source);
  const references: ImageSourceReference[] = [];

  for (const match of source.matchAll(FIGURE_RE)) {
    const from = match.index ?? 0;
    const range = { from, to: from + match[0].length };
    if (isRangeIgnored(range, ignoredRanges)) continue;

    const figureHtml = match[0];
    const figureBody = match[1] ?? '';

    const classNames = getHtmlAttributeValue(figureHtml.match(/<figure\b[^>]*>/i)?.[0] ?? '', 'class')
      .split(/\s+/)
      .filter(Boolean);
    if (!classNames.includes('figure')) continue;

    // `<picture>` 里的每个 `<source srcset>` 候选都要纳入校验，不能遇到 picture 整块跳过
    for (const sourceTag of figureBody.matchAll(SOURCE_TAG_RE)) {
      for (const candidate of parseSrcsetCandidates(getHtmlAttributeValue(sourceTag[0], 'srcset'))) {
        references.push({ kind: 'figure', src: candidate });
      }
    }

    const imageTags = Array.from(figureBody.matchAll(IMG_TAG_RE), (imageMatch) => imageMatch[0]);
    // 允许 1 个 `<img>`；picture 场景下 source 已被上面收走。
    for (const imageTag of imageTags) {
      const src = getHtmlAttributeValue(imageTag, 'src');
      if (src) references.push({ kind: 'figure', src });
    }
  }

  return references;
};

const toLocalImageReference = ({
  kind,
  src,
  sourcePath,
  projectRoot
}: {
  kind: MarkdownBodyLocalImageReference['kind'];
  src: string;
  sourcePath: string;
  projectRoot: string;
}): MarkdownBodyLocalImageReference | null => {
  const localPathPart = getLocalImagePathPart(src);
  if (!localPathPart) return null;

  const absolutePath = localPathPart.kind === 'public'
    ? path.resolve(projectRoot, 'public', localPathPart.pathPart)
    : path.resolve(path.dirname(sourcePath), localPathPart.pathPart);
  const relativePath = path.relative(projectRoot, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return {
    kind,
    src: normalizeMarkdownImageSource(src),
    absolutePath,
    relativePath: relativePath.replace(/\\/g, '/')
  };
};

export const collectMarkdownBodyLocalImageReferences = ({
  bodyText,
  sourcePath,
  projectRoot = getProjectRoot()
}: Omit<FindMissingMarkdownBodyLocalImageReferencesInput, 'fileExists'>): MarkdownBodyLocalImageReference[] => {
  const references: MarkdownBodyLocalImageReference[] = [];

  for (const block of collectBlogImageBlocks(bodyText)) {
    if (block.kind !== 'markdown') continue;
    const reference = toLocalImageReference({
      kind: block.kind,
      src: block.draft.src,
      sourcePath,
      projectRoot
    });
    if (reference) references.push(reference);
  }

  for (const image of collectFigureImageSources(bodyText)) {
    const reference = toLocalImageReference({
      kind: image.kind,
      src: image.src,
      sourcePath,
      projectRoot
    });
    if (reference) references.push(reference);
  }

  for (const image of collectBlogGalleryImageSources(bodyText)) {
    const reference = toLocalImageReference({
      kind: image.kind,
      src: image.src,
      sourcePath,
      projectRoot
    });
    if (reference) references.push(reference);
  }

  return references;
};

export const findMissingMarkdownBodyLocalImageReferences = ({
  bodyText,
  sourcePath,
  projectRoot = getProjectRoot(),
  fileExists = existsSync
}: FindMissingMarkdownBodyLocalImageReferencesInput): MarkdownBodyLocalImageReference[] => {
  const seen = new Set<string>();
  const missing: MarkdownBodyLocalImageReference[] = [];

  for (const reference of collectMarkdownBodyLocalImageReferences({ bodyText, sourcePath, projectRoot })) {
    if (fileExists(reference.absolutePath)) continue;
    if (seen.has(reference.relativePath)) continue;

    seen.add(reference.relativePath);
    missing.push(reference);
  }

  return missing;
};
