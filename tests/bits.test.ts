import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import { getBitsSearchIndex } from '../src/lib/bits';
import { buildPublishedBitsHrefMap, type BitPublicOrderItem } from '../src/lib/bits-public-routing';

const getCollectionMock = vi.mocked(getCollection);
const date = (value: string) => new Date(value);

type BitDateMeta = {
  dateText?: string;
  dateHasTime?: boolean;
};

const bit = (id: string, value: string, dateMeta: BitDateMeta = {}) => ({
  id,
  collection: 'bits',
  body: `Body for ${id}`,
  data: {
    title: `Bit ${id}`,
    description: '',
    date: date(value),
    ...dateMeta,
    tags: [] as string[],
    draft: false
  }
});

const toRoutingItem = (entry: ReturnType<typeof bit>): BitPublicOrderItem => ({
  id: entry.id,
  date: entry.data.date,
  draft: entry.data.draft === true
});

describe('bits queries', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it('keeps the public search index order and hrefs aligned with the routing helper', async () => {
    const entries = [
      bit('same-day-z', '2026-05-04T12:00:00.000Z'),
      bit('newer', '2026-05-05T12:00:00.000Z'),
      bit('same-day-a', '2026-05-04T12:00:00.000Z')
    ];
    getCollectionMock.mockResolvedValue(entries as never);

    const index = await getBitsSearchIndex();
    const hrefById = buildPublishedBitsHrefMap(entries.map(toRoutingItem));

    expect(index.map((item) => item.key)).toEqual(['newer', 'same-day-a', 'same-day-z']);
    expect(index.map((item) => item.href)).toEqual(index.map((item) => hrefById.get(item.key)));
  });

  it('搜索索引对纯日期条目只给日期，带时分的条目保留时分', async () => {
    const entries = [
      bit('date-only', '2026-10-19T16:00:00.000Z', {
        dateText: '2026-10-20',
        dateHasTime: false
      }),
      bit('with-time', '2026-10-20T00:30:00.000Z', {
        dateText: '2026-10-20T08:30:00+08:00',
        dateHasTime: true
      })
    ];
    getCollectionMock.mockResolvedValue(entries as never);

    const index = await getBitsSearchIndex();
    const byKey = new Map(index.map((item) => [item.key, item]));

    // 搜索索引与卡片共用同一份日期文案：纯日期不再带出 00:00。
    expect(byKey.get('date-only')?.dateLabel).toBe('2026-10-20');
    expect(byKey.get('with-time')?.dateLabel).toBe('2026-10-20 08:30');
  });
});
