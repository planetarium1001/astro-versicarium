import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import {
  getPublished,
  getVisibleBlogListItems,
  getVisibleBlogSeriesIndex
} from '../src/lib/content';

const getCollectionMock = vi.mocked(getCollection);

describe('content queries', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-content-query-'));
    getCollectionMock.mockReset();
  });

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('omits dev content-store entries whose source file has already been deleted', async () => {
    const existingPath = path.join(tempRoot, 'existing.md');
    await writeFile(existingPath, '---\ntitle: Existing\n---\n', 'utf8');

    getCollectionMock.mockResolvedValue([
      {
        id: 'existing',
        filePath: existingPath,
        data: { draft: false }
      },
      {
        id: 'deleted',
        filePath: path.join(tempRoot, 'deleted.md'),
        data: { draft: false }
      }
    ] as never);

    const entries = await getPublished('blog', { includeDraft: true });

    expect(entries.map((entry) => entry.id)).toEqual(['existing']);
  });

  it('keeps the version group and the content series apart on list items', async () => {
    const existingPath = path.join(tempRoot, 'existing.md');
    await writeFile(existingPath, '---\ntitle: Existing\n---\n', 'utf8');

    getCollectionMock.mockResolvedValue([
      {
        id: '2026-01-01-post-v1',
        filePath: existingPath,
        data: {
          title: 'v1',
          date: new Date('2026-01-01T00:00:00+08:00'),
          dateText: '2026-01-01',
          draft: false,
          versionGroup: 'post',
          versionLabel: 'v1',
          slug: 'post',
          series: 'pc-build',
          seriesOrder: 2
        }
      },
      {
        id: '2026-03-01-post-v2',
        filePath: existingPath,
        data: {
          title: 'v2',
          date: new Date('2026-03-01T00:00:00+08:00'),
          dateText: '2026-03-01',
          draft: false,
          versionGroup: 'post',
          versionLabel: 'v2',
          slug: 'post',
          series: 'pc-build',
          seriesName: '折腾主机',
          seriesOrder: 1
        }
      }
    ] as never);

    const items = await getVisibleBlogListItems({ includeDraft: true });

    // 列表按 date 倒序，最新版在首位；列表项只带版本线键，系列信息统一从系列索引取。
    expect(items.map((item) => [item.entry.id, item.isLatest, item.versionGroup, item.versionCount])).toEqual([
      ['2026-03-01-post-v2', true, 'post', 2],
      ['2026-01-01-post-v1', false, 'post', 2]
    ]);
    expect(items.map((item) => item.href)).toEqual([
      '/blog/post/',
      '/blog/2026-01-01-post-v1/'
    ]);

    // 同版本组只贡献一行，系列清单取最新版的 canonical href 与标题。
    const series = (await getVisibleBlogSeriesIndex({ includeDraft: true })).get('pc-build');
    expect(series?.name).toBe('折腾主机');
    expect(series?.members).toEqual([
      {
        versionGroupKey: 'versionGroup:post',
        entryId: '2026-03-01-post-v2',
        title: 'v2',
        href: '/blog/post/',
        dateText: '2026-03-01',
        index: 1
      }
    ]);
  });
});
