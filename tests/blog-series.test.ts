import { describe, expect, it } from 'vitest';
import { buildBlogRouting } from '../src/lib/blog-routing';
import {
  buildBlogSeriesIndex,
  getSeriesFilterHref,
  getSeriesTagKey
} from '../src/lib/blog-series';

const entry = (
  id: string,
  dateText: string,
  extra: Record<string, unknown> = {}
) => ({
  id,
  data: {
    title: id,
    date: new Date(`${dateText}T00:00:00+08:00`),
    dateText,
    draft: false,
    ...extra
  }
});

const indexOf = (entries: ReturnType<typeof entry>[]) =>
  buildBlogSeriesIndex(entries, buildBlogRouting(entries));

describe('blog series index', () => {
  it('orders members by seriesOrder, then by oldest date, with missing orders last', () => {
    const index = indexOf([
      entry('order-2', '2026-01-05', { series: 'pc-build', seriesOrder: 2, seriesName: '折腾主机' }),
      entry('no-order-earlier', '2025-12-01', { series: 'pc-build' }),
      entry('order-1', '2026-02-01', { series: 'pc-build', seriesOrder: 1, seriesName: '折腾主机' }),
      entry('no-order-later', '2026-01-01', { series: 'pc-build' })
    ]);

    const series = index.get('pc-build');
    expect(series?.name).toBe('折腾主机');
    expect(series?.total).toBe(4);
    expect(series?.members.map((member) => [member.entryId, member.index])).toEqual([
      ['order-1', 1],
      ['order-2', 2],
      ['no-order-earlier', 3],
      ['no-order-later', 4]
    ]);
    expect(series?.members.map((member) => member.href)).toEqual([
      '/blog/order-1/',
      '/blog/order-2/',
      '/blog/no-order-earlier/',
      '/blog/no-order-later/'
    ]);
  });

  it('breaks ties on the same order and date by entry id', () => {
    const series = indexOf([
      entry('b-entry', '2026-01-01', { series: 'pc-build' }),
      entry('a-entry', '2026-01-01', { series: 'pc-build' })
    ]).get('pc-build');

    expect(series?.members.map((member) => member.entryId)).toEqual(['a-entry', 'b-entry']);
  });

  it('contributes one row per version group and points it at the canonical route', () => {
    const series = indexOf([
      entry('2026-01-01-post-v1', '2026-01-01', {
        versionGroup: 'post',
        slug: 'post',
        series: 'pc-build',
        seriesOrder: 2
      }),
      entry('2026-03-01-post-v2', '2026-03-01', {
        versionGroup: 'post',
        slug: 'post',
        series: 'pc-build',
        seriesOrder: 1,
        title: '第二版'
      }),
      entry('2026-04-01-standalone', '2026-04-01', { series: 'pc-build', seriesOrder: 3 })
    ]).get('pc-build');

    expect(series?.total).toBe(2);
    expect(series?.members).toEqual([
      {
        versionGroupKey: 'versionGroup:post',
        entryId: '2026-03-01-post-v2',
        title: '第二版',
        href: '/blog/post/',
        dateText: '2026-03-01',
        index: 1
      },
      {
        versionGroupKey: 'single:2026-04-01-standalone',
        entryId: '2026-04-01-standalone',
        title: '2026-04-01-standalone',
        href: '/blog/2026-04-01-standalone/',
        dateText: '2026-04-01',
        index: 2
      }
    ]);
  });

  it('ignores entries without a series', () => {
    const index = indexOf([
      entry('2026-01-01-loose', '2026-01-01'),
      entry('2026-01-01-blank', '2026-01-01', { series: '  ' })
    ]);

    expect(index.size).toBe(0);
  });

  it('falls back to the series slug when no member sets seriesName', () => {
    const series = indexOf([
      entry('2026-01-01-first', '2026-01-01', { series: 'pc-build', seriesName: '  ' }),
      entry('2026-01-02-second', '2026-01-02', { series: 'pc-build' })
    ]).get('pc-build');

    expect(series?.name).toBe('pc-build');
  });

  it('takes the display name from the first non-empty seriesName in reading order', () => {
    const series = indexOf([
      entry('2026-01-01-first', '2026-01-01', { series: 'pc-build', seriesOrder: 1 }),
      entry('2026-01-02-second', '2026-01-02', {
        series: 'pc-build',
        seriesOrder: 2,
        seriesName: '折腾主机'
      })
    ]).get('pc-build');

    expect(series?.name).toBe('折腾主机');
  });

  it('keeps separate series apart, newest series first', () => {
    const index = indexOf([
      entry('2026-01-01-a', '2026-01-01', { series: 'series-a' }),
      entry('2026-01-02-b', '2026-01-02', { series: 'series-b' })
    ]);

    expect([...index.keys()]).toEqual(['series-b', 'series-a']);
    expect(index.get('series-a')?.total).toBe(1);
  });

  it('builds the canonical tag-filter links', () => {
    expect(getSeriesTagKey('pc-build')).toBe('series:pc-build');
    expect(getSeriesFilterHref('pc-build')).toBe('/blog/?tags=series%3Apc-build&mode=and');
  });
});
