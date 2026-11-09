import { describe, expect, it, vi } from 'vitest';

// `archive.ts` 会连带加载 `content.ts`，后者在模块顶层引用 `astro:content`。
vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { collectArchiveSeriesOptions, type ArchiveRow } from '../src/lib/archive';

/**
 * `/archive/` 的系列筛选项：系列是博客内容的概念，计数口径要与 `/blog` 一致——
 * 每个版本组的代表行（最新版）只计一次，而不是归档里出现的行数。
 */

const blogRow = (overrides: Partial<ArchiveRow>): ArchiveRow => ({
  kind: 'blog',
  key: 'blog:2026-01-01-post',
  id: '2026-01-01-post',
  title: '文章',
  href: '/blog/post/',
  date: new Date('2026-01-01T00:00:00+08:00'),
  dateText: '2026-01-01',
  year: 2026,
  month: 1,
  versionOrder: 0,
  description: '',
  tags: [],
  text: '',
  ...overrides
});

describe('collectArchiveSeriesOptions', () => {
  it('每个系列只出一项，计数是系列成员数而不是归档行数', () => {
    const options = collectArchiveSeriesOptions([
      blogRow({ key: 'blog:a', seriesSlug: 'pc-build', seriesName: '折腾主机', seriesIndex: 1, seriesTotal: 2 }),
      blogRow({ key: 'blog:b', seriesSlug: 'pc-build', seriesName: '折腾主机', seriesIndex: 2, seriesTotal: 2 }),
      // 同一版本组的历史版本行不带系列字段，不会让计数翻倍
      // `exactOptionalPropertyTypes`：缺字段就是缺字段，不能显式传 undefined
      blogRow({ key: 'blog:a-old', versionGroup: 'pc-build-post' })
    ]);

    expect(options).toEqual([{ key: 'series:pc-build', label: '折腾主机', count: 2 }]);
  });

  it('缺 seriesName 时回退系列 slug，项目与开发日志行不参与', () => {
    const options = collectArchiveSeriesOptions([
      blogRow({ key: 'blog:c', seriesSlug: 'notes' }),
      blogRow({ key: 'projects:demo', kind: 'projects', seriesSlug: 'ignored' }),
      blogRow({ key: 'devlog:x', kind: 'devlog', seriesSlug: 'ignored' })
    ]);

    expect(options).toEqual([{ key: 'series:notes', label: 'notes', count: 1 }]);
  });

  it('没有任何系列时返回空数组：调用方据此不渲染系列区块与分割线', () => {
    expect(collectArchiveSeriesOptions([blogRow({}), blogRow({ key: 'blog:d' })])).toEqual([]);
  });
});
