import { toSafeHttpUrl } from '../../../../utils/format';
import type {
  BlogGalleryBlockDraft,
  BlogGalleryColumnMode,
  BlogGalleryImageDraft
} from '../../../../lib/admin-console/blog-gallery-blocks';
import type { MarkdownInsertPlacement } from '../markdown/markdown-tools';
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  normalizeInlineText
} from './editor-html-escape';

export const GALLERY_IMAGE_SOURCE_ERROR = '请输入 https:// 图片链接或本地图片路径';

export type GalleryColumnMode = BlogGalleryColumnMode;

export type GalleryImageDraft = BlogGalleryImageDraft;

export type GalleryBlockDraft = BlogGalleryBlockDraft;

type GalleryInsertText = {
  text: string;
  placement: MarkdownInsertPlacement;
};

const SOURCE_PROTOCOL_RE = /^[A-Za-z][A-Za-z\d+.-]*:/;
const LOCAL_IMAGE_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const normalizeLocalGalleryImageSource = (value: string): string | null => {
  const source = value.replace(/\\/g, '/');
  if (source.startsWith('/') || source.startsWith('//')) return null;

  const pathPart = (source.split(/[?#]/, 1)[0] ?? '').trim();
  if (
    !pathPart
    || pathPart.startsWith('/')
    || pathPart.startsWith('//')
    || pathPart.startsWith('public/')
    || /(^|\/)\.\.(?:\/|$)/.test(pathPart)
    || !LOCAL_IMAGE_EXT_RE.test(pathPart)
  ) {
    return null;
  }

  return source;
};

export const normalizeGalleryImageSource = (value: string): string | null => {
  const source = value.trim();
  if (!source || source.startsWith('//')) return null;

  if (SOURCE_PROTOCOL_RE.test(source)) {
    const safeUrl = toSafeHttpUrl(source);
    return safeUrl.startsWith('https://') ? safeUrl : null;
  }

  return normalizeLocalGalleryImageSource(source);
};

const getGalleryClassName = (columns: GalleryColumnMode): string =>
  columns === 'default' ? 'gallery' : `gallery ${columns}`;

const createGalleryBlock = ({ columns, items }: GalleryBlockDraft): string => {
  const lines = [`<ul class="${escapeHtmlAttribute(getGalleryClassName(columns))}">`];

  for (const item of items) {
    const caption = normalizeInlineText(item.caption);
    lines.push(
      '  <li>',
      '    <figure>',
      `      <img src="${escapeHtmlAttribute(item.src)}" alt="${escapeHtmlAttribute(normalizeInlineText(item.alt))}" loading="lazy" decoding="async" />`,
      ...(caption ? [`      <figcaption>${escapeHtmlText(caption)}</figcaption>`] : []),
      '    </figure>',
      '  </li>'
    );
  }

  lines.push('</ul>');
  return lines.join('\n');
};

export const createGalleryInsertText = (draft: GalleryBlockDraft): GalleryInsertText => ({
  text: createGalleryBlock(draft),
  placement: 'block'
});
