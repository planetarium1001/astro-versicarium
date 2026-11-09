import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 静态契约：`/blog/` 的筛选面板把系列作为第二个区块。
 *
 * 结构约束来自 R16-R17：表达式行 → 标签区块 → **一条**淡色分割线 → 系列区块；
 * 表达式行与标签区块之间不加分割线；没有系列时整块与分割线都不渲染，
 * 因此 `/archive/`、`/bits/` 与改动前完全一致。
 */

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

const HEADER = 'src/components/TagFilterHeader.astro';
const BLOG_VIEW = 'src/components/BlogPageView.astro';
const BITS_VIEW = 'src/components/BitsPageView.astro';
const ARCHIVE_PAGE = 'src/pages/archive/index.astro';
const ENTRY_SEARCH = 'src/scripts/entry-search.ts';
const ENTRY_TAGS_CSS = 'src/styles/components/entry-tags.css';
const BLOG_INDEX_JSON = 'src/pages/blog/index.json.ts';

describe('TagFilterHeader：系列区块与分割线', () => {
  it('新增可选 seriesOptions，默认空数组', async () => {
    const source = await read(HEADER);

    expect(source).toContain('seriesOptions = []');
    expect(source).toContain('seriesOptions?: TagOption[];');
    expect(source).toContain('const hasSeriesOptions = seriesOptions.length > 0;');
  });

  it('结构顺序为「表达式行 → 标签区块 → 分割线 → 系列区块」', async () => {
    const source = await read(HEADER);

    const expression = source.indexOf('data-entry-tag-expression');
    const tagList = source.indexOf('data-entry-tag-options');
    const divider = source.indexOf('entry-tags-dialog__divider');
    const seriesList = source.indexOf('data-entry-series-options');

    expect(expression).toBeGreaterThan(-1);
    expect(tagList).toBeGreaterThan(expression);
    expect(divider).toBeGreaterThan(tagList);
    expect(seriesList).toBeGreaterThan(divider);

    // 分割线只有一条，且不在「表达式行与标签区块之间」
    expect(source.match(/entry-tags-dialog__divider/g)?.length).toBe(1);
  });

  it('系列项复用 entry-tag-option 按钮结构并标注 option-kind', async () => {
    const source = await read(HEADER);
    const block = source.slice(source.indexOf('data-entry-series-options'));

    expect(block).toContain('class="entry-tag-option"');
    expect(block).toContain('data-entry-tag-key={seriesOption.key}');
    expect(block).toContain('data-entry-option-kind="series"');
    expect(block).toContain('{seriesOption.label}');
    expect(block).toContain('{seriesOption.count} 篇');
  });

  it('无系列时整块与分割线都不渲染；有系列时 dialog 仍叫「标签」', async () => {
    const source = await read(HEADER);

    const conditional = source.slice(source.indexOf('{hasSeriesOptions ? ('));
    expect(conditional).toContain('entry-tags-dialog__divider');
    expect(conditional).toContain('data-entry-series-options');

    // 触发器与标题沿用「标签」：系列只是同一面板里的第二组选项
    expect(source).toContain('const dialogHeading = `${pageTitleText}${itemNoun}`');
    expect(source).not.toContain('pageTitleText}筛选');
    expect(source).toContain('选择标签或系列后，这里会实时显示筛选逻辑');
    // 计数分开写标签与系列，不混成一个总数
    expect(source).toContain('`共 ${tagOptions.length} 个${itemNoun} · ${seriesOptions.length} 个系列`');
  });

  it('/blog 与 /archive 传 seriesOptions，/bits 不传', async () => {
    const [blogView, bitsView, archivePage] = await Promise.all([
      read(BLOG_VIEW),
      read(BITS_VIEW),
      read(ARCHIVE_PAGE)
    ]);

    expect(blogView).toContain('seriesOptions={seriesOptions}');
    expect(bitsView).not.toContain('seriesOptions');
    expect(archivePage).toContain('seriesOptions={seriesOptions}');
  });

  it('分割线是淡色 1px 线，系列标签加粗以便与「#标签」区分', async () => {
    const css = await read(ENTRY_TAGS_CSS);

    expect(css).toMatch(
      /\.entry-tags-dialog__divider\s*\{[^}]*border-top:\s*1px solid color-mix\(in srgb, var\(--border\)/
    );
    expect(css).toMatch(/\.entry-tags-dialog__list--series \.entry-tag-option__label\s*\{[^}]*font-weight:\s*600/);
  });
});

describe('entry-search：系列键走同一条表达式', () => {
  it('索引里的 seriesKeys 并进标签键集合', async () => {
    const source = await read(ENTRY_SEARCH);

    expect(source).toContain('seriesKeys?: string[];');
    expect(source).toContain('...(item.seriesKeys ?? [])');
    expect(source).toContain('BLOG_SERIES_TAG_PREFIX');
  });

  it('表达式胶囊与页头控件条都把系列显示成「系列：名称」', async () => {
    const source = await read(ENTRY_SEARCH);

    expect(source).toContain("chip.textContent = displayLabelFor(token.key);");
    expect(source).toContain('`系列：${labelForTagKey(key)}`');
    // 前缀由 labelOf 一并给出，控件条不再统一拼 `#`
    expect(source).toContain('labelOf: displayLabelFor');
    expect(source).toContain("labelPrefix: '',");
  });

  it('/blog/index.json 输出命名空间化的系列键', async () => {
    const source = await read(BLOG_INDEX_JSON);

    expect(source).toContain('getSeriesTagKey(series)');
    expect(source).toContain('seriesKeys: series ? [getSeriesTagKey(series)] : [],');
  });
});
