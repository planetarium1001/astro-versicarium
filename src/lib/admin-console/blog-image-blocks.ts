type BlogImageTextSelection = {
  from: number;
  to: number;
};

export type BlogImageTextRange = BlogImageTextSelection;

export type BlogImageBlockKind = 'markdown' | 'figure';
export type BlogImageInsertPresentation = 'plain' | 'figure';
export type BlogImageDisplaySize = 'default' | 'sm' | 'md' | 'lg' | 'full';
export type BlogImageDisplayAlignment = 'center' | 'left' | 'right';

export type BlogImageBlockDraft = {
  src: string;
  alt: string;
  presentation: BlogImageInsertPresentation;
  caption: string;
  size: BlogImageDisplaySize;
  alignment: BlogImageDisplayAlignment;
};

export type BlogImageBlock = {
  kind: BlogImageBlockKind;
  range: BlogImageTextRange;
  draft: BlogImageBlockDraft;
  sourceText: string;
};

const MARKDOWN_IMAGE_RE =
  /!\[((?:\\.|[^\]\\\n])*)]\(\s*(<[^>\n]+>|[^\s)\n]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const FIGURE_RE = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const FIGCAPTION_RE = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const INLINE_CODE_SPAN_RE = /`+[^`\n]*`+/g;
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const HTML_TEXT_ENTITY_RE = /&(amp|quot|#39|lt|gt);/gi;
const HTML_TEXT_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  '#39': "'",
  lt: '<',
  gt: '>'
};

const IMAGE_DISPLAY_SIZES = new Set<BlogImageDisplaySize>(['default', 'sm', 'md', 'lg', 'full']);
const IMAGE_DISPLAY_ALIGNMENTS = new Set<BlogImageDisplayAlignment>(['center', 'left', 'right']);
const DEFAULT_NEARBY_IMAGE_SEARCH_CHARS = 8192;
const MIN_NEARBY_IMAGE_SEARCH_CHARS = 512;

export const resolveNearbyImageSearchChars = (value?: number): number =>
  Math.max(MIN_NEARBY_IMAGE_SEARCH_CHARS, value ?? DEFAULT_NEARBY_IMAGE_SEARCH_CHARS);

export const getBoundedBlogImageSelection = (
  value: string,
  selection: BlogImageTextSelection
): BlogImageTextSelection => ({
  from: Math.max(0, Math.min(value.length, Math.min(selection.from, selection.to))),
  to: Math.max(0, Math.min(value.length, Math.max(selection.from, selection.to)))
});

const rangesOverlap = (a: BlogImageTextRange, b: BlogImageTextRange): boolean =>
  a.from < b.to && b.from < a.to;

export const selectionHitsRange = (
  selection: BlogImageTextSelection,
  range: BlogImageTextRange
): boolean =>
  selection.from === selection.to
    ? selection.from >= range.from && selection.from <= range.to
    : rangesOverlap(selection, range);

export const isRangeIgnored = (
  range: BlogImageTextRange,
  ignoredRanges: readonly BlogImageTextRange[]
): boolean =>
  ignoredRanges.some((ignoredRange) => rangesOverlap(range, ignoredRange));

const collectMarkdownFenceRanges = (source: string): BlogImageTextRange[] => {
  const ranges: BlogImageTextRange[] = [];
  let offset = 0;
  let fence: { char: string; length: number; from: number } | null = null;

  for (const line of source.match(/[^\n]*(?:\n|$)/g) ?? []) {
    if (!line) continue;

    const content = (line.endsWith('\n') ? line.slice(0, -1) : line).replace(/\r$/, '');
    if (!fence) {
      const marker = content.match(FENCE_OPEN_RE)?.[1] ?? '';
      if (marker) {
        fence = { char: marker[0] ?? '', length: marker.length, from: offset };
      }
      offset += line.length;
      continue;
    }

    const marker = content.match(FENCE_CLOSE_RE)?.[1] ?? '';
    if ((marker[0] ?? '') === fence.char && marker.length >= fence.length) {
      ranges.push({ from: fence.from, to: offset + line.length });
      fence = null;
    }
    offset += line.length;
  }

  if (fence) {
    ranges.push({ from: fence.from, to: source.length });
  }

  return ranges;
};

const collectRegexRanges = (source: string, pattern: RegExp): BlogImageTextRange[] =>
  Array.from(source.matchAll(pattern), (match) => ({
    from: match.index ?? 0,
    to: (match.index ?? 0) + match[0].length
  }));

export const collectBlogImageIgnoredRanges = (source: string): BlogImageTextRange[] => [
  ...collectMarkdownFenceRanges(source),
  ...collectRegexRanges(source, HTML_COMMENT_RE),
  ...collectRegexRanges(source, INLINE_CODE_SPAN_RE)
];

const unescapeMarkdownAlt = (value: string): string => {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? '';
    if (char === '\\' && index + 1 < value.length) {
      result += value[index + 1] ?? '';
      index += 1;
      continue;
    }
    result += char;
  }
  return result;
};

export const normalizeMarkdownImageSource = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
};

export const decodeHtmlText = (value: string): string =>
  value.replace(
    HTML_TEXT_ENTITY_RE,
    (entity) => HTML_TEXT_ENTITIES[entity.slice(1, -1).toLowerCase()] ?? entity
  );

export const getHtmlAttributeValue = (tag: string, name: string): string => {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i');
  return decodeHtmlText(tag.match(pattern)?.[2] ?? '');
};

const getFigureClassNames = (figureHtml: string): string[] =>
  getHtmlAttributeValue(figureHtml.match(/<figure\b[^>]*>/i)?.[0] ?? '', 'class')
    .split(/\s+/)
    .filter(Boolean);

const getFigureSize = (classNames: readonly string[]): BlogImageDisplaySize => {
  const size = classNames
    .map((className) => className.match(/^figure--(sm|md|lg|full)$/)?.[1])
    .find((value): value is BlogImageDisplaySize =>
      Boolean(value) && IMAGE_DISPLAY_SIZES.has(value as BlogImageDisplaySize)
    );
  return size ?? 'default';
};

const getFigureAlignment = (classNames: readonly string[]): BlogImageDisplayAlignment => {
  const alignment = classNames
    .map((className) => className.match(/^figure--(center|left|right)$/)?.[1])
    .find((value): value is BlogImageDisplayAlignment =>
      Boolean(value) && IMAGE_DISPLAY_ALIGNMENTS.has(value as BlogImageDisplayAlignment)
    );
  return alignment ?? 'center';
};

const getFigureCaption = (figureBody: string): string | null => {
  const captionHtml = figureBody.match(FIGCAPTION_RE)?.[1]?.trim() ?? '';
  if (!captionHtml) return '';
  if (/<[^>]*>/.test(captionHtml)) return null;
  return decodeHtmlText(captionHtml);
};

const parseMarkdownImageBlocks = (
  source: string,
  ignoredRanges: readonly BlogImageTextRange[],
  offset = 0
): BlogImageBlock[] =>
  Array.from(source.matchAll(MARKDOWN_IMAGE_RE))
    .map((match): BlogImageBlock | null => {
      const from = (match.index ?? 0) + offset;
      const range = { from, to: from + match[0].length };
      if (isRangeIgnored(range, ignoredRanges)) return null;

      return {
        kind: 'markdown',
        range,
        sourceText: match[0],
        draft: {
          src: normalizeMarkdownImageSource(match[2] ?? ''),
          alt: unescapeMarkdownAlt(match[1] ?? ''),
          presentation: 'plain',
          caption: '',
          size: 'default',
          alignment: 'center'
        }
      };
    })
    .filter((block): block is BlogImageBlock => block !== null);

const parseFigureImageBlocks = (
  source: string,
  ignoredRanges: readonly BlogImageTextRange[],
  offset = 0
): BlogImageBlock[] =>
  Array.from(source.matchAll(FIGURE_RE))
    .map((match): BlogImageBlock | null => {
      const from = (match.index ?? 0) + offset;
      const range = { from, to: from + match[0].length };
      if (isRangeIgnored(range, ignoredRanges)) return null;

      const figureBody = match[1] ?? '';
      if (/<picture\b/i.test(figureBody)) return null;

      const imageTags = Array.from(figureBody.matchAll(IMG_TAG_RE), (imageMatch) => imageMatch[0]);
      if (imageTags.length !== 1) return null;

      const classNames = getFigureClassNames(match[0]);
      if (!classNames.includes('figure')) return null;

      const caption = getFigureCaption(figureBody);
      if (caption === null) return null;
      return {
        kind: 'figure',
        range,
        sourceText: match[0],
        draft: {
          src: getHtmlAttributeValue(imageTags[0] ?? '', 'src'),
          alt: getHtmlAttributeValue(imageTags[0] ?? '', 'alt'),
          presentation: caption ? 'figure' : 'plain',
          caption,
          size: getFigureSize(classNames),
          alignment: getFigureAlignment(classNames)
        }
      };
    })
    .filter((block): block is BlogImageBlock => block !== null);

const sortImageBlocks = (blocks: BlogImageBlock[]): BlogImageBlock[] =>
  blocks.sort((a, b) =>
    a.range.from - b.range.from || (a.range.to - a.range.from) - (b.range.to - b.range.from)
  );

export const collectBlogImageBlocks = (source: string): BlogImageBlock[] => {
  const ignoredRanges = collectBlogImageIgnoredRanges(source);
  return sortImageBlocks([
    ...parseFigureImageBlocks(source, ignoredRanges),
    ...parseMarkdownImageBlocks(source, ignoredRanges)
  ]);
};

export const findBlogImageBlockAtSelection = (
  source: string,
  selection: BlogImageTextSelection
): BlogImageBlock | null => {
  const boundedSelection = getBoundedBlogImageSelection(source, selection);
  return collectBlogImageBlocks(source).find((block) => selectionHitsRange(boundedSelection, block.range)) ?? null;
};
