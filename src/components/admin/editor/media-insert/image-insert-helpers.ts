import { toSafeHttpUrl } from '../../../../utils/format';
import type {
  BlogImageBlockDraft,
  BlogImageDisplayAlignment,
  BlogImageDisplaySize,
  BlogImageInsertPresentation
} from '../../../../lib/admin-console/blog-image-blocks';
import type { MarkdownInsertPlacement } from '../markdown/markdown-tools';
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  normalizeInlineText
} from './editor-html-escape';

export const REMOTE_IMAGE_URL_ERROR = '请输入 https:// 开头的图片链接';

export type ImageInsertPresentation = BlogImageInsertPresentation;
export type ImageDisplaySize = BlogImageDisplaySize;
export type ImageDisplayAlignment = BlogImageDisplayAlignment;
export type ImageBlockDraft = BlogImageBlockDraft;

type ImageInsertText = {
  text: string;
  placement?: MarkdownInsertPlacement;
};

const escapeRemoteMarkdownImageUrl = (value: string): string =>
  value.replace(/\(/g, '%28').replace(/\)/g, '%29');

export const normalizeRemoteMarkdownImageUrl = (value: string): string | null => {
  const safeUrl = toSafeHttpUrl(value);
  return safeUrl.startsWith('https://') ? escapeRemoteMarkdownImageUrl(safeUrl) : null;
};

const escapeMarkdownAlt = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').replace(/\\/g, '\\\\').replace(/]/g, '\\]');

export const createMarkdownImage = (alt: string, src: string): string =>
  `![${escapeMarkdownAlt(alt)}](${src})`;

const getFigureClassNames = (draft: ImageBlockDraft): string[] => [
  'figure',
  ...(draft.size === 'default' ? [] : [`figure--${draft.size}`]),
  `figure--${draft.alignment}`
];

const shouldUseFigureImageBlock = (draft: ImageBlockDraft): boolean =>
  draft.presentation === 'figure'
  || draft.size !== 'default'
  || draft.alignment !== 'center';

const createFigureImageBlock = (draft: ImageBlockDraft): string => {
  const alt = normalizeInlineText(draft.alt);
  const caption = draft.presentation === 'figure' ? normalizeInlineText(draft.caption) : '';
  const className = getFigureClassNames(draft).join(' ');
  const lines = [
    `<figure class="${escapeHtmlAttribute(className)}">`,
    `  <img src="${escapeHtmlAttribute(draft.src)}" alt="${escapeHtmlAttribute(alt)}" />`,
    ...(
      caption
        ? [`  <figcaption class="figure-caption">${escapeHtmlText(caption)}</figcaption>`]
        : []
    ),
    '</figure>'
  ];

  return lines.join('\n');
};

export const createImageInsertText = (draft: ImageBlockDraft): ImageInsertText => {
  if (!shouldUseFigureImageBlock(draft)) {
    return { text: createMarkdownImage(draft.alt, draft.src) };
  }

  // Figure 是写入 Markdown 源文本的受控 HTML；必须在生成点完成 HTML 转义并按 block 插入。
  return {
    text: createFigureImageBlock(draft),
    placement: 'block'
  };
};
