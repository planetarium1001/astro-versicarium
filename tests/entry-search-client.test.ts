// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTagKeys } from '../src/lib/tags';
import {
  PAGES,
  clickTag,
  importEntrySearch,
  loadPage,
  pageItems,
  stubEntrySearchEnvironment,
  tagButton,
  tagButtons,
  visibleItems,
  visibleSlugs
} from './entry-search-harness';

/**
 * 客户端分页会隐藏第一页之外的条目；清空筛选后应恢复的是「当前页」而不是全部 DOM。
 * 页大小来自页面上的 data-page-size，避免把 12 / 20 写死。
 */
const visiblePageSize = (): number => {
  const root = document.querySelector<HTMLElement>('[data-entry-filters]');
  const pageSize = Number(root?.dataset.pageSize ?? '0');
  const total = pageItems().length;
  return pageSize > 0 ? Math.min(total, pageSize) : total;
};

/**
 * 端到端客户端行为测试（真实页面 HTML + 真实 entry-search.ts）。
 *
 * jsdom 载入构建产物里的真实 HTML，stub fetch 返回真实 index.json，再 import 真实脚本断言 DOM：
 * 事件绑定、index 加载、hidden 语义、slug 归一化任一环断掉都表现为「点了没反应」。
 */

describe('entry-search 客户端行为', () => {
  beforeEach(() => {
    stubEntrySearchEnvironment();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each(PAGES)('$name：每个条目都带 data-entry-item 与 data-slug', async (page) => {
    await loadPage(page);
    const items = pageItems();

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect((item.dataset.slug ?? '').trim(), 'data-slug 不能为空').not.toBe('');
    }
  });

  it.each(PAGES)('$name：筛选前全部条目可见', async (page) => {
    await loadPage(page);
    expect(visibleItems().length).toBe(pageItems().length);
  });

  it.each(PAGES)('$name：描述与计数组分开渲染（窄屏放不下时整组回退第二行的前提）', async (page) => {
    await loadPage(page);
    const subtitle = document.querySelector<HTMLElement>('.page-subtitle--entry-filters');
    const text = subtitle?.querySelector<HTMLElement>('.page-subtitle__text');
    const meta = subtitle?.querySelector<HTMLElement>('.page-subtitle__meta');
    const count = subtitle?.querySelector<HTMLElement>('[data-page-subtitle-count]');
    expect(subtitle, '页头需要描述行容器').not.toBeNull();
    expect(text, '描述行需要描述文本').not.toBeNull();
    expect(meta, '描述行需要计数组').not.toBeNull();
    expect(count, '计数组需要计数元素').not.toBeNull();
    // 计数不在描述文本里：换行后描述行末尾不会有「共 N 篇」或残留分隔符
    expect(text!.textContent ?? '').not.toContain('共');
    expect((text!.textContent ?? '').trim().endsWith('·')).toBe(false);
    expect((count!.textContent ?? '').trim()).toMatch(/^共 \d+ (篇|条)/);
    // 计数、RSS、标签入口同属一个不换行的整体
    expect(meta!.contains(count!)).toBe(true);
    expect(meta!.querySelector('.page-subtitle__link, [data-entry-tag-trigger]')).not.toBeNull();
  });

  it('bits：标签筛选后计数保留「动态」后缀', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();
    const key = (tagButtons()[0]?.dataset.entryTagKey ?? '').trim();
    expect(key, '需要至少一个标签').not.toBe('');
    await clickTag(key);
    await vi.waitFor(() => {
      const count = document.querySelector<HTMLElement>('[data-page-subtitle-count]')?.textContent ?? '';
      expect(count).toMatch(/^共 \d+ 条动态$/);
    });
  });

  it.each(PAGES)('$name：点击一个标签后只剩命中条目', async (page) => {
    const { indexItems } = await loadPage(page);
    await importEntrySearch();

    // 选一个只命中部分条目的标签。
    // 命中数必须用客户端同一套归一化（getTagKeys）来算：index.json 存原始标签，
    // DOM 的 data-entry-tag-key 是归一化后的 key，直接按小写比较会把命中数算成 0。
    const candidate = tagButtons()
      .map((el) => (el.dataset.entryTagKey ?? '').trim())
      .find((key) => {
        const hit = indexItems.filter((item) => getTagKeys(item.tags).includes(key)).length;
        return hit > 0 && hit < indexItems.length;
      });

    expect(candidate, '需要至少一个「只命中部分条目」的标签').toBeTruthy();
    await clickTag(candidate!);

    const expected = indexItems
      .filter((item) => getTagKeys(item.tags).includes(candidate!))
      .map((item) => item.slug)
      .sort();

    expect(visibleSlugs().sort()).toEqual(expected);
    expect(visibleItems().length).toBeLessThan(pageItems().length);
  });

  it.each(PAGES)('$name：清空标签后恢复全部条目', async (page) => {
    await loadPage(page);
    await importEntrySearch();

    const candidate = tagButtons()[0];
    expect(candidate, '需要至少一个标签按钮').toBeTruthy();
    const key = (candidate!.dataset.entryTagKey ?? '').trim();
    await clickTag(key);
    expect(visibleItems().length).toBeLessThan(pageItems().length);

    const clear = document.querySelector<HTMLElement>('[data-entry-tag-clear]');
    expect(clear, '需要「清除筛选」按钮').not.toBeNull();
    clear!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(visibleItems().length).toBe(visiblePageSize());
    });
  });

  it('bits：筛选后列表不会被整体隐藏', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    const listRoot = document.getElementById('bits-list');
    expect(listRoot).not.toBeNull();

    const candidate = tagButtons()[0];
    expect(candidate, '需要至少一个标签按钮').toBeTruthy();
    await clickTag((candidate!.dataset.entryTagKey ?? '').trim());

    expect(listRoot!.hidden, 'bits 列表不能被整体 hidden').toBe(false);
  });

  it('archive：点击一级胶囊后只剩该作用域的行，且清空已选标签', async () => {
    await loadPage(PAGES[2]);
    await importEntrySearch({ archiveScope: true });

    // 先选一个标签，再切胶囊，验证「切换胶囊会清空标签」
    const firstTag = tagButtons()[0];
    expect(firstTag, '归档页需要标签按钮').toBeTruthy();
    await clickTag((firstTag!.dataset.entryTagKey ?? '').trim());

    const projectsPill = document.querySelector<HTMLElement>('[data-archive-scope="projects"]');
    expect(projectsPill, '需要 projects 一级胶囊').toBeTruthy();
    projectsPill!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    await vi.waitFor(
      () => {
        const kinds = new Set(
          visibleItems().map((el) => (el.dataset.archiveKind ?? '').trim())
        );
        expect([...kinds]).toEqual(['projects']);
      },
      { timeout: 3000 }
    );

    // 标签已被清空
    await vi.waitFor(() => {
      expect(tagButtons().every((el) => el.getAttribute('aria-pressed') === 'false')).toBe(true);
    });
  });

  it('archive：切换回「全部」恢复全部行', async () => {
    await loadPage(PAGES[2]);
    await importEntrySearch({ archiveScope: true });

    const allPill = document.querySelector<HTMLElement>('[data-archive-scope="all"]');
    const devlogPill = document.querySelector<HTMLElement>('[data-archive-scope="devlog"]');
    expect(allPill && devlogPill).toBeTruthy();

    // 期望条数从 DOM 推导，不写死数字，内容变化不会让用例失败
    const devlogCount = pageItems().filter(
      (el) => (el.dataset.archiveKind ?? '').trim() === 'devlog'
    ).length;
    expect(devlogCount, '需要一个非空的 devlog 分组').toBeGreaterThan(0);
    expect(devlogCount, 'devlog 分组不应覆盖全部条目').toBeLessThan(pageItems().length);

    devlogPill!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(visibleItems().length).toBe(devlogCount);
    });

    allPill!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(visibleItems().length).toBe(visiblePageSize());
    });
  });

  it('archive：切换作用域后副标题计数跟随当前作用域', async () => {
    await loadPage(PAGES[2]);
    await importEntrySearch({ archiveScope: true });

    const devlogCount = pageItems().filter(
      (el) => (el.dataset.archiveKind ?? '').trim() === 'devlog'
    ).length;
    const devlogPill = document.querySelector<HTMLElement>('[data-archive-scope="devlog"]');
    expect(devlogPill).toBeTruthy();
    devlogPill!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const subtitle = document.querySelector<HTMLElement>('[data-page-subtitle-count]')?.textContent ?? '';
      expect(subtitle).toContain(`共 ${devlogCount} 条内容`);
    });
  });

  it('archive：切换胶囊时滑块做弹性位移（沿用年份胶囊的实现）', async () => {
    await loadPage(PAGES[2]);

    // jsdom 不做布局：给定确定的 rect 与 offsetWidth 以断言几何
    type Rect = { left: number; width: number };
    const rects: Record<'all' | 'blog' | 'projects' | 'devlog', Rect> = {
      all: { left: 3, width: 60 },
      blog: { left: 69, width: 66 },
      projects: { left: 141, width: 72 },
      devlog: { left: 219, width: 68 }
    };
    const rootRect = { left: 0, width: 300 };
    const originalRect = Element.prototype.getBoundingClientRect;
    const originalOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const scope = (this as HTMLElement).dataset?.archiveScope as keyof typeof rects | undefined;
      const rect = (scope ? rects[scope] : undefined) ?? rootRect;
      return {
        ...rect, top: 0, right: rect.left + rect.width, bottom: 34, height: 34, x: rect.left, y: 0,
        toJSON: () => rect
      } as DOMRect;
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        const scope = this.dataset?.archiveScope as keyof typeof rects | undefined;
        return (scope && rects[scope]?.width) || 0;
      }
    });

    try {
      await importEntrySearch({ archiveScope: true });

      const bar = document.querySelector<HTMLElement>('[data-archive-scope-bar]')!;
      const cursor = document.querySelector<HTMLElement>('[data-archive-scope-cursor]')!;
      expect(bar.dataset.ready, '初始化后滑块应就绪（可淡入）').toBe('true');
      // 滑块宽度 = 当前激活胶囊的宽度，避免长标签的滑块盖住相邻胶囊
      expect(cursor.style.width).toBe(`${rects.all.width}px`);

      const expectedLeft = (scope: keyof typeof rects) => {
        const rect: Rect = rects[scope];
        return rect.left - rootRect.left;
      };

      const initial = Number(/translateX\((-?[\d.]+)px\)/.exec(cursor.style.transform)?.[1]);
      expect(Math.abs(initial - expectedLeft('all'))).toBeLessThanOrEqual(1);

      const devlogPill = document.querySelector<HTMLElement>('[data-archive-scope="devlog"]')!;
      devlogPill.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      const after = Number(/translateX\((-?[\d.]+)px\)/.exec(cursor.style.transform)?.[1]);
      expect(Math.abs(after - expectedLeft('devlog'))).toBeLessThanOrEqual(1);
      expect(after, '滑块应真的移动了').not.toBe(initial);
      expect(cursor.style.width, '切换时滑块应收缩到当前胶囊宽度').toBe(`${rects.devlog.width}px`);
    } finally {
      Element.prototype.getBoundingClientRect = originalRect;
      if (originalOffset) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffset);
    }
  });

  it('archive：筛选后没有命中内容的月份分组被隐藏', async () => {
    const { indexItems } = await loadPage(PAGES[2]);
    await importEntrySearch({ archiveScope: true });

    const groups = () => Array.from(document.querySelectorAll<HTMLElement>('[data-archive-group]'));
    expect(groups().length).toBeGreaterThan(1);
    // 客户端分页会先隐藏第一页之外的月份组；这里只要求初始有可见分组，
    // 具体哪些组可见由分页决定，筛选后的断言再看可见组。
    expect(groups().some((group) => !group.hidden)).toBe(true);

    // 选一个只命中最后一个月（1 月）的标签
    const matchesFor = (key: string) =>
      indexItems.filter((item) => getTagKeys(item.tags).includes(key));
    // 取命中数最少的标签：断言可见分组数与命中项所在月分数一致，而非硬编码 1。
    // 语料变化时这个用例仍然成立。
    const candidate = tagButtons()
      .map((el) => (el.dataset.entryTagKey ?? '').trim())
      .sort((a, b) => matchesFor(a).length - matchesFor(b).length)[0];
    expect(candidate, '需要至少一个标签').toBeTruthy();

    const expectedSlugs = matchesFor(candidate!).map((item) => item.slug).sort();
    await clickTag(candidate!);

    await vi.waitFor(
      () => {
        const visibleGroups = groups().filter((group) => !group.hidden);
        const expectedGroupCount = new Set(expectedSlugs.map((slug) => slug.slice(0, 4))).size;
        expect(
          visibleGroups.length,
          `命中 ${expectedSlugs.length} 条时不应留下没有内容的月份分组`
        ).toBeLessThanOrEqual(expectedGroupCount);
      },
      { timeout: 3000 }
    );

    // 所有可见分组里必须至少有一个命中项，且不含未命中项
    for (const group of groups().filter((g) => !g.hidden)) {
      const slugs = Array.from(group.querySelectorAll<HTMLElement>('[data-entry-item]'))
        .filter((el) => !el.hidden)
        .map((el) => (el.dataset.slug ?? '').trim());
      expect(slugs.length, '可见分组必须含可见条目').toBeGreaterThan(0);
      for (const slug of slugs) expect(expectedSlugs).toContain(slug);
    }
  });

  it('archive：每个行都有 data-slug 且与 index 的 slug 双向一致（标签匹配的前提）', async () => {
    const { indexItems } = await loadPage(PAGES[2]);
    const domSlugs = pageItems().map((el) => (el.dataset.slug ?? '').trim()).sort();
    const indexSlugs = indexItems.map((item) => item.slug).sort();

    expect(domSlugs.every(Boolean), 'data-slug 不能为空').toBe(true);
    expect(domSlugs).toEqual(indexSlugs);
  });

  it('bits：已选标签控件条自动滑入，用 + / 连接，可逐个移除', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    // 未选择时不应存在控件条
    expect(document.querySelector('[data-entry-tag-status]')).toBeNull();

    const keys = tagButtons().map((el) => (el.dataset.entryTagKey ?? '').trim());
    expect(keys.length, 'bits 需要至少两个标签').toBeGreaterThanOrEqual(2);
    await clickTag(keys[0]!);

    const strip = document.querySelector<HTMLElement>('[data-entry-tag-status]');
    expect(strip, '选中标签后控件条应自动出现').not.toBeNull();
    expect(strip!.querySelectorAll('.entry-tag-chip').length).toBe(1);
    // 只有一个标签时不需要连接符
    expect(strip!.querySelectorAll('.entry-tag-op').length).toBe(0);
    // 默认 AND 用 +
    expect(strip!.querySelector('.entry-tag-op')).toBeNull();

    // 选第二个标签 → 出现连接符，默认 `+`
    await clickTag(keys[1]!);
    const strip2 = document.querySelector<HTMLElement>('[data-entry-tag-status]')!;
    expect(strip2.querySelectorAll('.entry-tag-chip').length).toBe(2);
    const op = strip2.querySelector<HTMLElement>('.entry-tag-op');
    expect(op, '两个以上标签应出现连接符').not.toBeNull();
    expect(op!.textContent).toBe('+');

    // 点连接符 → 切成 `/`（OR）
    op!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(
        document.querySelector<HTMLElement>('.entry-tag-op')?.textContent
      ).toBe('/');
    });
    expect(window.location.search).toContain('mode=or');

    // 逐个移除：清掉一个标签后连接符消失
    const removeBtn = document.querySelector<HTMLElement>('.entry-tag-chip__remove')!;
    removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.entry-tag-chip').length).toBe(1);
    });
    expect(document.querySelector('.entry-tag-op')).toBeNull();
  });

  it('bits：控件条的「清除」按钮清空筛选', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    const firstTag = tagButtons()[0];
    expect(firstTag, '需要至少一个标签按钮').toBeTruthy();
    await clickTag((firstTag!.dataset.entryTagKey ?? '').trim());
    expect(visibleItems().length).toBeLessThan(pageItems().length);

    const clear = document.querySelector<HTMLElement>('[data-entry-tag-clear]');
    expect(clear, '控件条需要有清除按钮').not.toBeNull();
    clear!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    await vi.waitFor(
      () => {
        expect(visibleItems().length, '清除后应恢复全部条目').toBe(pageItems().length);
      },
      { timeout: 3000 }
    );
    await vi.waitFor(() => {
      expect(document.querySelector('[data-entry-tag-status]')).toBeNull();
    });
    expect(window.location.search).not.toContain('tags=');
  });

  it('bits：url 写入 ?tags=&mode=', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    const candidate = tagButtons()[0];
    expect(candidate, '需要至少一个标签按钮').toBeTruthy();
    const key = (candidate!.dataset.entryTagKey ?? '').trim();
    await clickTag(key);

    expect(window.location.search).toContain('tags=');
    expect(window.location.search).toContain('mode=');
  });

  it('bits：控件条含图标、可点的 #标签、切换标签与清除筛选', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    const key = (tagButtons()[0]!.dataset.entryTagKey ?? '').trim();
    await clickTag(key);

    const strip = document.querySelector<HTMLElement>('[data-entry-tag-status]');
    expect(strip, '选中标签后控件条应出现').not.toBeNull();

    // 条首标签图标（lucide `tag` 的 svg）
    const icon = strip!.querySelector('.entry-tag-apply__icon');
    expect(icon, '控件条条首需要标签图标').not.toBeNull();
    expect(icon!.querySelector('svg'), '图标必须是真正的 svg，不是缺字方块').not.toBeNull();

    // `#标签` 是可点按钮
    const chipLabel = strip!.querySelector<HTMLElement>('.entry-tag-chip__label');
    expect(chipLabel).not.toBeNull();
    expect(chipLabel!.tagName).toBe('BUTTON');
    expect(chipLabel!.textContent?.startsWith('#')).toBe(true);

    // 两个动作按钮在副标题那一行，沿用主题既有的文字链接样式
    const actionsBlock = document.querySelector<HTMLElement>('[data-entry-tag-actions]');
    expect(actionsBlock, '动作按钮需要在副标题那一行').not.toBeNull();
    expect(actionsBlock!.parentElement?.classList.contains('page-subtitle')).toBe(true);
    const actions = Array.from(actionsBlock!.querySelectorAll<HTMLElement>('button'));
    expect(actions.map((el) => el.textContent?.trim())).toEqual(['切换标签', '清除筛选']);
    // 切换标签 = accent 色的 `.page-subtitle__action`，清除 = 灰色的 `.page-subtitle__link`
    expect(actions[0]!.classList.contains('page-subtitle__action')).toBe(true);
    expect(actions[1]!.classList.contains('page-subtitle__link')).toBe(true);
    // 动作已不在第一行
    expect(strip!.querySelector('[data-entry-tag-clear]')).toBeNull();
  });

  // 有标签时页头切成两行两列：第一行标题 + 控件条，第二行副标题 + 动作，
  // 副标题里的 #标签 入口换成「切换标签」；清空后恢复单行。
  it('bits：有已选标签时页头切成两行两列，副标题的 #标签 入口换成「切换标签」', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    const heading = document.querySelector<HTMLElement>('.page-heading')!;
    const titleRow = document.querySelector<HTMLElement>('.page-title-row')!;
    const tagTrigger = document.querySelector<HTMLElement>('[data-entry-tag-trigger]')!;
    expect(heading.classList.contains('page-heading--tag-bar'), '未筛选时不应有两行布局').toBe(false);
    expect(tagTrigger.hidden).toBe(false);

    const key = (tagButtons()[0]!.dataset.entryTagKey ?? '').trim();
    await clickTag(key);

    expect(heading.classList.contains('page-heading--tag-bar')).toBe(true);
    // 第一行：控件条在 .page-title-row 内（与标题并排）
    expect(titleRow.querySelector('[data-entry-tag-status]')).not.toBeNull();
    // 第二行：副标题 + 动作，且 #标签 入口隐藏
    const subtitle = heading.querySelector<HTMLElement>('.page-subtitle')!;
    expect(subtitle.querySelector('[data-entry-tag-actions]')).not.toBeNull();
    expect(tagTrigger.hidden, '有标签时 #标签 入口应让位').toBe(true);

    // 清空 → 恢复单行布局与 #标签 入口
    document.querySelector<HTMLElement>('[data-entry-tag-clear]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(document.querySelector('[data-entry-tag-status]')).toBeNull();
    });
    expect(heading.classList.contains('page-heading--tag-bar')).toBe(false);
    expect(document.querySelector('[data-entry-tag-actions]')).toBeNull();
    expect(tagTrigger.hidden).toBe(false);
  });

  it('bits：点控件条上的 #标签 打开标签选择器继续筛选（且不清空已选）', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    const key = (tagButtons()[0]!.dataset.entryTagKey ?? '').trim();
    await clickTag(key);
    const visibleBefore = visibleSlugs().sort();

    const dialog = document.querySelector<HTMLDialogElement>('[data-entry-tag-dialog]')!;
    expect(dialog.open).toBe(false);

    const chipLabel = document.querySelector<HTMLElement>('[data-entry-tag-status] .entry-tag-chip__label')!;
    chipLabel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(dialog.open, '点 #标签 应打开标签选择器').toBe(true);
    // 继续筛选 ≠ 清除：已选标签与可见集合都不变
    expect(document.querySelector<HTMLElement>('[data-entry-tag-status]')).not.toBeNull();
    expect(visibleSlugs().sort()).toEqual(visibleBefore);
    // 所有入口的 aria-expanded 同步为 true
    for (const button of document.querySelectorAll<HTMLElement>('[data-entry-tag-open]')) {
      expect(button.getAttribute('aria-expanded')).toBe('true');
    }

    // 关闭后回落为 false
    const close = document.querySelector<HTMLElement>('[data-entry-tag-close]')!;
    close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    for (const button of document.querySelectorAll<HTMLElement>('[data-entry-tag-open]')) {
      expect(button.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('bits：「切换标签」按钮同样打开选择器', async () => {
    await loadPage(PAGES[0]);
    await importEntrySearch();

    const key = (tagButtons()[0]!.dataset.entryTagKey ?? '').trim();
    await clickTag(key);

    const openBtn = document.querySelector<HTMLElement>('[data-entry-tag-actions] [data-entry-tag-open]')!;
    expect(openBtn, '控件条需要「切换标签」按钮').not.toBeNull();
    openBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(document.querySelector<HTMLDialogElement>('[data-entry-tag-dialog]')!.open).toBe(true);
  });

  // 首页导语的标签入口用 `?picker=tag` 直达；该参数失效会让这些入口变成死链。
  it.each([
    { name: 'blog', page: PAGES[1] },
    { name: 'archive', page: PAGES[2] }
  ])('$name：带 ?picker=tag 打开时自动弹出标签选择器（首页导语 tag 入口）', async ({ page }) => {
    await loadPage(page);
    window.history.replaceState(null, '', page.name === 'blog' ? '/blog/?picker=tag' : '/archive/?picker=tag');

    await importEntrySearch({ archiveScope: page.name === 'archive' });

    const dialog = document.querySelector<HTMLDialogElement>('[data-entry-tag-dialog]');
    expect(dialog, '页面需要有标签选择器').not.toBeNull();
    expect(dialog!.open, '?picker=tag 必须真的把选择器打开').toBe(true);
    // 打开后要把一次性参数从 URL 上清掉，避免刷新时反复弹
    expect(window.location.search).not.toContain('picker=');
  });

  it('blog：带 ?tags=<key> 直接打开即筛选（详情页 tag 链接的目标地址）', async () => {
    const { indexItems } = await loadPage(PAGES[1]);
    const key = tagButtons()[0]!.dataset.entryTagKey!.trim();
    window.history.replaceState(null, '', `/blog/?tags=${encodeURIComponent(key)}`);

    await importEntrySearch();

    const expected = indexItems
      .filter((item) => getTagKeys(item.tags).includes(key))
      .map((item) => item.slug)
      .sort();
    expect(expected.length).toBeGreaterThan(0);

    // 首屏筛选要等 index.json 返回后才生效，断言必须等状态落定：
    // 同步断言依赖微任务时序，在较慢的环境下会先于筛选完成而误报。
    await vi.waitFor(
      () => {
        expect(visibleSlugs().sort()).toEqual(expected);
        expect(tagButton(key)!.getAttribute('aria-pressed')).toBe('true');
      },
      { timeout: 3000 }
    );
  });

  // dialog 没有筛选搜索框；标题与标签胶囊之间是逻辑预览长胶囊，`+` / `/` 开关在其右侧。
  it.each(PAGES)('$name：标签 dialog 没有筛选搜索框，+// 挂在预览长胶囊右边', async (page) => {
    await loadPage(page);
    await importEntrySearch();

    // 搜索框（连同它的工具栏）不存在
    expect(document.querySelector('[data-entry-tag-filter]')).toBeNull();
    expect(document.querySelector('dialog .entry-tags-dialog__toolbar')).toBeNull();

    // 标题行只剩「清除筛选 + 关闭」
    const actions = document.querySelector('.entry-tags-dialog__head .entry-tags-dialog__actions');
    expect(actions, '动作区应当在标题行里').not.toBeNull();
    expect(Array.from(actions!.children).map((el) => el.className)).toEqual([
      'entry-tags-dialog__clear',
      'entry-tags-dialog__close'
    ]);

    // 预览行：长胶囊在左、`+` `/` 在右，且初始是空态提示
    const row = document.querySelector('.entry-tags-dialog__expression-row');
    expect(row, '需要一行逻辑预览').not.toBeNull();
    expect(Array.from(row!.children).map((el) => el.className)).toEqual([
      'entry-tags-dialog__expression',
      'entry-tags-dialog__mode'
    ]);
    const expression = row!.querySelector<HTMLElement>('[data-entry-tag-expression]')!;
    const mode = row!.querySelector<HTMLElement>('.entry-tags-dialog__mode')!;
    expect(expression.dataset.empty).toBe('true');
    expect(expression.textContent?.trim()).not.toBe('');
    expect(mode.textContent?.replace(/\s+/g, '')).toBe('+/');
    expect(
      expression.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING,
      '`+` `/` 应当在长胶囊右边'
    ).toBeTruthy();
  });

  // 切换 `+` / `/` 后已选部分被 `()` 括起，后续标签进入新的一段，筛选按复合逻辑收敛。
  it('bits：切换 +// 会把已选部分括起来，且筛选按复合逻辑收敛', async () => {
    const { indexItems } = await loadPage(PAGES[0]);
    await importEntrySearch();

    const keys = tagButtons().map((el) => (el.dataset.entryTagKey ?? '').trim());
    expect(keys.length, 'bits 需要至少三个标签').toBeGreaterThanOrEqual(3);
    const [first, second, third] = keys as [string, string, string];

    const expression = () => document.querySelector<HTMLElement>('[data-entry-tag-expression]')!;
    const clickOption = (key: string) =>
      tagButton(key)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    clickOption(first);
    clickOption(second);
    expect(expression().textContent).toContain('+');
    expect(expression().dataset.empty).toBe('false');

    // 切到 `/`：预览变成 `( #first + #second ) /`
    const orButton = document.querySelector<HTMLElement>('[data-entry-tag-mode="or"]')!;
    orButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(orButton.getAttribute('aria-pressed')).toBe('true');
    expect(expression().textContent?.replace(/\s+/g, '')).toContain(')/');
    // 预览里能读到括号与两个运算符：`( #first + #second ) /`
    expect(expression().querySelectorAll('.entry-tags-dialog__expression-paren').length).toBeGreaterThan(0);
    expect(
      Array.from(expression().querySelectorAll('.entry-tags-dialog__expression-op'))
        .map((el) => el.textContent)
        .join('')
    ).toBe('+/');

    // 再选第三个 → 进入新的 `/` 段：`( #first + #second ) / #third`
    clickOption(third);

    // 期望结果用独立公式算一遍，避免和实现同源：
    const keysOf = (slug: string) =>
      getTagKeys(indexItems.find((item) => item.slug === slug)!.tags);
    const expected = indexItems
      .filter((item) => {
        const itemKeys = keysOf(item.slug);
        return (itemKeys.includes(first) && itemKeys.includes(second)) || itemKeys.includes(third);
      })
      .map((item) => item.slug)
      .sort();

    await vi.waitFor(
      () => {
        expect(visibleSlugs().sort()).toEqual(expected);
      },
      { timeout: 3000 }
    );

    // URL 写入复合写法（`ops=`），不写 `mode=`
    expect(window.location.search).toContain('ops=');
    expect(window.location.search).not.toContain('mode=');
  });

  it('blog：翻页走列表整块过渡，动画结束后才落下一页', async () => {
    await loadPage(PAGES[1]);
    // 分页测试不依赖演示内容的条数：按当前页条目数拆成两页。
    const totalItems = document.querySelectorAll('[data-entry-item]').length;
    const pageSize = Math.max(1, Math.ceil(totalItems / 2));
    document.querySelector<HTMLElement>('[data-entry-filters]')!.dataset.pageSize = String(pageSize);
    await importEntrySearch();

    const inner = document.querySelector<HTMLElement>('[data-entry-pagination-inner]');
    expect(inner).not.toBeNull();
    const next = inner!.querySelectorAll<HTMLButtonElement>('.pagination__link')[1];
    expect(next).toBeDefined();

    // 初始渲染时还没有 WAAPI，逐条淡入淡出走同步分支；替换 animate 只影响翻页。
    const animations: {
      duration: number;
      finished: Promise<void>;
      resolve: () => void;
      cancel: () => void;
      canceled: boolean;
    }[] = [];
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: (keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
        let resolveFinished = () => {};
        const finished = new Promise<void>((resolve) => {
          resolveFinished = resolve;
        });
        const record = {
          keyframes,
          duration: Number(options.duration ?? 0),
          finished,
          canceled: false,
          resolve: resolveFinished,
          cancel: () => {
            record.canceled = true;
          }
        };
        animations.push(record);
        return record as unknown as Animation;
      }
    });

    try {
      next!.click();

      expect(animations).toHaveLength(1);
      expect(animations[0]!.duration).toBe(110);
      expect(inner!.textContent).toContain('1 / 2');

      animations[0]!.resolve();
      await vi.waitFor(() => {
        expect(inner!.textContent).toContain('2 / 2');
      });

      expect(animations).toHaveLength(2);
      expect(animations[1]!.duration).toBe(180);
    } finally {
      delete (Element.prototype as { animate?: unknown }).animate;
    }
  });
});
