/**
 * projects / devlog 的正文渲染：先剥离末尾链接组，再用与站点一致的 markdown 处理器渲染，
 * 最后附加共享的链接行标记。
 */
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { createPublicMarkdownConfig } from '../plugins/markdown-pipeline.mjs';
import { deriveMarkdownText, truncateText } from '../utils/excerpt';
import {
  parseTrailingLinks,
  renderTrailingLinksHtml,
  stripTrailingLinks,
  type TrailingLink
} from './trailing-links';

type MarkdownRenderer = Awaited<ReturnType<typeof createMarkdownProcessor>>;

/** 同一 base 只建一个处理器：站点 markdown 配置不随页面变化。 */
const rendererByBase = new Map<string, Promise<MarkdownRenderer>>();

const getMarkdownRenderer = (base: string): Promise<MarkdownRenderer> => {
  let renderer = rendererByBase.get(base);
  if (!renderer) {
    renderer = createMarkdownProcessor(createPublicMarkdownConfig({ base }));
    rendererByBase.set(base, renderer);
  }
  return renderer;
};

type RenderedEntryBody = {
  /** 正文 html；有末尾链接组时其后紧跟链接行标记。 */
  html: string;
  /** 末尾链接组，按书写顺序；只渲染链接行的场景（如项目卡片）用它。 */
  links: TrailingLink[];
};

export const renderEntryBody = async (
  body: string | null | undefined,
  base: string
): Promise<RenderedEntryBody> => {
  const source = body ?? '';
  const links = parseTrailingLinks(source);
  const renderer = await getMarkdownRenderer(base);
  const { code } = await renderer.render(links.length > 0 ? stripTrailingLinks(source) : source);
  return { html: `${code}${renderTrailingLinksHtml(links, base)}`, links };
};

/**
 * 卡片与列表行的摘要：优先 frontmatter 的 description，缺失时从去除末尾链接组的正文派生。
 */
export const deriveEntryDescription = (
  description: string | undefined,
  body: string | null | undefined
): string | null =>
  description?.trim()
  || truncateText(deriveMarkdownText(stripTrailingLinks(body)).excerptText, 120)
  || null;
