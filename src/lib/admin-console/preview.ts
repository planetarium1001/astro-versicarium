import { performance } from 'node:perf_hooks';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import rehypeShiki from '@shikijs/rehype';
import type { RehypeShikiOptions } from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkSmartypants from 'remark-smartypants';
import { unified } from 'unified';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';
import {
  createMarkdownShikiTransformers,
  createProjectMarkdownRehypePlugins,
  createProjectMarkdownRemarkPlugins,
  markdownShikiThemes,
  markdownSmartypantsOptions
} from '../../plugins/markdown-pipeline.mjs';
import { replaceAboutContactLinksPlaceholderHtml } from '../about-contact-links';
import { getThemeSettings } from '../theme-settings';
import {
  parseTrailingLinks,
  renderTrailingLinksHtml,
  stripTrailingLinks
} from '../trailing-links';
import {
  resolveAdminContentEntrySourcePath
} from './content-entry-source';
import type { AdminContentCollectionKey } from './content-collections';
import { extractMarkdownOutline } from './editor-outline';
import { getProjectRoot } from '../project-root';

export const ADMIN_PREVIEW_CODE_HIGHLIGHT_MODE = 'shiki-rehype' as const;

export type AdminPreviewCodeHighlightMode = typeof ADMIN_PREVIEW_CODE_HIGHLIGHT_MODE;

export type AdminMarkdownPreviewInput = {
  collection: AdminContentCollectionKey;
  entryId?: string;
  source: string;
};

export type AdminMarkdownPreviewResult = {
  collection: AdminContentCollectionKey;
  html: string;
  elapsedMs: number;
  codeHighlight: AdminPreviewCodeHighlightMode;
  warnings: string[];
};

const previewCodeHighlightCache: NonNullable<RehypeShikiOptions['cache']> = new Map();
const PREVIEW_IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const PREVIEW_OUTLINE_KEY_ATTR = 'data-admin-outline-key';

const PREVIEW_SHIKI_LANGUAGES: NonNullable<RehypeShikiOptions['langs']> = [
  'astro',
  'bash',
  'css',
  'dockerfile',
  'go',
  'html',
  'javascript',
  'jsx',
  'json',
  'markdown',
  'python',
  'rust',
  'scss',
  'sql',
  'svelte',
  'toml',
  'ts',
  'tsx',
  'typescript',
  'yaml'
];

const previewShikiOptions: RehypeShikiOptions = {
  themes: { ...markdownShikiThemes },
  langs: PREVIEW_SHIKI_LANGUAGES,
  transformers: createMarkdownShikiTransformers(),
  addLanguageClass: true,
  fallbackLanguage: 'text',
  cache: previewCodeHighlightCache
};

const previewBase = import.meta.env.BASE_URL ?? '/';

const isInsideProject = (filePath: string): boolean => {
  const relative = path.relative(getProjectRoot(), filePath);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const hasUrlScheme = (value: string): boolean => /^[a-z][a-z\d+.-]*:/i.test(value);

const toViteFsUrl = (filePath: string): string => `/@fs${pathToFileURL(filePath).pathname}`;

/**
 * 预览里的本地图片解析结果。
 *
 * 早先这里用 `null` 表示「不是本地图片 / 越界 / 扩展名不支持 / 文件不存在」九种情况，
 * 调用方无法区分「本来就该原样保留」与「本地图片但文件丢了」。现在把原因显式带出来，
 * 需要提示作者的场景可以直接按 `reason` 分支，不必再猜。
 */
export type AdminPreviewLocalImageResolution =
  | { ok: true; src: string }
  | { ok: false; reason: AdminPreviewLocalImageFailureReason };

export type AdminPreviewLocalImageFailureReason =
  /** 空 src。 */
  | 'empty'
  /** 站内绝对路径（`/images/...`），由构建期资源管线处理，预览不改写。 */
  | 'site-absolute'
  /** 协议相对 URL（`//cdn...`）。 */
  | 'protocol-relative'
  /** 页内锚点（`#...`）。 */
  | 'anchor'
  /** 带 query 或 hash，指向的不是磁盘上的裸路径。 */
  | 'decorated'
  /** 带 URL scheme（`https:` / `data:` / `mailto:` 等），不是本地文件。 */
  | 'remote'
  /** 解析后越出仓库根目录。 */
  | 'outside-project'
  /** 扩展名不在预览可内联的图片白名单内。 */
  | 'unsupported-extension'
  /** 扩展名合法、路径在仓库内，但磁盘上没有这个文件。 */
  | 'missing';

export const resolvePreviewLocalImage = (
  sourceFilePath: string,
  value: string
): AdminPreviewLocalImageResolution => {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.startsWith('//')) return { ok: false, reason: 'protocol-relative' };
  if (trimmed.startsWith('/')) return { ok: false, reason: 'site-absolute' };
  if (trimmed.startsWith('#')) return { ok: false, reason: 'anchor' };
  if (trimmed.includes('?') || trimmed.includes('#')) return { ok: false, reason: 'decorated' };
  if (hasUrlScheme(trimmed)) return { ok: false, reason: 'remote' };

  let decoded = trimmed;
  try {
    decoded = decodeURI(trimmed);
  } catch {
    // 非法百分号转义：沿用原字符串继续按路径解析，越界与白名单校验仍在后面兜底。
  }

  const filePath = path.resolve(path.dirname(sourceFilePath), decoded);
  if (!isInsideProject(filePath)) return { ok: false, reason: 'outside-project' };
  if (!PREVIEW_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return { ok: false, reason: 'unsupported-extension' };
  }
  if (!existsSync(filePath)) return { ok: false, reason: 'missing' };

  return { ok: true, src: toViteFsUrl(filePath) };
};

const createPreviewImageSrcPlugin = (sourceFilePath: string | null): Plugin<[], Root> => {
  return () => (tree) => {
    if (!sourceFilePath) return;

    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return;
      const src = node.properties?.src;
      if (typeof src !== 'string') return;

      const resolution = resolvePreviewLocalImage(sourceFilePath, src);
      if (resolution.ok) {
        node.properties.src = resolution.src;
      }
    });
  };
};

const createPreviewOutlineAnchorPlugin = (source: string): Plugin<[], Root> => {
  const outlineItems = extractMarkdownOutline(source);
  const outlineKeyByPosition = new Map(outlineItems.map((item) => [item.key, item.key]));
  const outlineKeyByLine = new Map(outlineItems.map((item) => [item.line, item.key]));

  return () => (tree) => {
    if (outlineItems.length === 0) return;

    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'h2' && node.tagName !== 'h3') return;

      const start = node.position?.start;
      const positionKey = typeof start?.line === 'number' && typeof start.offset === 'number'
        ? `${start.line}:${start.offset}`
        : '';
      const outlineKey = positionKey
        ? outlineKeyByPosition.get(positionKey) ?? outlineKeyByLine.get(start?.line ?? 0)
        : outlineKeyByLine.get(start?.line ?? 0);
      if (!outlineKey) return;

      node.properties = {
        ...node.properties,
        [PREVIEW_OUTLINE_KEY_ATTR]: outlineKey
      };
    });
  };
};

const useProcessorPlugin = (processor: any, pluginEntry: any) => {
  if (Array.isArray(pluginEntry)) {
    processor.use(pluginEntry[0], pluginEntry[1]);
    return processor;
  }

  processor.use(pluginEntry);
  return processor;
};

const createPreviewProcessor = (collection: AdminContentCollectionKey, sourceFilePath: string | null, source: string) => {
  const isAboutPreview = collection === 'about';
  const projectRemarkPlugins = createProjectMarkdownRemarkPlugins({ aboutEnabled: isAboutPreview });
  const [
    rehypeProtectMath,
    rehypeRawHtml,
    rehypeRestoreMathBoundary,
    rehypeAbout,
    rehypeContentAssetLinks,
    rehypeDeploymentBaseLinks,
    rehypeSanitizeSchema,
    rehypeRenderKatex
  ] = createProjectMarkdownRehypePlugins({
    aboutBase: previewBase,
    aboutEnabled: isAboutPreview
  });

  const processor = unified()
    .use(remarkParse)
    // GFM 与 smartypants 用等价插件补齐，与公开侧的 Astro 内建行为对齐。
    .use(remarkGfm)
    .use(remarkSmartypants, markdownSmartypantsOptions);

  projectRemarkPlugins.forEach((pluginEntry) => useProcessorPlugin(processor, pluginEntry));

  processor.use(remarkRehype, { allowDangerousHtml: true });
  processor.use(createPreviewOutlineAnchorPlugin(source));
  useProcessorPlugin(processor, rehypeProtectMath);
  processor.use(rehypeShiki, previewShikiOptions);
  useProcessorPlugin(processor, rehypeRawHtml);
  useProcessorPlugin(processor, rehypeRestoreMathBoundary);
  processor.use(createPreviewImageSrcPlugin(sourceFilePath));
  useProcessorPlugin(processor, rehypeAbout);
  useProcessorPlugin(processor, rehypeContentAssetLinks);
  useProcessorPlugin(processor, rehypeDeploymentBaseLinks);
  useProcessorPlugin(processor, rehypeSanitizeSchema);
  useProcessorPlugin(processor, rehypeRenderKatex);

  return processor
    .use(rehypeStringify);
};

const roundElapsedMs = (value: number): number => Math.round(value * 10) / 10;

/** 末尾链接组只属于 projects / devlog，blog 与 bits 的正文原样渲染。 */
const usesTrailingLinks = (collection: AdminContentCollectionKey): boolean =>
  collection === 'projects' || collection === 'devlog';

export const renderAdminMarkdownPreview = async ({
  collection,
  entryId,
  source
}: AdminMarkdownPreviewInput): Promise<AdminMarkdownPreviewResult> => {
  const startedAt = performance.now();
  const sourceFilePath = entryId ? resolveAdminContentEntrySourcePath(collection, entryId) : null;
  // 与站点一致：先剥离末尾链接组再渲染正文，最后补上与站点相同的链接行标记。
  const links = usesTrailingLinks(collection) ? parseTrailingLinks(source) : [];
  const previewSource = links.length > 0 ? stripTrailingLinks(source) : source;
  const previewProcessor = createPreviewProcessor(collection, sourceFilePath, previewSource);
  const file = await previewProcessor.process(previewSource);
  const bodyHtml = collection === 'about'
    ? replaceAboutContactLinksPlaceholderHtml(
        String(file),
        getThemeSettings().settings.site.socialLinks.resolvedSocialItems
      )
    : String(file);
  const html = `${bodyHtml}${renderTrailingLinksHtml(links, previewBase)}`;

  return {
    collection,
    html,
    elapsedMs: roundElapsedMs(performance.now() - startedAt),
    codeHighlight: ADMIN_PREVIEW_CODE_HIGHLIGHT_MODE,
    warnings: file.messages.map((message) => String(message))
  };
};
