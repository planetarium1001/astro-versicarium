import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 静态契约：宽屏单行 / 窄屏两行的版本提示、紧凑图标入口、关闭动画与贴近文字的下划线。
 * 行为部分由 `article-version-drawer.test.ts` 覆盖，这里只守住结构、类名与样式不变量。
 */

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

const NOTICE = 'src/components/ArticleVersionNotice.astro';
const VERSION_CSS = 'src/styles/components/article-version.css';
const UI_ICON = 'src/components/UiIcon.astro';

const extractRule = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';
};

describe('ArticleVersionNotice：版本提示结构与文案', () => {
  it('使用 row + text 结构，eyebrow/message 两个段落已移除', async () => {
    const source = await read(NOTICE);

    expect(source).toContain('article-version-notice__row');
    expect(source).toContain('article-version-notice__text');
    expect(source).not.toContain('article-version-notice__eyebrow');
    expect(source).not.toContain('article-version-notice__message');
  });

  it('不再渲染状态圆点：引用框的左边框与底色已足够标识状态', async () => {
    const [source, css] = await Promise.all([read(NOTICE), read(VERSION_CSS)]);

    expect(source).not.toContain('article-version-notice__mark');
    // 样式也一并删除，避免留下只靠 display:none 隐藏的死规则
    expect(css).not.toContain('article-version-notice__mark');
  });

  it('保留状态、版本号、日期、提示与「查看最新版」链接', async () => {
    const source = await read(NOTICE);

    expect(source).toContain("'当前版本' : '历史版本'");
    expect(source).toContain('{currentVersion.versionLabel}');
    expect(source).toContain('{currentVersion.date}');
    expect(source).toContain('这是本系列的最新内容。');
    expect(source).toContain('该版本已归档，部分内容可能过时。');
    expect(source).toContain('article-version-notice__latest');
    expect(source).toContain('查看最新版');
    const latest = /<a\b[^>]*class="article-version-notice__latest"[\s\S]*?<\/a>/.exec(source)?.[0] ?? '';
    expect(latest, '需要「查看最新版」链接').not.toBe('');
    // 只保留文字：箭头图标已删除，窄屏版本历史入口的 chevron-up 不受影响
    expect(latest).not.toContain('<UiIcon');
    expect(source).toContain('article-version-notice__note');
  });

  it('说明行包在 __note-row 内：窄屏可整行铺满，链接换行时不被挤成孤行', async () => {
    const source = await read(NOTICE);
    const noteRow =
      /<span class="article-version-notice__note-row">([\s\S]*?)<\/span>\s*<\/p>/.exec(source)?.[1] ?? '';

    expect(noteRow, '需要 __note-row 包裹说明与链接').not.toBe('');
    expect(noteRow).toContain('article-version-notice__note');
    expect(noteRow).toContain('article-version-notice__latest');
    expect(noteRow.indexOf('article-version-notice__note')).toBeLessThan(
      noteRow.indexOf('article-version-notice__latest')
    );
    // 状态与版本元信息仍在说明行之前，顺序保持「元信息 → 说明 → 入口」
    expect(source.indexOf('article-version-notice__meta')).toBeLessThan(
      source.indexOf('article-version-notice__note-row')
    );
  });

  it('入口是「版本历史」文字 + 图标按钮：文字与图标同一个按钮，双图标由 CSS 切换', async () => {
    const source = await read(NOTICE);
    const trigger = /<button\b[^>]*class="article-version-trigger"[\s\S]*?<\/button>/.exec(source)?.[0] ?? '';

    expect(trigger, '组件里应有 .article-version-trigger 按钮').not.toBe('');
    expect(trigger).toContain('aria-label={`打开版本历史（${versionCount}）`}');
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).toContain('aria-controls={drawerId}');
    expect(trigger).toContain('article-version-trigger__icon--wide');
    expect(trigger).toContain('article-version-trigger__icon--narrow');
    expect(trigger).toContain('<UiIcon name="chevron-left"');
    expect(trigger).toContain('<UiIcon name="chevron-up"');
    expect(trigger).not.toContain('panel-right-open');
    // 文字说明与图标同属一个按钮；文字在图标左侧，点击文字也会冒泡到按钮。
    expect(trigger).toContain('article-version-trigger__label');
    expect(trigger).toContain('版本历史</span>');
    expect(trigger.indexOf('article-version-trigger__label')).toBeLessThan(
      trigger.indexOf('article-version-trigger__icon--wide')
    );
    expect(trigger.indexOf('article-version-trigger__label')).toBeLessThan(
      trigger.indexOf('article-version-trigger__icon--narrow')
    );
  });

  it('UiIcon 注册 chevron-left', async () => {
    const source = await read(UI_ICON);

    expect(source).toContain("import ChevronLeft from '@lucide/astro/icons/chevron-left'");
    expect(source).toMatch(/\|\s*'chevron-left'/);
    expect(source).toContain("'chevron-left': ChevronLeft");
  });
});

describe('article-version.css：宽屏单行排版与紧凑入口', () => {
  it('row 左右分栏、文字行允许换行，按钮固定在最右', async () => {
    const css = await read(VERSION_CSS);
    const row = extractRule(css, '.article-version-notice__row');
    const text = extractRule(css, '.article-version-notice__text');

    expect(row).toMatch(/display:\s*flex/);
    expect(row).toMatch(/align-items:\s*flex-start/);
    expect(row).toMatch(/justify-content:\s*space-between/);
    expect(row).toMatch(/gap:\s*12px/);

    expect(text).toMatch(/display:\s*flex/);
    expect(text).toMatch(/flex-wrap:\s*wrap/);
    expect(text).toMatch(/align-items:\s*baseline/);
    expect(text).toMatch(/min-width:\s*0/);

    const note = extractRule(css, '.article-version-notice__note');
    expect(text).toMatch(/color:\s*var\(--text\)/);
    expect(note).toMatch(/color:\s*var\(--muted\)/);
  });

  it('触发器是文字 + 图标的紧凑按钮：最小高度 30px、无 width:100%、无 border-top 分隔线', async () => {
    const css = await read(VERSION_CSS);
    const trigger = extractRule(css, '.article-version-trigger');

    expect(trigger).toMatch(/display:\s*inline-flex/);
    expect(trigger).toMatch(/min-height:\s*30px/);
    expect(trigger).toMatch(/padding:\s*0 8px/);
    expect(trigger).toMatch(/border:\s*0/);
    expect(trigger).toMatch(/font-size:\s*13px/);
    expect(css).toMatch(/\.article-version-trigger__label\s*\{[^}]*color:\s*inherit/);
    // 30px 视觉高度 + ::before 上下各 7px = 44px 触控热区。
    expect(css).toMatch(/\.article-version-trigger::before\s*\{[^}]*inset:\s*-7px -6px/);
    expect(trigger).not.toMatch(/width:\s*100%/);
    expect(trigger).not.toMatch(/border-top/);
  });

  it('宽屏显示 chevron-left、窄屏显示 chevron-up，切换只用 CSS media query', async () => {
    const css = await read(VERSION_CSS);

    expect(css).toMatch(/\.article-version-trigger__icon--narrow\s*\{[^}]*display:\s*none/);

    const narrow = css.slice(css.indexOf('@media (max-width: 700px)'));
    expect(narrow).toMatch(/\.article-version-trigger__icon--wide\s*\{[^}]*display:\s*none/);
    expect(narrow).toMatch(/\.article-version-trigger__icon--narrow\s*\{[^}]*display:\s*inline-flex/);
  });

  /**
   * 窄屏两行的源码契约：jsdom 不做布局，行数只能靠结构约束守住。
   * 第一行「元信息 + 入口」，第二行「说明 + 查看最新版」，两行右缘都贴内容右缘。
   */
  it('窄屏（≤700）排成两行网格：元信息与入口同行，说明行跨两列', async () => {
    const css = await read(VERSION_CSS);
    const narrow = css.slice(css.indexOf('@media (max-width: 700px) {\n  .article-version-notice {'));

    expect(narrow, '需要窄屏排版断点').not.toBe('');

    // 两列：文本列可压缩、入口列按内容宽度收在右侧
    expect(narrow).toMatch(
      /\.article-version-notice__row\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/
    );
    // 三个文本片段直接参与外层网格，避免再包一层容器
    expect(narrow).toMatch(/\.article-version-notice__text\s*\{[^}]*display:\s*contents/);
    expect(narrow).toMatch(/\.article-version-notice__meta\s*\{[^}]*grid-area:\s*1 \/ 1/);
    // 说明行跨两列 → 「查看最新版」与说明同处第二行，右缘贴齐
    expect(narrow).toMatch(/\.article-version-notice__note-row\s*\{[^}]*grid-area:\s*2 \/ 1 \/ 3 \/ 3/);
    expect(narrow).toMatch(/\.article-version-notice__latest\s*\{[^}]*margin-left:\s*auto/);
    expect(narrow).toMatch(/\.article-version-trigger\s*\{[^}]*grid-area:\s*1 \/ 2[^}]*justify-self:\s*end/);
    // 说明与链接同号 13px，两行才有宽度余量
    expect(narrow).toMatch(/\.article-version-notice__note\s*\{[^}]*font-size:\s*13px/);
    expect(narrow).toMatch(/\.article-version-notice__latest\s*\{[^}]*font-size:\s*13px/);
  });

  it('≤359 入口退化为纯图标，热区由 ::before 撑到 44px', async () => {
    const css = await read(VERSION_CSS);
    const block = /@media \(max-width: 359px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';

    expect(block).not.toBe('');
    expect(block).toMatch(/\.article-version-trigger__label\s*\{[^}]*display:\s*none/);
    // 视觉 32px 宽 + ::before 左右各 6px = 44px 触控热区
    expect(block).toMatch(/\.article-version-trigger\s*\{[^}]*min-width:\s*32px/);
  });

  /**
   * 说明行 13px 的可用下限实测是 340：339 差几像素，「查看最新版」会换到第三行；
   * 降到 12px 后 320 起也能两行。阈值必须覆盖 339 且不含 340，否则 340 会白白缩小字号。
   */
  it('说明行 12px 断点覆盖 339 而不影响 340', async () => {
    const css = await read(VERSION_CSS);
    const match = /@media \(max-width: ([\d.]+)px\) \{([\s\S]*?)\n\}/.exec(
      css.slice(css.indexOf('@media (max-width: 339'))
    );

    expect(match, '需要说明行 12px 的窄屏断点').not.toBeNull();
    const [, threshold, block] = match!;
    const width = Number(threshold);

    expect(width, '339 必须生效').toBeGreaterThanOrEqual(339);
    expect(width, '340 必须保持 13px').toBeLessThan(340);
    expect(block).toMatch(/\.article-version-notice__note,[\s\S]*?font-size:\s*12px/);
    expect(block).toMatch(/\.article-version-notice__latest[\s\S]*?font-size:\s*12px/);
    // 340 起回到 13px：窄屏主断点里仍是 13px，不能被 12px 规则覆盖
    const narrow = css.slice(css.indexOf('@media (max-width: 700px) {\n  .article-version-notice {'));
    expect(narrow).toMatch(/\.article-version-notice__note\s*\{[^}]*font-size:\s*13px/);
  });

  it('焦点环只作用于按钮本身，并保留 pointer-focus 去环规则', async () => {
    const css = await read(VERSION_CSS);

    expect(css).toMatch(
      /\.article-version-trigger:focus-visible,\s*\.version-drawer__close:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/
    );
    expect(css).not.toMatch(/\.article-version-notice:focus-visible/);
    expect(css).toMatch(/\.article-version-trigger\[data-pointer-focus\]:focus[^{]*\{[^}]*outline:\s*none/);
  });
});

describe('article-version.css：关闭动画与 reduced-motion', () => {
  it('进入/退出动画展开/收起同为 450ms，并由 data-closing 触发退出', async () => {
    const css = await read(VERSION_CSS);

    expect(css).toMatch(
      /animation:\s*version-drawer-in 450ms cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/
    );
    expect(css).toMatch(/@keyframes\s+version-drawer-out\s*\{/);
    expect(css).toMatch(
      /\.version-drawer\[data-closing='true'\]\s+\.version-drawer__panel\s*\{[^}]*animation:\s*version-drawer-out 450ms/
    );
  });

  it('窄屏退出动画改走 bottom 变体', async () => {
    const css = await read(VERSION_CSS);

    expect(css).toMatch(/@keyframes\s+version-drawer-out-bottom\s*\{/);
    expect(css).toMatch(
      /\.version-drawer\[data-closing='true'\]\s+\.version-drawer__panel\s*\{[^}]*animation-name:\s*version-drawer-out-bottom/
    );
  });

  it('prefers-reduced-motion 下面板动画与背景过渡都禁用', async () => {
    const css = await read(VERSION_CSS);

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.version-drawer::backdrop\s*\{[^}]*transition:\s*none/
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.version-drawer__panel,[\s\S]*?animation:\s*none/
    );
  });
});

describe('article-version.css：当前版本下划线贴近文字', () => {
  it('当前版本使用 text-decoration 2px + offset 2px，不再用 border-bottom', async () => {
    const css = await read(VERSION_CSS);
    const current =
      /\.version-item\.is-current \.version-item__label\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(current).not.toBe('');
    expect(current).toMatch(/text-decoration:\s*underline/);
    expect(current).toMatch(/text-decoration-thickness:\s*2px/);
    expect(current).toMatch(/text-underline-offset:\s*2px/);
    expect(css).not.toMatch(/border-bottom:\s*2px solid var\(--accent\)/);
  });
});
