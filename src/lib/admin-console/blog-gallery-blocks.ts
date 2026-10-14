import {
  collectBlogImageIgnoredRanges,
  decodeHtmlText,
  getBoundedBlogImageSelection,
  getHtmlAttributeValue,
  isRangeIgnored,
  resolveNearbyImageSearchChars,
  selectionHitsRange,
  type BlogImageTextRange
} from './blog-image-blocks';

export type BlogGalleryColumnMode = 'default' | 'cols-2' | 'cols-3';

export type BlogGalleryImageDraft = {
  src: string;
  alt: string;
  caption: string;
};

export type BlogGalleryBlockDraft = {
  columns: BlogGalleryColumnMode;
  items: BlogGalleryImageDraft[];
};

export type BlogGalleryBlock = {
  kind: 'gallery';
  range: BlogImageTextRange;
  sourceText: string;
  draft: BlogGalleryBlockDraft;
};

type BlogGalleryImageSource = {
  kind: 'gallery';
  src: string;
  range: BlogImageTextRange;
};

export type BlogGalleryBlockSearchOptions = {
  maxChars?: number;
};

const GALLERY_LIST_RE = /<ul\b[^>]*>([\s\S]*?)<\/ul>/gi;
const GALLERY_LIST_OPEN_RE = /<ul\b[^>]*>/gi;
const GALLERY_LIST_CLOSE_RE = /<\/ul>/i;
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const GALLERY_ITEM_RE = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
const CONTROLLED_GALLERY_BLOCK_RE = /^<ul\b[^>]*>([\s\S]*?)<\/ul>$/i;
const CONTROLLED_FIGURE_RE = /^\s*<figure\s*>([\s\S]*?)<\/figure>\s*$/i;
const CONTROLLED_ITEM_BODY_RE =
  /^\s*(<img\b[^>]*\/?>)\s*(?:<figcaption\s*>([\s\S]*?)<\/figcaption>)?\s*$/i;
const HTML_TAG_RE = /<[A-Za-z/!][^>]*>/;
const HTML_ATTRIBUTE_RE = /\s+([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
const CONTROLLED_GALLERY_LIST_CLASS_NAMES = new Set(['gallery', 'cols-2', 'cols-3']);
const CONTROLLED_GALLERY_IMAGE_ATTRIBUTE_NAMES = new Set(['src', 'alt', 'loading', 'decoding']);

const getClassNames = (tag: string): string[] =>
  getHtmlAttributeValue(tag, 'class')
    .split(/\s+/)
    .filter(Boolean);

const getHtmlAttributeNames = (tag: string): string[] => {
  const attributes = tag.match(/^<\s*[A-Za-z][\w:-]*\b([\s\S]*?)\/?\s*>$/)?.[1] ?? '';
  return Array.from(attributes.matchAll(HTML_ATTRIBUTE_RE), (match) => match[1] ?? '')
    .filter(Boolean);
};

const getControlledColumns = (classNames: readonly string[]): BlogGalleryColumnMode | null => {
  if (!classNames.includes('gallery')) return null;
  if (classNames.some((className) => !CONTROLLED_GALLERY_LIST_CLASS_NAMES.has(className))) {
    return null;
  }

  const columnClassNames = classNames.filter((className) => className === 'cols-2' || className === 'cols-3');
  if (columnClassNames.length > 1) return null;

  return columnClassNames[0] ?? 'default';
};

const isControlledGalleryImageTag = (tag: string): boolean => {
  const attributeNames = getHtmlAttributeNames(tag);
  if (!attributeNames.includes('src') || !attributeNames.includes('alt')) return false;
  if (attributeNames.some((name) => !CONTROLLED_GALLERY_IMAGE_ATTRIBUTE_NAMES.has(name))) {
    return false;
  }

  const loading = getHtmlAttributeValue(tag, 'loading');
  const decoding = getHtmlAttributeValue(tag, 'decoding');
  return (!loading || loading === 'lazy') && (!decoding || decoding === 'async');
};

const parseControlledGalleryItem = (itemHtml: string): BlogGalleryImageDraft | null => {
  const figureBody = itemHtml.match(CONTROLLED_FIGURE_RE)?.[1] ?? null;
  if (figureBody === null) return null;

  const itemMatch = figureBody.match(CONTROLLED_ITEM_BODY_RE);
  const imageTag = itemMatch?.[1] ?? '';
  if (!imageTag || !isControlledGalleryImageTag(imageTag)) return null;

  const captionHtml = (itemMatch?.[2] ?? '').trim();
  if (HTML_TAG_RE.test(captionHtml)) return null;

  return {
    src: getHtmlAttributeValue(imageTag, 'src'),
    alt: getHtmlAttributeValue(imageTag, 'alt'),
    caption: decodeHtmlText(captionHtml)
  };
};

const parseControlledGalleryItems = (body: string): BlogGalleryImageDraft[] | null => {
  const items: BlogGalleryImageDraft[] = [];
  let cursor = 0;

  for (const match of body.matchAll(GALLERY_ITEM_RE)) {
    const matchIndex = match.index ?? 0;
    if (body.slice(cursor, matchIndex).trim()) return null;
    if (!/^<li\s*>/i.test(match[0].match(/<li\b[^>]*>/i)?.[0] ?? '')) return null;

    const item = parseControlledGalleryItem(match[1] ?? '');
    if (!item) return null;

    items.push(item);
    cursor = matchIndex + match[0].length;
  }

  if (body.slice(cursor).trim() || items.length === 0) return null;
  return items;
};

const parseControlledGalleryBlock = (sourceText: string, offset = 0): BlogGalleryBlock | null => {
  const body = sourceText.match(CONTROLLED_GALLERY_BLOCK_RE)?.[1] ?? null;
  if (body === null) return null;

  const listTag = sourceText.match(/<ul\b[^>]*>/i)?.[0] ?? '';
  const columns = getControlledColumns(getClassNames(listTag));
  if (!columns) return null;

  const items = parseControlledGalleryItems(body);
  if (!items) return null;

  return {
    kind: 'gallery',
    range: {
      from: offset,
      to: offset + sourceText.length
    },
    sourceText,
    draft: {
      columns,
      items
    }
  };
};

const parseBlogGalleryBlocks = (
  source: string,
  ignoredRanges: readonly BlogImageTextRange[],
  offset = 0
): BlogGalleryBlock[] =>
  Array.from(source.matchAll(GALLERY_LIST_RE))
    .map((match): BlogGalleryBlock | null => {
      const from = (match.index ?? 0) + offset;
      const block = parseControlledGalleryBlock(match[0], from);
      if (!block || isRangeIgnored(block.range, ignoredRanges)) return null;
      return block;
    })
    .filter((block): block is BlogGalleryBlock => block !== null);

const getGallerySearchRangeAroundSelection = (
  source: string,
  selection: BlogImageTextRange,
  maxChars: number
): BlogImageTextRange => ({
  from: Math.max(0, selection.from - maxChars),
  to: Math.min(source.length, selection.to + maxChars)
});

const findGalleryCandidateOpenings = (
  source: string,
  searchRange: BlogImageTextRange,
  selection: BlogImageTextRange
): number[] =>
  Array.from(source.slice(searchRange.from, searchRange.to).matchAll(GALLERY_LIST_OPEN_RE), (match) =>
    searchRange.from + (match.index ?? 0)
  )
    .filter((from) => from <= selection.to)
    .reverse();

const findGalleryCandidateCloseEnd = (
  source: string,
  from: number,
  to: number
): number | null => {
  const closeMatch = source.slice(from, to).match(GALLERY_LIST_CLOSE_RE);
  return closeMatch && closeMatch.index !== undefined
    ? from + closeMatch.index + closeMatch[0].length
    : null;
};

const collectBlogGalleryBlocks = (source: string): BlogGalleryBlock[] => {
  const ignoredRanges = collectBlogImageIgnoredRanges(source);
  return parseBlogGalleryBlocks(source, ignoredRanges);
};

export const findBlogGalleryBlockAtSelection = (
  source: string,
  selection: BlogImageTextRange
): BlogGalleryBlock | null => {
  const boundedSelection = getBoundedBlogImageSelection(source, selection);
  return collectBlogGalleryBlocks(source).find((block) => selectionHitsRange(boundedSelection, block.range)) ?? null;
};

export const findBlogGalleryBlockAroundSelection = (
  source: string,
  selection: BlogImageTextRange,
  options: BlogGalleryBlockSearchOptions = {}
): BlogGalleryBlock | null => {
  const boundedSelection = getBoundedBlogImageSelection(source, selection);
  const ignoredRanges = collectBlogImageIgnoredRanges(source);
  const maxChars = resolveNearbyImageSearchChars(options.maxChars);
  const searchRange = getGallerySearchRangeAroundSelection(source, boundedSelection, maxChars);

  for (const openFrom of findGalleryCandidateOpenings(source, searchRange, boundedSelection)) {
    const closeEnd = findGalleryCandidateCloseEnd(
      source,
      Math.max(openFrom, boundedSelection.to),
      searchRange.to
    );
    if (closeEnd === null) continue;

    const block = parseControlledGalleryBlock(source.slice(openFrom, closeEnd), openFrom);
    if (
      block
      && selectionHitsRange(boundedSelection, block.range)
      && !isRangeIgnored(block.range, ignoredRanges)
    ) {
      return block;
    }
  }

  return null;
};

export const collectBlogGalleryImageSources = (source: string): BlogGalleryImageSource[] => {
  const ignoredRanges = collectBlogImageIgnoredRanges(source);
  const references: BlogGalleryImageSource[] = [];

  for (const match of source.matchAll(GALLERY_LIST_RE)) {
    const from = match.index ?? 0;
    const range = { from, to: from + match[0].length };
    if (isRangeIgnored(range, ignoredRanges)) continue;

    const listTag = match[0].match(/<ul\b[^>]*>/i)?.[0] ?? '';
    if (!getClassNames(listTag).includes('gallery')) continue;

    const body = match[1] ?? '';
    const bodyOffset = from + listTag.length;
    for (const imageMatch of body.matchAll(IMG_TAG_RE)) {
      const imageFrom = bodyOffset + (imageMatch.index ?? 0);
      const imageRange = { from: imageFrom, to: imageFrom + imageMatch[0].length };
      if (isRangeIgnored(imageRange, ignoredRanges)) continue;

      const src = getHtmlAttributeValue(imageMatch[0], 'src');
      if (!src) continue;

      references.push({
        kind: 'gallery',
        src,
        range: imageRange
      });
    }
  }

  return references;
};
