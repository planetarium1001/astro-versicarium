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
 * 同一个 `?tags=` 表达式就能把时间线收敛到该系列的成员行。
 *
 * 夹具来自构建产物，但**不依赖示例内容里恰好有系列**：主题仓库与演示站（demo 分支）
 * 内容不同，这里按 TagFilterHeader 的结构注入选项、给两条博客行写入系列键，
 * 其余（事件绑定、索引加载、表达式求值、分组收合）全走真实脚本。
 */

const SERIES_KEY = 'series:test-archive-series';
const SERIES_LABEL = '测试归档系列';

type ArchiveIndexItem = { slug: string; kind: string; seriesKeys?: string[] };

/**
 * 按 TagFilterHeader 的结构补出「分割线 + 系列区块」。
 * 夹具可能来自带示例系列的仓库：先清掉已有区块，保证不管示例内容有没有系列，
 * 断言面对的都是一份注入好的、结构唯一的对话框。
 */
const appendSeriesOptions = () => {
  const tagList = document.querySelector<HTMLElement>('[data-entry-tag-options]');
  if (!tagList) throw new Error('fixture 里没有标签列表');

  for (const stale of Array.from(
    document.querySelectorAll('[data-entry-tag-divider], [data-entry-series-options]')
  )) {
    stale.remove();
  }

  const divider = document.createElement('hr');
  divider.className = 'entry-tags-dialog__divider';
  divider.dataset.entryTagDivider = '';

  const list = document.createElement('div');
  list.className = 'entry-tags-dialog__list entry-tags-dialog__list--series';
  list.dataset.entrySeriesOptions = '';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', '按系列筛选');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'entry-tag-option';
  button.dataset.entryTagKey = SERIES_KEY;
  button.dataset.entryOptionKind = 'series';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span class="entry-tag-option__label">${SERIES_LABEL}</span>`
    + '<span class="entry-tag-option__count">2 篇</span>';

  list.append(button);
  tagList.after(divider, list);
};

const loadArchivePageWithSeries = async () => {
  const [html, indexRaw] = await Promise.all([
    readFile(fixturePath('archive-page.dev.html'), 'utf8'),
    readFile(fixturePath('archive-index.dev.json'), 'utf8')
  ]);

  renderFixture(html);
  const items = JSON.parse(indexRaw) as ArchiveIndexItem[];
  // 系列只属于博客：取两条博客行作为成员，项目版本与开发日志不参与。
  const members = items.filter((item) => item.kind === 'blog').slice(0, 2);
  if (members.length < 2) throw new Error('归档夹具里需要至少两条博客行');
  const memberSlugs = members.map((item) => item.slug);
  for (const item of items) {
    item.seriesKeys = memberSlugs.includes(item.slug) ? [SERIES_KEY] : [];
  }

  stubIndexFetch(JSON.stringify(items));
  appendSeriesOptions();
  return { items, memberSlugs };
};

const expectedSlugs = (items: ArchiveIndexItem[]) =>
  items
    .filter((item) => (item.seriesKeys ?? []).includes(SERIES_KEY))
    .map((item) => item.slug)
    .sort();

const clickTagDirect = (key: string) => {
  tagButton(key)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

describe('entry-search：归档页按系列筛选', () => {
  beforeEach(() => {
    stubEntrySearchEnvironment();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('归档页渲染系列区块，且分割线只有一条', async () => {
    await loadArchivePageWithSeries();

    const seriesList = document.querySelector('[data-entry-series-options]');
    expect(seriesList, '归档页应当有系列区块').not.toBeNull();
    expect(seriesList!.querySelectorAll('[data-entry-option-kind="series"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-entry-tag-divider]').length).toBe(1);
    // 触发器与 dialog 仍叫「标签」：系列只是同一面板里的第二组选项
    expect(document.querySelector('[data-entry-tag-trigger]')?.textContent?.trim()).toBe('#标签');
  });

  it('点系列选项后时间线只剩该系列的博客行，URL 用命名空间键', async () => {
    const { items } = await loadArchivePageWithSeries();
    const expected = expectedSlugs(items);
    expect(expected.length).toBeGreaterThan(1);

    await importEntrySearch();
    await clickTag(SERIES_KEY);

    expect(visibleSlugs().sort()).toEqual(expected);
    expect(visibleSlugs().length).toBeLessThan(pageItems().length);

    const params = new URLSearchParams(window.location.search);
    expect(params.get('tags')).toBe(SERIES_KEY);
    expect(params.get('mode')).toBe('and');
    expect(params.has('series')).toBe(false);
  });

  it('再点一次系列取消筛选，URL 与可见行一起复位', async () => {
    const { items } = await loadArchivePageWithSeries();
    await importEntrySearch();

    await clickTag(SERIES_KEY);
    expect(visibleSlugs().sort()).toEqual(expectedSlugs(items));

    // `clickTag` 等的是 aria-pressed='true'，取消方向不能复用它
    clickTagDirect(SERIES_KEY);
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
