import type { CollectionEntry } from 'astro:content';
import { getPublished, type GetPublishedOptions } from './content';
import { createWithBase, formatISODateInTimeZone } from '../utils/format';
import { getSiteTimezone } from '../utils/site-timezone';
import { deriveBitsCardText, formatBitsDateLabel } from './bits-card-view-model';
import { getContentImageDimensions, resolveContentImageSrc } from './content-image';
import {
  buildPublishedBitsHrefMap,
  compareBitsForRouting,
  getBitAnchorId,
  getBitsPagePath,
  type BitPublicOrderItem
} from './bits-public-routing';

export {
  buildPublishedBitsHrefMap,
  getBitAnchorId,
  getBitsPagePath,
  orderPublishedBitsForRouting,
  type BitPublicOrderItem
} from './bits-public-routing';

export type BitsEntry = CollectionEntry<'bits'>;
export type BitsYearOption = {
  value: number;
  count: number;
};

type BitsIndexItem = {
  key: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  text: string;
  excerpt: string;
  date: string | null;
  dateLabel: string | null;
  year: number | null;
  href: string;
  thumbnail?: {
    src: string;
    width?: number;
    height?: number;
    alt: string;
  } | null;
};

type BitsDerivedText = {
  plainText: string;
  text: string;
  excerpt: string;
  shouldRenderFull: boolean;
};

type BitsQueryOptions = Pick<GetPublishedOptions<'bits'>, 'includeDraft'>;

const MAX_INDEX_TEXT = 600;
const shouldMemoizeBitQueries = import.meta.env.PROD;
const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

let sortedBitsPromise: Promise<BitsEntry[]> | null = null;
let bitsIndexPromise: Promise<BitsIndexItem[]> | null = null;
const bitsDerivedTextById = new Map<string, BitsDerivedText>();

const cloneBitEntries = (entries: readonly BitsEntry[]) => entries.slice();

const shouldUseDefaultBitsCache = (includeDraft?: boolean) =>
  shouldMemoizeBitQueries && includeDraft !== true;

const toBitPublicOrderItem = (entry: BitsEntry): BitPublicOrderItem => ({
  id: entry.id,
  date: entry.data.date,
  draft: entry.data.draft === true
});

const orderByBitsDate = (left: BitsEntry, right: BitsEntry) =>
  compareBitsForRouting(toBitPublicOrderItem(left), toBitPublicOrderItem(right));

const loadSortedBits = ({ includeDraft }: BitsQueryOptions = {}) =>
  getPublished('bits', {
    ...(includeDraft === undefined ? {} : { includeDraft }),
    orderBy: orderByBitsDate
  });

export const getBitSlug = (entry: BitsEntry) => entry.data.slug ?? entry.id;

const buildBitsYearOptions = (bits: readonly BitsEntry[]): BitsYearOption[] => {
  const yearCountMap = new Map<number, number>();

  for (const bit of bits) {
    const dateText = bit.data.dateText ?? formatISODateInTimeZone(bit.data.date, getSiteTimezone());
    const year = Number.parseInt(dateText.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;
    yearCountMap.set(year, (yearCountMap.get(year) ?? 0) + 1);
  }

  return Array.from(yearCountMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([value, count]) => ({
      value,
      count
    }));
};

export async function getSortedBits(options: BitsQueryOptions = {}) {
  if (!shouldUseDefaultBitsCache(options.includeDraft)) {
    return loadSortedBits(options);
  }

  sortedBitsPromise ??= loadSortedBits();
  return cloneBitEntries(await sortedBitsPromise);
}

/** 返回全部条目，分页由客户端负责。 */
export async function getBitsPageData() {
  const bits = await getSortedBits();

  return {
    items: bits,
    yearOptions: buildBitsYearOptions(bits),
    totalCount: bits.length
  };
}

const getSearchIndexText = (plainText: string) =>
  plainText.length > MAX_INDEX_TEXT ? plainText.slice(0, MAX_INDEX_TEXT) : plainText;

const buildBitsDerivedText = (bit: BitsEntry): BitsDerivedText => {
  const derivedText = deriveBitsCardText(bit.body ?? '');

  return {
    plainText: derivedText.plainText,
    text: getSearchIndexText(derivedText.plainText),
    excerpt: derivedText.excerpt,
    shouldRenderFull: derivedText.shouldRenderFull
  };
};

export function getBitsDerivedText(bit: BitsEntry): BitsDerivedText {
  if (!shouldMemoizeBitQueries) {
    return buildBitsDerivedText(bit);
  }

  let derivedText = bitsDerivedTextById.get(bit.id);
  if (!derivedText) {
    derivedText = buildBitsDerivedText(bit);
    bitsDerivedTextById.set(bit.id, derivedText);
  }

  return derivedText;
}

const buildBitsIndex = async () => {
  const bits = await getSortedBits();
  const publishedHrefById = buildPublishedBitsHrefMap(bits.map(toBitPublicOrderItem));
  return bits.map((bit) => {
    const derivedText = getBitsDerivedText(bit);
    const firstImage = bit.data.images?.[0];
    const hrefPath = publishedHrefById.get(bit.id) ?? `${getBitsPagePath()}#${getBitAnchorId(bit.id)}`;

    return {
      key: bit.id,
      slug: getBitSlug(bit),
      title: bit.data.title ?? '',
      description: bit.data.description ?? '',
      tags: bit.data.tags ?? [],
      text: derivedText.text,
      excerpt: derivedText.excerpt,
      date: bit.data.date ? bit.data.date.toISOString() : null,
      dateLabel: bit.data.date
        ? formatBitsDateLabel(bit.data.date, getSiteTimezone(), {
            dateText: bit.data.dateText,
            dateHasTime: bit.data.dateHasTime
          })
        : null,
      year: bit.data.date ? Number.parseInt((bit.data.dateText ?? formatISODateInTimeZone(bit.data.date, getSiteTimezone())).slice(0, 4), 10) : null,
      href: withBase(hrefPath),
      thumbnail: firstImage
        ? (() => {
            const src = resolveContentImageSrc(firstImage.src, base);
            if (!src) return null;
            const dimensions = getContentImageDimensions(firstImage.src);
            return {
              src,
              ...(dimensions.width ? { width: dimensions.width } : {}),
              ...(dimensions.height ? { height: dimensions.height } : {}),
              alt: firstImage.alt ?? ''
            };
          })()
        : null
    };
  });
};

export async function getBitsSearchIndex() {
  if (!shouldMemoizeBitQueries) {
    return buildBitsIndex();
  }

  let promise: Promise<BitsIndexItem[]> | null = bitsIndexPromise;
  if (!promise) {
    promise = buildBitsIndex();
    bitsIndexPromise = promise;
  }

  const index = await promise;
  return index.map((item) => ({
    ...item,
    tags: item.tags.slice(),
    thumbnail: item.thumbnail
      ? {
          ...item.thumbnail
        }
      : null
  }));
}
