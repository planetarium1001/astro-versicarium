import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 上一篇/下一篇与页面进入动画的布局契约：jsdom 不做布局，单元层只能读源码守住
 * 「无卡片、宽屏一行、窄屏两行、标题省略、44px 热区、reduced-motion 关闭」。
 */

const SRC = process.cwd();
const ARTICLE_LAYOUT = 'src/layouts/ArticleLayout.astro';
const LAYOUT_CSS = 'src/styles/components/layout.css';

const read = (relative: string) => readFile(path.join(SRC, relative), 'utf8');

const escapeSelector = (selector: string) => selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readBlock = (css: string, open: number): string => {
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }
  return '';
};

/** 取规则块内容；从选择器首次出现处向后找块首，按花括号配对收尾（支持多选择器换行）。 */
const readRule = (css: string, selector: string): string => {
  const match = new RegExp(escapeSelector(selector)).exec(css);
  if (!match) return '';
  const open = css.indexOf('{', match.index + selector.length);
  if (open < 0) return '';
  return readBlock(css, open);
};

const readAtRule = (css: string, header: string): string => {
  const index = css.indexOf(header);
  if (index < 0) return '';
  const open = css.indexOf('{', index + header.length);
  if (open < 0) return '';
  return readBlock(css, open);
};

describe('上一篇/下一篇：文字极简结构', () => {
  it('保留 nav 语义、rel 与左右顺序，不再渲染占位块', async () => {
    const layout = await read(ARTICLE_LAYOUT);

    expect(layout).toMatch(/<nav class="prev-next" aria-label="上一篇\/下一篇">/);
    expect(layout).toMatch(/<a class="prev-next__link" href=\{withBase\(prev\.href\)\} rel="prev">/);
    expect(layout).toMatch(/<a class="prev-next__link" href=\{withBase\(next\.href\)\} rel="next">/);

    // 上一篇：箭头在前、标签、标题；下一篇：标题、标签、箭头在后
    expect(layout).toMatch(
      /prev-next__arrow" aria-hidden="true">‹<\/span>\s*<span class="prev-next__label">上一篇<\/span>\s*<span class="prev-next__title">\{prev\.title\}<\/span>/
    );
    expect(layout).toMatch(
      /<span class="prev-next__title">\{next\.title\}<\/span>\s*<span class="prev-next__label">下一篇<\/span>\s*<span class="prev-next__arrow" aria-hidden="true">›<\/span>/
    );

    expect(layout).not.toContain('prev-next__placeholder');
    expect(layout).not.toMatch(/prev-next__link--/);
  });
});

describe('上一篇/下一篇：样式契约', () => {
  it('没有边框、圆角与背景，热区仍有 44px', async () => {
    const css = await read(LAYOUT_CSS);
    const link = readRule(css, '.prev-next__link');

    expect(link).toMatch(/border:\s*0/);
    expect(link).not.toMatch(/border-radius/);
    expect(link).not.toMatch(/(^|;|\s)background\s*:/);
    expect(link).toMatch(/min-height:\s*44px/);
    expect(link).toMatch(/display:\s*inline-flex/);
  });

  it('宽屏一行左右分布，窄屏 ≤700px 堆成两行', async () => {
    const css = await read(LAYOUT_CSS);
    const nav = readRule(css, '.prev-next');
    const item = readRule(css, '.prev-next__item');
    const next = readRule(css, '.prev-next__item--next');

    expect(nav).toMatch(/display:\s*flex/);
    expect(nav).toMatch(/justify-content:\s*space-between/);
    expect(nav).toMatch(/gap:\s*24px/);
    expect(item).toMatch(/min-width:\s*0/);
    expect(item).toMatch(/max-width:\s*48%/);
    expect(next).toMatch(/margin-left:\s*auto/);
    expect(next).toMatch(/text-align:\s*right/);

    const mobile = readAtRule(css, '@media (max-width: 700px)');
    expect(mobile, '需要 ≤700px 的上下篇布局覆盖').not.toBe('');
    expect(readRule(mobile, '.prev-next')).toMatch(/flex-direction:\s*column/);
    expect(readRule(mobile, '.prev-next')).toMatch(/gap:\s*10px/);
    expect(readRule(mobile, '.prev-next__item')).toMatch(/max-width:\s*100%/);
  });

  it('标题单行省略，hover / focus 用颜色与 2px 下划线', async () => {
    const css = await read(LAYOUT_CSS);
    const title = readRule(css, '.prev-next__title');

    expect(title).toMatch(/min-width:\s*0/);
    expect(title).toMatch(/overflow:\s*hidden/);
    expect(title).toMatch(/text-overflow:\s*ellipsis/);
    expect(title).toMatch(/white-space:\s*nowrap/);

    const hover = readRule(css, '.prev-next__link:hover .prev-next__title');
    expect(hover).toMatch(/color:\s*var\(--accent\)/);
    expect(hover).toMatch(/text-decoration:\s*underline/);
    expect(hover).toMatch(/text-underline-offset:\s*2px/);
    expect(css).toContain('.prev-next__link:focus-visible .prev-next__title');

    const focus = readRule(css, '.prev-next__link:focus-visible');
    expect(focus).toMatch(/outline:\s*var\(--focus-ring\)/);
    expect(focus).toMatch(/outline-offset:\s*var\(--focus-ring-offset\)/);
  });
});

describe('公开页进入动画', () => {
  it('仅 public 容器，260ms 淡入上移，减少动效时关闭', async () => {
    const css = await read(LAYOUT_CSS);
    const pageEnter = readAtRule(css, '@media (prefers-reduced-motion: no-preference)');

    expect(pageEnter, '页面进入动画应包在 no-preference 中').not.toBe('');
    expect(pageEnter).toContain('@keyframes page-enter');
    expect(pageEnter).toMatch(
      /animation:\s*page-enter\s+260ms\s+cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)\s+both/
    );

    expect(pageEnter).toMatch(/body:not\(\.admin-page\) \.list/);
    expect(pageEnter).toMatch(/body:not\(\.admin-page\) \.archive-timeline/);
    expect(pageEnter).toMatch(/body:not\(\.admin-page\) \.devlog-list/);
    expect(pageEnter).toMatch(/body\.article-page \.content__inner/);

    expect(pageEnter).toMatch(/from\s*\{[^}]*opacity:\s*0/);
    expect(pageEnter).toMatch(/to\s*\{[^}]*transform:\s*none/);
    // 不动尺寸 / 间距，避免进入时布局位移
    expect(pageEnter).not.toMatch(/\b(width|height|margin|padding|top|left)\s*:/);
    expect((css.match(/animation:\s*page-enter/g) ?? []).length, '只应有一处 page-enter 声明').toBe(1);
  });
});
