// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturePageLoader } from './fixture-page';

/**
 * 宽屏目录「收起」的动画窗口契约。
 *
 * 收起方向的观感由两件事决定：
 * 1. 点击当帧不能发生离散跳变——`position: fixed`、`width: auto`、表头补偿都必须推迟到
 *    列宽过渡结束（`data-toc-rail-anim` 撤掉）之后，动画期间 nav 留在第 4 列里；
 * 2. 淡出必须是展开淡入的时间反演（时长相等、延迟归零），不能把展开的参数照抄过来。
 *
 * 这里守的是第 1 条与减弱动效；第 2 条在 article-toc-client.test.ts。
 * 注释一律先剥掉再匹配：`position: fixed`、`.article-toc__rail-body {` 这类字符串在说明性
 * 注释里也出现，直接对原文跑正则会把注释当成规则（本项目已因此写出过恒真断言）。
 */

const TOC_CSS = path.join('src', 'styles', 'components', 'article-toc.css');
const TOC_TS = path.join('src', 'scripts', 'article-toc.ts');
const REDUCED_MQ = '(prefers-reduced-motion: reduce)';

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

/** 剥掉注释：用等量换行占位，行首锚定（`^` + m）仍然有效。 */
const stripComments = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

/** 按书写顺序展开全部「选择器 + 声明块」，只用于剥过注释的 CSS。 */
const rules = (css: string) =>
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selector: (match[1] ?? '').trim().replace(/\s+/g, ' '),
    body: match[2] ?? ''
  }));

/** 取一段 `@media` 块的内容（按大括号配平，不用会跨块的惰性正则）。 */
const mediaBlock = (css: string, header: string) => {
  const start = css.indexOf(header);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }
  return '';
};

describe('宽屏目录收起：稳态规则只在动画窗口外生效', () => {
  it('只有一条把 nav 变成 fixed 的规则，且带动画窗口排除', async () => {
    const code = stripComments(await read(TOC_CSS));

    // 收起的 fixed 是稳态需求（把手跟随滚动常驻），但它是离散切换：
    // 点击当帧落下，nav 会立刻脱离第 4 列、按 width: auto 重新收缩，520ms 的列宽过渡对它失效。
    const fixedRules = rules(code).filter(
      (rule) => rule.selector.includes('.article-toc--rail') && /position:\s*fixed/.test(rule.body)
    );
    expect(fixedRules, '需要且只需要一条收起态的 fixed 规则').toHaveLength(1);
    expect(
      fixedRules[0]!.selector,
      'fixed 规则必须排除动画窗口，否则收起当帧就跳变'
    ).toContain(":not([data-toc-rail-anim='true'])");
    expect(fixedRules[0]!.body).toMatch(/top:\s*var\(--sidebar-padding-block\)/);
    expect(fixedRules[0]!.body).toMatch(/right:\s*calc\(var\(--rail-action-offset\)/);

    // 断点不能动：窄屏目录是内联形态，fixed 接管只在 1024px 以上成立
    const wide = mediaBlock(code, '@media (min-width: 1024px) {');
    expect(wide, '需要 1024px 断点块').not.toBe('');
    expect(wide).toMatch(
      /:not\(\[data-toc-rail-anim='true'\]\) body\.immersive-page \.article-toc--rail\s*\{[^}]*position:\s*fixed/
    );
  });

  it('表头补偿也在窗口外才撤掉，否则把手横跳一个 --page-inline', async () => {
    const code = stripComments(await read(TOC_CSS));

    // 动画期间 nav 仍是第 4 列里的 sticky 元素，把手位置靠表头的负右外边距 + 右内边距补偿；
    // 若在点击当帧就把补偿归零，把手先左跳 11px、560ms 后再跳回来。
    const collapsedHead = rules(code).filter(
      (rule) =>
        rule.selector.endsWith('.article-toc__rail-head')
        && /margin-right:\s*0/.test(rule.body)
        && /padding-right:\s*0/.test(rule.body)
    );
    expect(collapsedHead, '需要一条收起态表头补偿归零的规则').toHaveLength(1);
    expect(
      collapsedHead[0]!.selector,
      '表头补偿归零必须同样排除动画窗口'
    ).toContain(":not([data-toc-rail-anim='true'])");

    // 展开态与入场态的表头补偿不能被改掉（把手三个状态落在同一条竖线上）
    const base = rules(code).find((rule) => rule.selector === '.article-toc__rail-head');
    expect(base, '需要 .article-toc__rail-head 基础规则').toBeDefined();
    expect(base!.body).toMatch(/margin-right:\s*calc\(var\(--page-inline\) \* -1\)/);
    expect(base!.body).toMatch(/padding-right:\s*calc\(var\(--rail-action-offset\)/);
  });

  it('动画窗口不早于列宽过渡结束', async () => {
    const [css, script] = await Promise.all([read(TOC_CSS), read(TOC_TS)]);
    const code = stripComments(css);

    const windowMs = Number(/const TOC_RAIL_ANIM_MS = (\d+);/.exec(script)?.[1] ?? 0);
    const columnMs = Number(/grid-template-columns (\d+)ms/.exec(code)?.[1] ?? 0);

    expect(windowMs, '脚本里应有动画窗口常量').toBeGreaterThan(0);
    expect(columnMs, '列宽过渡时长').toBe(520);
    expect(
      windowMs,
      '窗口一旦短于列宽过渡，fixed 会在列宽还没收完时落下，收到一半的列当场跳变'
    ).toBeGreaterThanOrEqual(columnMs);
  });
});

describe('宽屏目录收起：减弱动效', () => {
  it('两个方向的淡入淡出都关掉，且用同形选择器压过收起规则', async () => {
    const code = stripComments(await read(TOC_CSS));
    const reduced = mediaBlock(code, '@media (prefers-reduced-motion: reduce) {');
    expect(reduced, '需要减弱动效块').not.toBe('');

    // 收起 / 入场规则的属性选择器抬高了特异性，只写裸类名压不住，淡入淡出会照跑
    expect(reduced).toContain(":root[data-toc-collapsed='true'] .article-toc__rail-body");
    expect(reduced).toContain(":root[data-toc-collapsed='true'] .article-toc__title");
    expect(reduced).toContain(":root[data-toc-intro='true'] .article-toc__rail-body");
    expect(reduced).toContain(":root[data-toc-intro='true'] .article-toc__title");
    expect(reduced).toMatch(/transition:\s*none/);
    // 展开方向同样要关掉（裸类名与属性选择器两条都要在）
    expect(reduced).toContain('.article-toc__rail-body');
    expect(reduced).toContain('.article-toc__title');
  });
});

describe('宽屏目录收起：动画窗口的客户端行为', () => {
  const loadPage = createFixturePageLoader('article-page.dev.html');

  const importToc = async () => {
    vi.resetModules();
    await import('../src/scripts/article-toc');
  };

  const clickToggle = () => {
    const button = document.querySelector<HTMLButtonElement>('[data-toc-toggle]');
    expect(button, 'fixture 里必须有 data-toc-toggle 的目录把手').not.toBeNull();
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  const rootData = () => document.documentElement.dataset;

  beforeEach(async () => {
    window.localStorage.clear();
    delete document.documentElement.dataset.tocCollapsed;
    delete document.documentElement.dataset.tocIntro;
    delete document.documentElement.dataset.tocRailAnim;
    window.history.replaceState(null, '', '/blog/sample-post/');
    vi.stubGlobal(
      'matchMedia',
      (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
      })
    );
    await loadPage();
    vi.useFakeTimers();
    await importToc();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    delete document.documentElement.dataset.tocCollapsed;
    delete document.documentElement.dataset.tocRailAnim;
  });

  it('收起：窗口从点击持续到列宽过渡结束，期间保持收起但尚未 fixed', () => {
    clickToggle();

    expect(rootData().tocCollapsed, '点击后进入收起态').toBe('true');
    expect(rootData().tocRailAnim, '收起同样需要动画窗口').toBe('true');

    vi.advanceTimersByTime(519);
    expect(
      rootData().tocRailAnim,
      '窗口不能早于 520ms 的列宽过渡关闭，否则 fixed 会在中途落下'
    ).toBe('true');
    expect(rootData().tocCollapsed, '窗口内仍是收起态').toBe('true');

    vi.advanceTimersByTime(41);
    expect(rootData().tocRailAnim, '窗口关闭后 fixed 才接管').toBeUndefined();
    expect(rootData().tocCollapsed, '窗口关闭不改变收起稳态').toBe('true');
  });

  it('展开：窗口同样覆盖整段列宽过渡', () => {
    clickToggle();
    vi.advanceTimersByTime(600);

    clickToggle();
    expect(rootData().tocCollapsed, '展开后不再是收起态').toBeUndefined();
    expect(rootData().tocRailAnim, '展开也需要动画窗口').toBe('true');

    vi.advanceTimersByTime(519);
    expect(rootData().tocRailAnim, '展开方向窗口同样不早于列宽过渡').toBe('true');

    vi.advanceTimersByTime(41);
    expect(rootData().tocRailAnim).toBeUndefined();
  });

  it('减弱动效下窗口照常开合，只是 CSS 里没有过渡可看', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === REDUCED_MQ,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }));

    clickToggle();
    expect(rootData().tocCollapsed).toBe('true');
    // fixed 的推迟与动效无关：窗口仍然开着，动画结束才切 fixed，
    // 这样减弱动效下也不会在点击当帧跳变（CSS 负责让这 560ms 里没有可看的过渡）。
    expect(rootData().tocRailAnim).toBe('true');

    vi.advanceTimersByTime(560);
    expect(rootData().tocRailAnim).toBeUndefined();
  });
});
