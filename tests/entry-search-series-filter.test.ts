// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTagKeys } from '../src/lib/tags';
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
 * `/blog/` 的系列筛选：系列键是命名空间化的标签键（`series:<slug>`），
 * 与标签共用同一条表达式和同一个 `+` / `/` 开关，URL 仍然只有 `?tags=`（+ `mode` / `ops`）一套。
 *
 * 夹具是构建产物里的真实博客页 + index.json：这里只把 TagFilterHeader 会渲染的系列区块补进
 * dialog，并给两条条目加上 `seriesKeys`，其余部分（事件绑定、索引加载、表达式求值）全走真实脚本。
 */

// 键与文案刻意与示例内容无关：快照刷新后新增的真实系列不会和这里的注入项撞键。
const SERIES_KEY = 'series:test-fixture-series';
const SERIES_LABEL = '测试系列';

type IndexItem = { slug: string; tags: string[]; seriesKeys?: string[] };

/** 按 TagFilterHeader 的结构补出「分割线 + 系列区块」，供客户端脚本识别。 */
const appendSeriesOptions = () => {
  const tagList = document.querySelector<HTMLElement>('[data-entry-tag-options]');
  if (!tagList) throw new Error('fixture 里没有标签列表');

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

const loadBlogPageWithSeries = async () => {
  const [html, indexRaw] = await Promise.all([
    readFile(fixturePath('blog-page.dev.html'), 'utf8'),
    readFile(fixturePath('blog-index.dev.json'), 'utf8')
  ]);

  renderFixture(html);

  const items = JSON.parse(indexRaw) as IndexItem[];
  // 系列是并列的独立文章：取两篇（含标签不同的），让 AND / OR 有可区分的结果。
  const seriesSlugs = [items[1]!.slug, items[3]!.slug];
  for (const item of items) {
    item.seriesKeys = seriesSlugs.includes(item.slug) ? [SERIES_KEY] : [];
  }
  stubIndexFetch(JSON.stringify(items));
  appendSeriesOptions();

  return { items, seriesSlugs };
};

const expressionChips = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.entry-tags-dialog__expression-chip'))
    .map((el) => (el.textContent ?? '').trim());

const expressionOps = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.entry-tags-dialog__expression-op'))
    .map((el) => (el.textContent ?? '').trim());

const searchParams = () => new URLSearchParams(window.location.search);

const clickMode = (mode: 'and' | 'or') => {
  const button = document.querySelector<HTMLButtonElement>(`[data-entry-tag-mode="${mode}"]`);
  if (!button) throw new Error(`找不到 ${mode} 开关`);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

/**
 * 从夹具里挑标签键，不写死示例内容的标签名：主题仓库与演示站（demo 分支）内容不同，
 * 硬编码标签会让同一份测试只在其中一个仓库成立。
 */
const pickTagKey = (items: IndexItem[], accept: (key: string, owners: string[]) => boolean): string => {
  const ownersByKey = new Map<string, string[]>();
  for (const item of items) {
    for (const key of getTagKeys(item.tags)) {
      const owners = ownersByKey.get(key) ?? [];
      owners.push(item.slug);
      ownersByKey.set(key, owners);
    }
  }
  for (const [key, owners] of ownersByKey) {
    if (accept(key, owners)) return key;
  }
  throw new Error('夹具里找不到满足条件的标签键');
};

const visibleKeySlugs = (items: IndexItem[], keys: string[]) =>
  items
    .filter((item) => {
      const itemKeys = [...getTagKeys(item.tags), ...(item.seriesKeys ?? [])];
      return keys.every((key) => itemKeys.includes(key));
    })
    .map((item) => item.slug)
    .sort();

describe('entry-search：系列键并入同一条筛选表达式', () => {
  beforeEach(() => {
    stubEntrySearchEnvironment();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('点击系列选项后只剩系列成员，URL 落到 ?tags=series%3A<slug>&mode=and', async () => {
    const { seriesSlugs } = await loadBlogPageWithSeries();
    await importEntrySearch();

    await clickTag(SERIES_KEY);

    expect(visibleSlugs().sort()).toEqual([...seriesSlugs].sort());
    expect(visibleSlugs().length).toBeLessThan(pageItems().length);

    const params = searchParams();
    expect(params.get('tags')).toBe(SERIES_KEY);
    expect(params.get('mode')).toBe('and');
    // canonical 形式：编码后的冒号，不新增 ?series= 参数
    expect(window.location.search).toContain(`tags=${encodeURIComponent(SERIES_KEY)}`);
    expect(params.has('series')).toBe(false);

    // dialog 里的表达式胶囊与页头控件条都显示成「系列：名称」，不带 `#`
    expect(expressionChips()).toEqual([`系列：${SERIES_LABEL}`]);
    const chipLabels = Array.from(
      document.querySelectorAll<HTMLElement>('.entry-tag-chip__label')
    ).map((el) => (el.textContent ?? '').trim());
    expect(chipLabels).toContain(`系列：${SERIES_LABEL}`);
  });

  it('系列与标签共用 +：同一段内 AND 取交集', async () => {
    const { items, seriesSlugs } = await loadBlogPageWithSeries();
    await importEntrySearch();

    // 只落在系列部分成员上的标签：AND 会收缩集合，OR 会放大集合
    const tagKey = pickTagKey(
      items,
      (_key, owners) => seriesSlugs.some((slug) => owners.includes(slug))
        && seriesSlugs.some((slug) => !owners.includes(slug))
    );

    await clickTag(SERIES_KEY);
    await clickTag(tagKey);

    expect(expressionOps()).toContain('+');
    expect(visibleSlugs().sort()).toEqual(visibleKeySlugs(items, [SERIES_KEY, tagKey]));
    expect(searchParams().get('mode')).toBe('and');
    expect(searchParams().get('ops')).toBeNull();
  });

  it('系列与标签共用 /：先切到 OR 再选，「任一命中」取并集', async () => {
    const { items, seriesSlugs } = await loadBlogPageWithSeries();
    await importEntrySearch();

    const tagKey = pickTagKey(
      items,
      (_key, owners) => seriesSlugs.some((slug) => owners.includes(slug))
        && seriesSlugs.some((slug) => !owners.includes(slug))
    );

    // `/` 作用于待选段：空表达式下先切，再依次选系列与标签，两者落在同一段 OR 里。
    clickMode('or');
    await clickTag(SERIES_KEY);
    await clickTag(tagKey);

    const union = items
      .filter((item) => {
        const itemKeys = [...getTagKeys(item.tags), ...(item.seriesKeys ?? [])];
        return itemKeys.includes(SERIES_KEY) || itemKeys.includes(tagKey);
      })
      .map((item) => item.slug)
      .sort();

    expect(union.length).toBeGreaterThan(visibleKeySlugs(items, [SERIES_KEY, tagKey]).length);
    expect(visibleSlugs().sort()).toEqual(union);
    expect(expressionOps()).toEqual(['/']);
    expect(searchParams().get('mode')).toBe('or');
  });

  it('深链接 ?tags=series:<slug>&mode=and 首屏即按系列筛选', async () => {
    const { items, seriesSlugs } = await loadBlogPageWithSeries();
    stubEntrySearchEnvironment(`/blog/?tags=${encodeURIComponent(SERIES_KEY)}&mode=and`);
    await importEntrySearch();

    await vi.waitFor(() => {
      expect(visibleSlugs().sort()).toEqual([...seriesSlugs].sort());
    });
    expect(tagButton(SERIES_KEY)?.getAttribute('aria-pressed')).toBe('true');
    expect(expressionChips()).toEqual([`系列：${SERIES_LABEL}`]);
    expect(items.some((item) => item.slug === seriesSlugs[0])).toBe(true);
  });

  it('系列与不可能共存的标签组合时 0 命中，两个键都留在 URL 里', async () => {
    // 先渲染夹具与脚本，再挑标签：反过来会把已初始化的 DOM 换掉，监听器随之失效
    const { items, seriesSlugs } = await loadBlogPageWithSeries();
    await importEntrySearch();

    // 系列成员一个都没有的标签：与系列取交集必然 0 命中
    const tagKey = pickTagKey(
      items,
      (_key, owners) => seriesSlugs.every((slug) => !owners.includes(slug))
    );

    await clickTag(SERIES_KEY);
    await clickTag(tagKey);

    expect(visibleSlugs()).toEqual([]);
    // 表达式是唯一真相：两个键都在，AND 语义不变
    expect(searchParams().get('tags')).toBe(`${SERIES_KEY},${tagKey}`);
    expect(searchParams().get('mode')).toBe('and');
  });
});
