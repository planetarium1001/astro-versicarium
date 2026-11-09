import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import { GET } from '../src/pages/blog/index.json';

/**
 * `/blog/index.json` 的系列键：客户端筛选只认这个索引，所以 `seriesKeys` 必须来自
 * frontmatter 的 `series`，不能依赖列表项上的派生字段（那条链路曾经把键丢空）。
 */

const getCollectionMock = vi.mocked(getCollection);

type IndexItem = { slug: string; series: string | null; seriesKeys: string[] };

describe('/blog/index.json 输出系列键', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-blog-index-'));
    getCollectionMock.mockReset();
  });

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('frontmatter.series 映射成 series 与命名空间化的 seriesKeys', async () => {
    const filePath = path.join(tempRoot, 'post.md');
    await writeFile(filePath, '---\ntitle: post\n---\n', 'utf8');

    getCollectionMock.mockResolvedValue([
      {
        id: '2026-01-01-post',
        filePath,
        body: '',
        data: {
          title: '系列成员',
          date: new Date('2026-01-01T00:00:00+08:00'),
          dateText: '2026-01-01',
          draft: false,
          publishedAt: new Date('2026-01-01T00:00:00+08:00'),
          series: 'pc-build',
          seriesName: '折腾主机',
          seriesOrder: 1
        }
      },
      {
        id: '2026-01-02-loose',
        filePath,
        body: '',
        data: {
          title: '独立文章',
          date: new Date('2026-01-02T00:00:00+08:00'),
          dateText: '2026-01-02',
          draft: false,
          publishedAt: new Date('2026-01-02T00:00:00+08:00')
        }
      }
    ] as never);

    const response = await GET({} as never);
    const items = (await response.json()) as IndexItem[];
    const bySlug = new Map(items.map((item) => [item.slug, item]));

    expect(bySlug.get('2026-01-01-post')?.series).toBe('pc-build');
    expect(bySlug.get('2026-01-01-post')?.seriesKeys).toEqual(['series:pc-build']);
    // 不属于任何系列时不输出键，客户端据此不生成系列胶囊
    expect(bySlug.get('2026-01-02-loose')?.series).toBeNull();
    expect(bySlug.get('2026-01-02-loose')?.seriesKeys).toEqual([]);
  });
});
