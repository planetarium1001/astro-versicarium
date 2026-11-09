import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 静态契约：系列在条目上的四档呈现如何接线。
 *
 * 纯排版规则由 `entry-display.test.ts` 覆盖；这里守住「哪个组件在什么档位渲染什么」：
 * - 列表卡片与首页条目：`meta` 落元信息行（可点筛选），`pill` / `prefix` 交给标题行；
 * - 归档行：行内没有元信息行，`meta` 退化成标题后的淡色文本（整行已是 `<a>`，不能再套链接）；
 * - 不属于任何系列时零输出。
 */

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

const BLOG_CARD = 'src/components/BlogCard.astro';
const ENTRY_LIST_ITEM = 'src/components/EntryListItem.astro';
const ENTRY_TITLE_LINE = 'src/components/EntryTitleLine.astro';
const BLOG_PAGE_VIEW = 'src/components/BlogPageView.astro';
const HOME_PAGE = 'src/pages/index.astro';
const ENTRY_DISPLAY = 'src/lib/entry-display.ts';
const ARCHIVE_LIB = 'src/lib/archive.ts';
const ARCHIVE_PAGE = 'src/pages/archive/index.astro';
const LISTS_CSS = 'src/styles/components/lists.css';
const ARCHIVE_INDEX = 'src/pages/archive/index.json.ts';

describe.each([
  ['BlogCard', BLOG_CARD],
  ['EntryListItem', ENTRY_LIST_ITEM]
])('%s：系列 props 与四档接线', (_name, file) => {
  it('接收系列名 / 序号 / 成员总数 / 系列键四个 props', async () => {
    const source = await read(file);

    expect(source).toContain('seriesName = null');
    expect(source).toContain('seriesIndex = null');
    expect(source).toContain('seriesTotal = null');
    expect(source).toContain('seriesSlug = null');
    expect(source).toContain('seriesName?: string | null;');
    expect(source).toContain('seriesIndex?: number | null;');
    expect(source).toContain('seriesTotal?: number | null;');
    expect(source).toContain('seriesSlug?: string | null;');
  });

  it('按站点设置分档：meta 进元信息行，pill / prefix 进标题段', async () => {
    const source = await read(file);

    // 槽位判定由 entry-display 的纯函数统一给出，两个组件只消费结果
    expect(source).toContain('resolveEntrySeriesSlots(');
    expect(source).toContain('{ name: seriesName, slug: seriesSlug, index: seriesIndex, total: seriesTotal }');
    expect(source).toContain('showInTitle: showSeriesInTitle');
    expect(source).toContain('showInMeta: showSeriesInMeta');
    expect(source).toContain('orderText: seriesOrderText');
  });

  it('meta 档把「系列名 N/M」放在标签之前，并链接到 canonical 系列筛选', async () => {
    const source = await read(file);

    expect(source).toContain('meta-line__item--series');
    expect(source).toContain('class="entry-series-link"');
    expect(source).toContain('href={withBase(getSeriesFilterHref(seriesSlug ?? \'\'))}');
    expect(source).toContain('aria-label={`筛选系列 ${seriesName}`}');
    expect(source).toContain('data-article-series-link={seriesTagKey}');
    // 系列段在标签组之前
    expect(source.indexOf('meta-line__item--series')).toBeLessThan(
      source.indexOf('meta-line__item--tags')
    );
  });

  it('没有系列时零输出：标题段只按 pill / prefix 传值，元信息行只在 meta 档出现', async () => {
    const source = await read(file);

    expect(source).toContain('seriesName={showSeriesInTitle ? seriesName : null}');
    expect(source).toContain('seriesIndex={showSeriesInTitle ? seriesIndex : null}');
    expect(source).toContain('seriesTotal={showSeriesInTitle ? seriesTotal : null}');
    expect(source).toContain('{showSeriesInMeta ? (');
  });
});

describe('EntryTitleLine：渲染系列段', () => {
  it('系列胶囊复用 muted-pill，系列名与版本名称同级文本样式', async () => {
    const source = await read(ENTRY_TITLE_LINE);

    expect(source).toContain('data-entry-title-token="series-name"');
    expect(source).toContain('class="entry-title__series-name"');
    expect(source).toContain('class="muted-pill entry-title__series-label"');
    expect(source).toContain('data-entry-title-token="series-label"');
    expect(source).toContain('seriesName?: string | null;');
    expect(source).toContain('seriesIndex?: number | null;');
    expect(source).toContain('seriesTotal?: number | null;');
    // 站点设置在前，显式传参（后台预览）可覆盖
    expect(source).toContain('resolveEntrySeriesDisplay(ui)');
    expect(source).toContain('seriesMode ?? seriesDisplay.mode');
    // 档位写在根节点上（仅当真的产出系列段），CSS 才能按档位微调（例如 prefix 允许系列名换行）
    expect(source).toContain('data-entry-series-mode={seriesModeAttr}');
    expect(source).toContain("segment.kind === 'series-name' || segment.kind === 'series-label'");
  });

  it('系列胶囊与系列名的样式落在 lists.css，版本段既有规则不动', async () => {
    const css = await read(LISTS_CSS);

    expect(css).toMatch(/\.entry-title__version-name,\s*\n\.entry-title__series-name\s*\{[^}]*color:\s*var\(--muted\)/);
    expect(css).toMatch(
      /\.entry-title\[data-entry-series-mode='prefix'\] \.entry-title__series-name\s*\{[^}]*white-space:\s*normal/
    );
    expect(css).toMatch(
      /\.entry-title \.entry-title__series-label\s*\{[^}]*height:\s*var\(--entry-pill-height\)/
    );
    // 版本号胶囊的对齐规则保持原样（系列胶囊单独成规则）
    expect(css).toMatch(
      /\.entry-title \.entry-title__badge,\s*\n\.entry-title \.entry-title__version-label \{[^}]*align-self:\s*flex-start/
    );
  });
});

describe('列表页接线：/blog 与首页', () => {
  it('BlogPageView 把系列索引转成条目数据与筛选项', async () => {
    const source = await read(BLOG_PAGE_VIEW);

    expect(source).toContain('getVisibleBlogSeriesIndex()');
    expect(source).toContain('buildEntrySeriesLookup(seriesIndex)');
    expect(source).toContain('key: getSeriesTagKey(group.slug)');
    expect(source).toContain('count: group.total');
    expect(source).toContain('seriesOptions={seriesOptions}');
    expect(source).toContain('seriesName={series?.name ?? null}');
    expect(source).toContain('seriesSlug={series?.slug ?? null}');
  });

  it('首页条目同样提供系列数据（呈现档位由组件按站点设置决定）', async () => {
    const source = await read(HOME_PAGE);

    expect(source).toContain('buildEntrySeriesLookup(await getVisibleBlogSeriesIndex())');
    expect(source).toContain('seriesName={series?.name ?? null}');
    expect(source).toContain('seriesSlug={series?.slug ?? null}');
  });
});

describe('归档：行内没有元信息行，meta 档退化为淡色文本', () => {
  it('ArchiveRow 携带真系列字段，并按条目反查系列序号', async () => {
    const source = await read(ARCHIVE_LIB);

    expect(source).toContain('seriesSlug?: string;');
    expect(source).toContain('seriesName?: string;');
    expect(source).toContain('seriesIndex?: number;');
    expect(source).toContain('seriesTotal?: number;');
    expect(source).toContain('getVisibleBlogSeriesIndex()');
    // 与列表一致：只有版本组的代表行（最新版）挂系列信息
    expect(source).toContain('buildEntrySeriesLookup(seriesIndex)');
    expect(source).toContain('seriesByEntryId.get(entry.id)');
  });

  it('归档把系列交给标题段渲染：不再有独立的行内节点', async () => {
    const source = await read(ARCHIVE_PAGE);

    // 归档行整行是一个 <a>，`.entry-title` 是 flex 容器：
    // 系列必须作为标题段进入这个容器，追加在容器外会被挤到第二行。
    expect(source).toContain('seriesName={row.seriesName ?? null}');
    expect(source).toContain('seriesIndex={row.seriesIndex ?? null}');
    expect(source).toContain('seriesTotal={row.seriesTotal ?? null}');
    expect(source).not.toContain('archive-timeline__series');
    expect(source).not.toContain('seriesMetaText');

    // `meta` 档在归档 surface 上的退化由 entry-display 负责，样式落在标题段上
    const display = await read(ENTRY_DISPLAY);
    expect(display).toContain("seriesMode === 'meta' && surface === 'archive' && seriesName");

    const css = await read(LISTS_CSS);
    expect(css).toMatch(/\.entry-title__series-name[\s\S]*?font-size:\s*0\.78em/);
  });

  it('/archive 也提供系列筛选：选项来自博客行，索引输出 seriesKeys', async () => {
    const [page, index, archiveLib] = await Promise.all([
      read(ARCHIVE_PAGE),
      read(ARCHIVE_INDEX),
      read(ARCHIVE_LIB)
    ]);

    expect(page).toContain('seriesOptions={seriesOptions}');
    expect(page).toContain('collectArchiveSeriesOptions(rows)');
    // 选项与计数口径在 lib 里：只取博客行，且每个版本组的代表行只计一次
    expect(archiveLib).toContain("row.kind !== 'blog' || !row.seriesSlug");
    expect(archiveLib).toContain('getSeriesTagKey(row.seriesSlug)');
    expect(index).toContain('seriesKeys');
    expect(index).toContain('getSeriesTagKey(row.seriesSlug)');
  });
});
