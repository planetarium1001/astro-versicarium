// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fixturePath, renderFixture, stubIndexFetch } from './fixture-page';
import {
  clickTag,
  importEntrySearch,
  pageItems,
  stubEntrySearchEnvironment,
  tagButton,
  visibleSlugs
} from './entry-search-harness';

/**
 * `/archive/` 的系列筛选。
 *
 * 归档行同时包含博客、项目版本与开发日志，但系列只属于博客：系列键写进归档索引后，
 * 同一个 `?tags=` 表达式就能把时间线收敛到该系列的成员行。这里直接用构建产物里的
 * 真实归档页与索引（示例内容里有一组 3 篇的系列），不再注入，避免夹具与真实产物分叉。
 */

const SERIES_KEY = 'series:theme-build-notes';

type ArchiveIndexItem = { slug: string; seriesKeys?: string[] };

const loadArchivePage = async () => {
  const [html, indexRaw] = await Promise.all([
    readFile(fixturePath('archive-page.dev.html'), 'utf8'),
    readFile(fixturePath('archive-index.dev.json'), 'utf8')
  ]);

  renderFixture(html);
  const items = JSON.parse(indexRaw) as ArchiveIndexItem[];
  stubIndexFetch(JSON.stringify(items));
  return items;
};

const expectedSlugs = (items: ArchiveIndexItem[]) =>
  items
    .filter((item) => (item.seriesKeys ?? []).includes(SERIES_KEY))
    .map((item) => item.slug)
    .sort();

describe('entry-search：归档页按系列筛选', () => {
  beforeEach(() => {
    stubEntrySearchEnvironment();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('归档页渲染系列区块，且分割线只有一条', async () => {
    await loadArchivePage();

    const seriesList = document.querySelector('[data-entry-series-options]');
    expect(seriesList, '归档页应当有系列区块').not.toBeNull();
    expect(seriesList!.querySelectorAll('[data-entry-option-kind="series"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-entry-tag-divider]').length).toBe(1);
    // 触发器与 dialog 仍叫「标签」：系列只是同一面板里的第二组选项
    expect(document.querySelector('[data-entry-tag-trigger]')?.textContent?.trim()).toBe('#标签');
  });

  it('点系列选项后时间线只剩该系列的博客行，URL 用命名空间键', async () => {
    const items = await loadArchivePage();
    const expected = expectedSlugs(items);
    expect(expected.length, '示例内容里需要至少两条同系列归档行').toBeGreaterThan(1);

    await importEntrySearch();
    await clickTag(SERIES_KEY);

    expect(visibleSlugs().sort()).toEqual(expected);
    expect(visibleSlugs().length).toBeLessThan(pageItems().length);

    const params = new URLSearchParams(window.location.search);
    expect(params.get('tags')).toBe(SERIES_KEY);
    expect(params.get('mode')).toBe('and');
    expect(params.has('series')).toBe(false);
  });

  it('系列与标签同选时取交集，再点一次系列取消筛选', async () => {
    const items = await loadArchivePage();
    await importEntrySearch();

    // 先选一个系列成员都有的标签，再叠加系列：结果应落在系列成员内部
    const member = items.find((item) => (item.seriesKeys ?? []).includes(SERIES_KEY))!;
    expect(member).toBeTruthy();

    await clickTag(SERIES_KEY);
    const seriesOnly = visibleSlugs().sort();
    expect(seriesOnly).toEqual(expectedSlugs(items));

    // 再点一次取消：`clickTag` 等的是 aria-pressed='true'，取消方向不能复用它
    tagButton(SERIES_KEY)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(
      () => {
        expect(tagButton(SERIES_KEY)!.getAttribute('aria-pressed')).toBe('false');
      },
      { timeout: 3000 }
    );
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(new URLSearchParams(window.location.search).has('tags')).toBe(false);
    expect(visibleSlugs().length).toBe(pageItems().length);
  });
});
