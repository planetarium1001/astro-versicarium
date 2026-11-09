import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 静态契约：文章页「同系列文章」提示条与抽屉。
 *
 * 结构与版本抽屉完全镜像（同一批类名与 data-* 约定，同一个抽屉脚本），
 * 但文案只能是系列语义：序号是「第 N 篇 / 共 M 篇」，绝不出现版本词汇。
 * 交互行为由 `article-version-drawer.test.ts` 覆盖（两个组件共用同一套逻辑）。
 */

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

const NOTICE = 'src/components/ArticleSeriesNotice.astro';
const VERSION_NOTICE = 'src/components/ArticleVersionNotice.astro';
const DRAWER_SCRIPT = 'src/scripts/article-version-drawer.ts';
const LAYOUT = 'src/layouts/ArticleLayout.astro';
const ARTICLE_PAGE = 'src/pages/blog/[slug].astro';
const VERSION_CSS = 'src/styles/components/article-version.css';

/** 版本语义词汇：系列抽屉里一个都不许出现。 */
const FORBIDDEN_WORDS = ['最新', '历史', '查看最新版', '已归档', '可能过时'];

/**
 * 去掉注释再检查词汇：注释里可以解释「不要写版本语义」，那不属于用户看到的文案。
 * 只剥注释足够，因为本用例守的是文案，不是语法。
 */
const stripComments = (source: string): string =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('ArticleSeriesNotice：系列提示条与抽屉', () => {
  it('复用版本抽屉的类名与 data-* 约定，并带上泛化后的根标记', async () => {
    const source = await read(NOTICE);

    expect(source).toContain('data-article-drawer');
    expect(source).toContain('article-version-notice');
    expect(source).toContain('article-version-notice__row');
    expect(source).toContain('class="version-drawer"');
    expect(source).toContain('data-version-drawer');
    expect(source).toContain('data-version-trigger');
    expect(source).toContain('data-version-close');
    expect(source).toContain('data-dialog-close');
    expect(source).toContain('version-drawer__panel');
    expect(source).toContain('version-list');
    expect(source).toContain('version-item');
    expect(source).toContain('version-item__status');
    // 触发器的 aria 契约与版本抽屉一致：展开态 + 关联的 dialog id
    expect(source).toContain('aria-expanded="false"');
    expect(source).toContain('aria-controls={drawerId}');
  });

  it('文案只表达系列语义：入口、抽屉标题、正在阅读、尾部入口', async () => {
    const source = await read(NOTICE);

    expect(source).toContain('<span class="article-version-trigger__label" aria-hidden="true">同系列</span>');
    expect(source).toContain('aria-label={`打开同系列文章（共 ${notice.series.total} 篇）`}');
    expect(source).toContain('同系列文章（共 {notice.series.total} 篇）');
    expect(source).toContain('第 {notice.member.index} 篇 / 共 {notice.series.total} 篇');
    expect(source).toContain('class="version-item__status">正在阅读');
    expect(source).toContain('筛选当前系列');
    expect(source).toContain('data-article-series-filter={getSeriesTagKey(notice.series.slug)}');
    expect(source).toContain('href={withBase(getSeriesFilterHref(notice.series.slug))}');
  });

  it('每一项都是 1-based 序号 + 标题，序号来自系列模型的 index / total', async () => {
    const source = await read(NOTICE);

    expect(source).toContain('{item.index}/{notice.series.total}');
    expect(source).toContain('{item.title}');
    // 当前项不可点（就是正在读的这篇），其余项是链接
    expect(source).toContain('<span class="version-item__main">');
    expect(source).toContain('<a class="version-item__main" href={withBase(item.href)}>');
  });

  it('不出现任何版本语义词汇', async () => {
    const source = stripComments(await read(NOTICE));

    for (const word of FORBIDDEN_WORDS) {
      expect(source, `系列抽屉不应出现「${word}」`).not.toContain(word);
    }
  });

  it('无系列或单篇成员时不渲染整块', async () => {
    const source = await read(NOTICE);

    expect(source).toContain('const seriesIndex = slug ? await getVisibleBlogSeriesIndex() : null;');
    expect(source).toContain('series.members.length > 1');
    // 根节点只在 shouldShow 分支里出现
    expect(source.indexOf('data-article-drawer')).toBeGreaterThan(source.indexOf('{notice ? ('));
  });
});

describe('ArticleVersionNotice：与系列抽屉共用同一个根标记', () => {
  it('版本提示条也带 data-article-drawer，两套抽屉共存时脚本都能挂上', async () => {
    const source = await read(VERSION_NOTICE);

    expect(source).toContain('data-article-drawer');
    expect(source).toContain('data-article-version');
  });

  it('版本判定改用 versionGroup，文案不再说「本系列」', async () => {
    const source = await read(VERSION_NOTICE);

    expect(source).toContain('Boolean(route.group.versionGroup)');
    expect(source).not.toContain('route.group.series');
    expect(source).not.toContain('本系列');
  });
});

describe('article-version-drawer.ts：根选择器泛化', () => {
  it('只扫 [data-article-drawer]，两个组件共用同一套焦点 / 滚动锁 / 退场逻辑', async () => {
    const source = await read(DRAWER_SCRIPT);

    expect(source).toContain("document.querySelectorAll<ArticleDrawerRoot>('[data-article-drawer]')");
    expect(source).not.toContain("'[data-article-version]'");
    // 焦点与滚动的既有实现保持不变
    expect(source).toContain('lockScrollFor(dialog)');
    expect(source).toContain('restoreTriggerFocus()');
    expect(source).toContain("animationName.startsWith('version-drawer-out')");
  });
});

describe('ArticleLayout：系列提示条挂在版本提示条之后', () => {
  it('顺序固定为「版本 → 系列」，且都只在有对应数据时渲染', async () => {
    const source = await read(LAYOUT);

    expect(source).toContain("import ArticleSeriesNotice from '../components/ArticleSeriesNotice.astro';");
    const version = source.indexOf('<ArticleVersionNotice route={route} />');
    const series = source.indexOf(
      '<ArticleSeriesNotice entryId={entry.id} seriesSlug={entry.data.series ?? null} />'
    );
    expect(version).toBeGreaterThan(-1);
    expect(series).toBeGreaterThan(version);
  });
});

describe('详情页元信息行：日期与标签之间的系列入口', () => {
  it('页面把系列索引查好传进布局，避免每页重复建索引', async () => {
    const source = await read(ARTICLE_PAGE);

    expect(source).toContain('getVisibleBlogSeriesIndex()');
    expect(source).toContain('buildEntrySeriesLookup(seriesIndex)');
    expect(source).toContain('series: seriesByEntryId.get(route.entry.id) ?? null');
    expect(source).toContain('series={series}');
  });

  it('入口夹在日期与标签之间，样式与筛选行为对齐标签', async () => {
    const source = await read(LAYOUT);

    // 版位：日期项 → 系列项 → 标签项
    const date = source.indexOf('articleMetaSettings.showDate ? (');
    const series = source.indexOf('meta-line__item--series');
    const tags = source.indexOf('meta-line__item meta-line__item--tags');
    expect(date).toBeGreaterThan(-1);
    expect(series).toBeGreaterThan(date);
    expect(tags).toBeGreaterThan(series);

    // 与列表元信息行共用同一套链接类与筛选入口：点一下等于按系列筛选
    expect(source).toContain('class="entry-series-link"');
    expect(source).toContain('getSeriesFilterHref(series.slug)');
    expect(source).toContain('getSeriesTagKey(series.slug)');
    expect(source).toContain('data-article-series-link={seriesLink.tagKey}');
    expect(source).toContain('aria-label={`筛选系列 ${seriesLink.name}`}');

    // 系列只有一篇时没有「第几篇」，与抽屉一致地不显示
    expect(source).toContain('series.total > 1');
    // 站点关掉系列呈现后，这里也不再多出一个入口
    expect(source).toContain("seriesDisplay.mode !== 'hidden'");
    // 只有系列、没开日期与标签时，元信息行仍然要出现
    expect(source).toContain('|| Boolean(seriesLink)');
  });

  it('悬停才出现下划线，常态与标签一样不带下划线', async () => {
    const css = await read('src/styles/components/lists.css');

    expect(css).toMatch(/\.meta-line \.entry-series-link\s*\{[^}]*text-decoration:\s*none/);
    expect(css).toMatch(
      /:root:not\(\[data-input="touch"\]\) \.meta-line \.entry-series-link:hover\s*\{[^}]*text-decoration:\s*underline/
    );
  });
});

describe('article-version.css：系列抽屉尾部入口', () => {
  it('「筛选当前系列」与条目状态文字同档、右对齐，不抢正文注意力', async () => {
    const css = await read(VERSION_CSS);

    expect(css).toMatch(/\.article-series-notice__filter-row\s*\{[^}]*justify-content:\s*flex-end/);
    expect(css).toMatch(/\.article-series-notice__filter\s*\{[^}]*font-size:\s*12px/);
    // 可点的筛选入口用主题色，才看得出能点
    expect(css).toMatch(/\.article-series-notice__filter\s*\{[^}]*color:\s*var\(--accent\)/);
    expect(css).toMatch(/\.article-series-notice__filter:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/);
    expect(css).toMatch(
      /:root:not\(\[data-input="touch"\]\) \.article-series-notice__filter:hover\s*\{[^}]*text-decoration:\s*underline/
    );
  });
});
