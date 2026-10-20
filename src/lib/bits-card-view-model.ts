import { createWithBase, formatDateTimeInTimeZone, formatISODateInTimeZone } from '../utils/format';
import { DEFAULT_SITE_TIMEZONE } from '../../site.config.mjs';
import { deriveMarkdownText, truncateTextAtWord } from '../utils/excerpt';
import { normalizeBitsImageSource } from './bits-image-source';
import { getContentImageDimensions, getContentImageSrc, type ContentImageValue } from './content-image';
import { getBitsPagePath } from './bits-public-routing';
import { isRoutableTagKey, toTagKey } from './tags';

/** 卡片正文的可见行数；样式侧同一口径见 bit-card.css 的 `--bit-card-body-lines`。 */
export const BITS_CARD_BODY_LINES = 4;

/** 一行的预算字符数，按正文 14px、约 45 个全角字符估出。 */
export const BITS_CARD_CHARS_PER_LINE = 45;

/**
 * 卡片完整渲染的字符上限，等于可见行数的预算。
 * 它是「渲染完整 Markdown」与「用纯文本摘要截断」两套口径的分界：超过即截断并给出提示。
 */
export const BITS_CARD_FULL_RENDER_LIMIT = BITS_CARD_BODY_LINES * BITS_CARD_CHARS_PER_LINE;

/** 卡片一行最多展示的图片数，多出的部分折叠为 `+N` 角标。 */
export const BITS_CARD_VISIBLE_IMAGE_LIMIT = 4;

export type BitsCardImageInput = {
  src?: ContentImageValue;
  width?: number | string | undefined;
  height?: number | string | undefined;
  alt?: string | undefined;
};

export type BitsCardAuthorInput = {
  name?: string | undefined;
  avatar?: string | undefined;
};

type BitsCardText = {
  plainText: string;
  excerpt: string;
  shouldRenderFull: boolean;
  /** 摘要已按上限截断：卡片需要给出「还有内容」的提示。 */
  truncated: boolean;
};

type BitsCardImageViewModel = {
  src: string;
  width?: number;
  height?: number;
  alt: string;
};

/** 卡片上的标签入口：`href` 指向 `/bits/?tags=<key>`，key 与 entry-search 一致。 */
type BitsCardTagLink = {
  label: string;
  key: string;
  href: string | null;
};

type BitsCardViewModelInput = {
  id: string;
  slug?: string | undefined;
  bodyText: string;
  tags?: readonly string[] | undefined;
  date?: Date | string | null;
  /** 站点时区下的日历日期（YYYY-MM-DD）；纯日期条目用它，避免按时间点格式化出 00:00。 */
  dateText?: string | undefined;
  /** frontmatter 是否显式带时分；只有 false 时按纯日期展示，未传按带时分处理（后台预览调用点兼容）。 */
  dateHasTime?: boolean | undefined;
  images?: readonly BitsCardImageInput[] | undefined;
  author?: BitsCardAuthorInput | null | undefined;
  defaultAuthor?: BitsCardAuthorInput | null | undefined;
  base?: string | undefined;
  timeZone?: string | undefined;
  draft?: boolean | undefined;
};

export type BitsCardViewModel = {
  id: string;
  slug: string;
  draft: boolean;
  body: BitsCardText;
  authorName: string;
  authorAvatar: string;
  avatarLetter: string;
  /** `loc:` 前缀标签；key 参与 /bits/ 的标签筛选，可点时给出链接 */
  placeTag: BitsCardTagLink | null;
  /** 普通标签（`#xxx`），全部为 `/bits/` 的筛选入口 */
  normalTagItems: BitsCardTagLink[];
  hasTags: boolean;
  dateLabel: string;
  imageItems: BitsCardImageViewModel[];
  visibleImages: BitsCardImageViewModel[];
  firstImage: BitsCardImageViewModel | null;
  totalImages: number;
  /** 卡片折叠为 `+N` 的图片数 */
  moreCount: number;
};

const toTagLink = (
  label: string,
  withBase: (path: string) => string,
  keySource: string = label
): BitsCardTagLink => {
  const key = toTagKey(keySource);
  const routable = isRoutableTagKey(key);
  return {
    label,
    key: routable ? key : '',
    href: routable ? withBase(`${getBitsPagePath()}?tags=${encodeURIComponent(key)}`) : null
  };
};

const toPositiveInteger = (value: number | string | undefined): number | undefined => {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const DATE_ONLY_TEXT_RE = /^\d{4}-\d{2}-\d{2}$/;

type BitsDateLabelOptions = {
  dateText?: string | undefined;
  dateHasTime?: boolean | undefined;
};

/**
 * 卡片、弹窗与搜索索引共用的日期文案。
 * frontmatter 只写日期（`dateHasTime === false`）时按时间点格式化会凭空带出 00:00，
 * 此时优先用站点时区换算好的 dateText，退回按站点时区格式化日期部分；
 * 未传 dateHasTime 时保持原有「日期 + 时分」格式，后台预览的调用点不因此退化。
 */
export const formatBitsDateLabel = (
  value: Date | string | null | undefined,
  timeZone: string,
  { dateText, dateHasTime }: BitsDateLabelOptions = {}
): string => {
  const usesDateOnly = dateHasTime === false;
  const preferredDateText = dateText?.trim() ?? '';

  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) return '';
    if (!usesDateOnly) return formatDateTimeInTimeZone(value, timeZone);
    return preferredDateText || formatISODateInTimeZone(value, timeZone);
  }

  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = new Date(trimmed);

  if (!usesDateOnly) {
    return Number.isNaN(parsed.valueOf()) ? trimmed : formatDateTimeInTimeZone(parsed, timeZone);
  }
  if (preferredDateText) return preferredDateText;
  // 纯日期字符串本身就是日历日期，跨时区重新格式化会前移一天。
  if (DATE_ONLY_TEXT_RE.test(trimmed)) return trimmed;
  return Number.isNaN(parsed.valueOf()) ? trimmed : formatISODateInTimeZone(parsed, timeZone);
};

export const deriveBitsCardText = (bodyText: string): BitsCardText => {
  const { plainText, excerptText } = deriveMarkdownText(bodyText);
  return {
    plainText,
    excerpt: truncateTextAtWord(excerptText, BITS_CARD_FULL_RENDER_LIMIT),
    shouldRenderFull: plainText.length <= BITS_CARD_FULL_RENDER_LIMIT,
    truncated: excerptText.length > BITS_CARD_FULL_RENDER_LIMIT
  };
};

export const buildBitsCardViewModel = ({
  id,
  slug,
  bodyText,
  tags = [],
  date = null,
  dateText,
  dateHasTime,
  images = [],
  author = null,
  defaultAuthor = null,
  base = '/',
  timeZone = DEFAULT_SITE_TIMEZONE,
  draft = false
}: BitsCardViewModelInput): BitsCardViewModel => {
  const withBase = createWithBase(base);
  const defaultAuthorName = (defaultAuthor?.name ?? 'Versicarium').trim() || 'Versicarium';
  const authorName = (author?.name ?? defaultAuthorName).trim() || defaultAuthorName;
  const authorAvatarRaw = (author?.avatar?.trim() || defaultAuthor?.avatar?.trim() || '');
  const imageItems = images
    .map((image) => {
      const rawSrc = image.src;
      const src = getContentImageSrc(rawSrc);
      if (!src) return null;
      const normalized = typeof rawSrc === 'string'
        ? normalizeBitsImageSource(src)
        : src;
      if (!normalized) return null;
      const importedDimensions = getContentImageDimensions(rawSrc);
      const width = toPositiveInteger(image.width ?? importedDimensions.width);
      const height = toPositiveInteger(image.height ?? importedDimensions.height);
      return {
        src: withBase(normalized),
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        alt: (image.alt ?? '').trim()
      };
    })
    .filter((image): image is BitsCardImageViewModel => image !== null);
  const placeTag = tags.find((tag) => tag.toLowerCase().startsWith('loc:')) ?? '';
  const placeText = placeTag ? placeTag.slice(4).trim() : '';
  const normalTagItems = tags
    .filter((tag) => !tag.toLowerCase().startsWith('loc:'))
    .map((tag) => toTagLink(tag, withBase));
  const totalImages = imageItems.length;

  return {
    id,
    slug: slug || id,
    draft,
    body: deriveBitsCardText(bodyText),
    authorName,
    authorAvatar: authorAvatarRaw ? withBase(authorAvatarRaw) : '',
    avatarLetter: Array.from(authorName)[0] ?? 'V',
    placeTag: placeTag && placeText ? toTagLink(placeText, withBase, placeTag) : null,
    normalTagItems,
    hasTags: Boolean(placeText || normalTagItems.length),
    dateLabel: formatBitsDateLabel(date, timeZone, { dateText, dateHasTime }),
    imageItems,
    visibleImages: imageItems.slice(0, BITS_CARD_VISIBLE_IMAGE_LIMIT),
    firstImage: totalImages === 1 ? imageItems[0] ?? null : null,
    totalImages,
    moreCount: Math.max(0, totalImages - BITS_CARD_VISIBLE_IMAGE_LIMIT)
  };
};
