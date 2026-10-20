import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 触屏 hover 残留的源码契约：jsdom 不做布局、也不匹配 `:hover`，端到端用例断言不了
 * 「点按后悬停视觉是否会一直粘住」。真实触屏设备可能把指针上报成 `hover: hover`，
 * 光靠媒体查询挡不住，因此公开页面的悬停视觉必须同时满足两个条件：
 * 位于 `@media (hover: hover)` 内，且选择器带 `:root:not([data-input="touch"])` 门禁；
 * 键盘焦点环与真实状态（`:focus-visible`、`aria-pressed` 等）不得一起被门禁。
 *
 * 后半部分的通用扫描是防漏项的关键：逐个列出选择器只能守住已知位置，
 * 新增一条公开 hover 时不会有人记得回来补清单，所以这里对公开样式文件做全量检查。
 */

const SRC = process.cwd();
const read = (relative: string) => readFile(path.join(SRC, relative), 'utf8');

const HOVER_PRELUDE = /@media \(hover: hover\)[^{]*/;
const TOUCH_GATE = ':root:not([data-input="touch"])';
const DARK_TOUCH_GATE = ':root[data-theme="dark"]:not([data-input="touch"])';
const TOUCH_RESET = ':root[data-input="touch"]';

/** 取媒体查询块体；prelude 允许匹配带附加条件的查询（例如 and (pointer: fine)）。 */
const collectBlocks = (css: string, prelude: RegExp): string[] => {
  const blocks: string[] = [];
  const flags = prelude.flags.includes('g') ? prelude.flags : `${prelude.flags}g`;
  const matcher = new RegExp(prelude.source, flags);
  let match = matcher.exec(css);
  while (match) {
    const open = css.indexOf('{', match.index + match[0].length - 1);
    if (open === -1) break;
    let depth = 0;
    let closed = false;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(css.slice(open + 1, index));
          matcher.lastIndex = index + 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
    match = matcher.exec(css);
  }
  return blocks;
};

type CssRule = { selectors: string; body: string };

const parseRules = (css: string): CssRule[] => {
  const rules: CssRule[] = [];
  const matcher = /([^{}]+)\{([^{}]*)\}/g;
  let match = matcher.exec(css);
  while (match) {
    rules.push({ selectors: (match[1] ?? '').trim(), body: match[2] ?? '' });
    match = matcher.exec(css);
  }
  return rules;
};

/** 按逗号拆分选择器列表；括号内的逗号（`:is(...)`、`:not(...)`）不拆。 */
const splitSelectorList = (selectors: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selectors.length; index += 1) {
    const char = selectors[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(selectors.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(selectors.slice(start).trim());
  return parts.filter(Boolean);
};

/** 注释正文里也会出现 `:hover`，不先去掉会误判成悬停规则。 */
const stripCssComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** 把匹配 prelude 的整块替换为等长空白，块内规则不参与扫描（例如 `@media (hover: none)` 兜底）。 */
const stripBlocks = (css: string, prelude: RegExp): string => {
  const ranges: Array<[number, number]> = [];
  const flags = prelude.flags.includes('g') ? prelude.flags : `${prelude.flags}g`;
  const matcher = new RegExp(prelude.source, flags);
  let match = matcher.exec(css);
  while (match) {
    const open = css.indexOf('{', match.index + match[0].length - 1);
    if (open === -1) break;
    let depth = 0;
    let end = -1;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end === -1) break;
    ranges.push([match.index, end]);
    matcher.lastIndex = end + 1;
    match = matcher.exec(css);
  }
  if (!ranges.length) return css;

  let result = '';
  let cursor = 0;
  for (const [start, end] of ranges) {
    result += css.slice(cursor, start);
    result += ' '.repeat(end - start + 1);
    cursor = end + 1;
  }
  return result + css.slice(cursor);
};

type SelectorMatcher = string | RegExp;

const selectorMatches = (selectors: string, matcher: SelectorMatcher) =>
  typeof matcher === 'string' ? selectors.includes(matcher) : matcher.test(selectors);

const hoverBlocks = (css: string) => collectBlocks(css, HOVER_PRELUDE);

/** 在 `@media (hover: hover)` 块内找带输入模态门禁的悬停规则。 */
const findGatedHoverRule = (
  css: string,
  selector: SelectorMatcher,
  gate: string = TOUCH_GATE
): CssRule | null => {
  for (const block of hoverBlocks(css)) {
    for (const rule of parseRules(block)) {
      if (rule.selectors.includes(gate) && selectorMatches(rule.selectors, selector)) return rule;
    }
  }
  return null;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 裸悬停规则（行首选择器、不带门禁前缀）不该再出现。 */
const hasUngatedHoverRule = (css: string, selector: string) =>
  new RegExp(`(?:^|\\n)[ \\t]*${escapeRegExp(selector)}(?:,|\\s*\\{)`).test(css);

/** 后台页面作用域的规则不在公开页面验证范围内（layout.css 的 admin rail / nav 等）。 */
const isAdminScopedSelector = (selector: string) => selector.includes('body.admin-page');

type HoverContract = {
  file: string;
  /** 选择器片段；个别被 `:where(...)` 包住的场景用正则。 */
  selector: SelectorMatcher;
  declaration: string;
  gate?: string;
};

const HOVER_CONTRACTS: HoverContract[] = [
  // 全局默认文本链接与弹窗关闭按钮：触屏点按后 hover 会粘住，
  // 导航链接会在 44px 盒底留下比文字更长、更远的下划线。
  {
    file: 'src/styles/global.css',
    selector: /a:where\(:not\(\[class\]\)\):hover/,
    declaration: 'border-bottom-color: currentColor'
  },
  {
    file: 'src/styles/global.css',
    selector: /\.content__inner[\s\S]*?a:where\(:not\(\[class\]\)\):hover/,
    declaration: 'border-bottom-style: solid'
  },
  {
    file: 'src/styles/global.css',
    selector: /\[data-dialog-close\]:hover/,
    declaration: 'color: var(--text)'
  },
  // 项目卡片：整卡悬停背景 + 文字链接
  {
    file: 'src/styles/projects-page.css',
    selector: '.project-card:hover',
    declaration: 'background: var(--code-header-bg)'
  },
  {
    file: 'src/styles/projects-page.css',
    selector: '.project-version-notice__latest:hover',
    declaration: 'text-decoration: underline'
  },
  {
    file: 'src/styles/projects-page.css',
    selector: '.project-version__main:hover',
    declaration: 'text-decoration: underline'
  },
  {
    file: 'src/styles/projects-page.css',
    selector: '.project-updates__list a:hover',
    declaration: 'color: var(--accent)'
  },
  // 列表卡与列表内的可点元素
  {
    file: 'src/styles/components/lists.css',
    selector: '.list-item--link:hover',
    declaration: 'background: var(--code-header-bg)'
  },
  {
    file: 'src/styles/components/lists.css',
    selector: '.list-item__title:hover',
    declaration: 'color: var(--accent)'
  },
  {
    file: 'src/styles/components/lists.css',
    selector: '.entry-search-toggle:hover',
    declaration: 'color: var(--text)'
  },
  {
    file: 'src/styles/components/lists.css',
    selector: 'a.tag:hover',
    declaration: 'text-decoration: underline'
  },
  {
    file: 'src/styles/components/lists.css',
    selector: '.pagination__link:hover',
    declaration: 'background: transparent'
  },
  // 首页导语标签：下划线只给鼠标
  {
    file: 'src/styles/home.css',
    selector: '.intro__tag-link:hover',
    declaration: 'border-bottom-color: currentColor'
  },
  // about：友链卡与复制按钮（含暗色变体）
  {
    file: 'src/styles/about.css',
    selector: '.friend-card:hover',
    declaration: 'background: #f7f7f5'
  },
  {
    file: 'src/styles/about.css',
    selector: '.friend-card:hover',
    declaration: 'background: #252525',
    gate: DARK_TOUCH_GATE
  },
  {
    file: 'src/styles/about.css',
    selector: '.about-site-info__copy:hover:not(:disabled)',
    declaration: 'background: #f7f7f5'
  },
  {
    file: 'src/styles/about.css',
    selector: '.about-site-info__copy:hover:not(:disabled)',
    declaration: 'background: #252525',
    gate: DARK_TOUCH_GATE
  },
  // devlog：标题下划线与操作文字
  {
    file: 'src/styles/devlog-page.css',
    selector: '.devlog-row__toggle:hover .devlog-row__title',
    declaration: 'text-decoration: underline'
  },
  {
    file: 'src/styles/devlog-page.css',
    selector: '.devlog-row__toggle:hover .devlog-row__action',
    declaration: 'color: var(--muted)'
  },
  // archive：标题与「项目名: 」前缀
  {
    file: 'src/styles/archive-page.css',
    selector: '.archive-timeline__entry:hover .entry-title__title',
    declaration: 'color: var(--accent)'
  },
  {
    file: 'src/styles/archive-page.css',
    selector: '.archive-timeline__entry:hover .entry-title__project',
    declaration: 'color: var(--accent)'
  },
  {
    file: 'src/styles/archive-page.css',
    selector: '.archive-timeline__entry:hover .entry-title__colon',
    declaration: 'color: var(--accent)'
  },
  // bits 搜索结果卡
  {
    file: 'src/styles/components/bits.css',
    selector: '.bit-search-result__link:hover',
    declaration: 'background: color-mix'
  },
  // bits 卡片：图片「+N」遮罩与标签链接
  {
    file: 'src/styles/components/bit-card.css',
    selector: '.bit-media-item--more:hover .bit-media-more',
    declaration: 'background: var(--overlay-70)'
  },
  {
    file: 'src/styles/components/bit-card.css',
    selector: '.bit-media-item--more:hover::after',
    declaration: 'opacity: 1'
  },
  {
    file: 'src/styles/components/bit-card.css',
    selector: '.bit-media-item--more:hover > img',
    declaration: 'transform: scale(1.02)'
  },
  {
    file: 'src/styles/components/bit-card.css',
    selector: '.bit-media-item--more:hover .bit-media-more-short',
    declaration: 'opacity: 0'
  },
  {
    file: 'src/styles/components/bit-card.css',
    selector: '.bit-media-item--more:hover .bit-media-more-full',
    declaration: 'opacity: 1'
  },
  {
    file: 'src/styles/components/bit-card.css',
    selector: '.bit-tag-token.tag--link:hover',
    declaration: 'text-decoration: underline'
  },
  {
    file: 'src/styles/components/bit-card.css',
    selector: 'a.bit-tag.tag--link:hover',
    declaration: 'text-decoration: underline'
  },
  // 文章版本入口与抽屉
  {
    file: 'src/styles/components/article-version.css',
    selector: '.article-version-notice__latest:hover',
    declaration: 'text-decoration: underline'
  },
  {
    file: 'src/styles/components/article-version.css',
    selector: '.article-version-trigger:hover',
    declaration: 'background: color-mix'
  },
  {
    file: 'src/styles/components/article-version.css',
    selector: '.version-item__main:hover',
    declaration: 'text-decoration: underline'
  },
  // 文章目录
  {
    file: 'src/styles/components/article-toc.css',
    selector: '.article-toc__link:hover',
    declaration: 'color: var(--text)'
  },
  {
    file: 'src/styles/components/article-toc.css',
    selector: '.article-toc__toggle:hover',
    declaration: 'border-color: var(--muted)'
  },
  // 代码复制与语言图标
  {
    file: 'src/styles/components/code-block.css',
    selector: '.code-copy:hover:not(:disabled)',
    declaration: 'background: var(--code-action-hover-bg)'
  },
  {
    file: 'src/styles/components/code-block.css',
    selector: '.code-toolbar:hover .code-lang-icon:not(.is-colored)',
    declaration: 'opacity: 1'
  },
  // 胶囊、末尾链接、灯箱
  {
    file: 'src/styles/components/scope-pills.css',
    selector: '.scope-pills__item:hover',
    declaration: 'color: var(--text)'
  },
  {
    file: 'src/styles/components/trailing-links.css',
    selector: '.trailing-links a:hover',
    declaration: 'text-decoration: underline'
  },
  {
    file: 'src/styles/components/lightbox.css',
    selector: '.lightbox-nav:hover:not([disabled])',
    declaration: 'transform: scale(1.04)'
  },
  {
    file: 'src/styles/components/lightbox.css',
    selector: '.prose img[data-lightbox]:hover',
    declaration: 'opacity: 0.92'
  },
  // 标签筛选与标签选择器（目标选择器可能被 :where() 包住，允许 hover 与 __count 之间夹右括号）
  {
    file: 'src/styles/components/entry-tags.css',
    selector: '.entry-tag-chip__label:hover',
    declaration: 'color: var(--accent)'
  },
  {
    file: 'src/styles/components/entry-tags.css',
    selector: '.entry-tag-chip__remove:hover',
    declaration: 'color: var(--text)'
  },
  {
    file: 'src/styles/components/entry-tags.css',
    selector: '.entry-tag-op:hover',
    declaration: 'color: var(--text)'
  },
  {
    file: 'src/styles/components/entry-tags.css',
    selector: '.entry-tags-dialog__clear:hover',
    declaration: 'background: var(--code-content-bg)'
  },
  {
    file: 'src/styles/components/entry-tags.css',
    selector: '.entry-tag-option:hover',
    declaration: 'transform: translateY(-1px)'
  },
  {
    file: 'src/styles/components/entry-tags.css',
    selector: /\.entry-tag-option:hover[^,{]*\.entry-tag-option__count/,
    declaration: 'background: var(--panel)'
  }
];

const FILES = Array.from(new Set(HOVER_CONTRACTS.map((contract) => contract.file)));

/** 公开样式文件清单：本任务涉及的组件样式 + 公共布局样式。后台样式不在范围内。 */
const PUBLIC_STYLE_FILES = Array.from(
  new Set([...FILES, 'src/styles/components/layout.css'])
);

/**
 * 扫描公开样式里所有 `:hover` 选择器，返回没有门禁、也没有等效触屏复位的裸规则。
 *
 * 允许的例外（与门禁范式等价或已被覆盖）：
 * - `:root:not([data-input="touch"])` / `:root[data-theme="dark"]:not(...)` 门禁；
 * - `:root[data-input="touch"]` 触屏复位规则本身，以及有同目标复位规则的裸悬停
 *   （例如 layout.css 的图标提示气泡：可见性由独立的 `:root[data-input="touch"]` 规则关掉）；
 * - `[disabled]:hover` 这类禁用态复位；
 * - `:is(:hover, :focus-visible)` 组合写法：键盘态并进同一条规则，不产生独立的粘滞视觉；
 * - `body.admin-page` 后台作用域的规则；
 * - `@media (hover: none)` 兜底块。
 * 公开页面里的普通 `:hover` 必须带门禁，否则触屏点按后会粘住。
 */
const collectUngatedHoverSelectors = (css: string): string[] => {
  const cleaned = stripBlocks(stripCssComments(css), /@media \(hover: none\)[^{]*/);
  const selectors = parseRules(cleaned).flatMap((rule) => splitSelectorList(rule.selectors));
  const resetMatcher = new RegExp(`${escapeRegExp(TOUCH_RESET)}\\s*`, 'g');
  const resetTargets = new Set(
    selectors
      .filter((selector) => selector.includes(TOUCH_RESET) && selector.includes(':hover'))
      .map((selector) => selector.replace(resetMatcher, '').trim())
  );

  const violations: string[] = [];
  for (const selector of selectors) {
    if (!selector.includes(':hover')) continue;
    if (isAdminScopedSelector(selector)) continue;
    if (selector.includes(TOUCH_RESET)) continue;
    if (selector.includes('[disabled]:hover')) continue;
    if (/:is\([^)]*\)/.test(selector) && selector.includes(':focus-visible')) continue;
    if (selector.includes(TOUCH_GATE) || selector.includes(DARK_TOUCH_GATE)) continue;
    if (resetTargets.has(selector)) continue;
    violations.push(selector);
  }
  return violations;
};

describe('公开页面悬停视觉：媒体查询 + 输入模态双门禁', () => {
  it.each(HOVER_CONTRACTS)('$file 的 $selector 只在非触屏输入下悬停', async (contract) => {
    const css = await read(contract.file);
    const rule = findGatedHoverRule(css, contract.selector, contract.gate);

    expect(rule, `需要 @media (hover: hover) 内带门禁的 ${String(contract.selector)}`).not.toBeNull();
    expect(rule?.body).toContain(contract.declaration);
    // 裸悬停规则会绕过门禁，必须不残留
    if (typeof contract.selector === 'string' && !contract.gate) {
      expect(hasUngatedHoverRule(css, contract.selector)).toBe(false);
    }
  });

  it.each(FILES)('%s 的悬停媒体块不门禁键盘 :focus-visible', async (file) => {
    const css = await read(file);
    const blocks = hoverBlocks(css);

    expect(blocks.length, `${file} 需要 @media (hover: hover) 块`).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block, `${file} 的悬停样式不能门禁键盘焦点`).not.toContain(':focus-visible');
      expect(block, `${file} 的悬停样式不能门禁键盘焦点`).not.toContain(':focus-within');
    }
  });

  it('键盘焦点态改用 :has(:focus-visible) 表达，不依赖 :focus-within', async () => {
    const [projects, lists] = await Promise.all([
      read('src/styles/projects-page.css'),
      read('src/styles/components/lists.css')
    ]);

    const card = parseRules(projects).find((rule) =>
      rule.selectors.includes('.project-card:has(:focus-visible)')
    );
    expect(card?.body).toContain('background: var(--code-header-bg)');
    expect(projects).not.toMatch(/\.project-card:focus-within/);

    const item = parseRules(lists).find((rule) =>
      rule.selectors.includes('.list-item--link:has(:focus-visible)')
    );
    expect(item?.body).toContain('background: var(--code-header-bg)');
    expect(lists).not.toMatch(/\.list-item--link:focus-within/);
    // 焦点环仍由专门的 :focus-visible 规则给出
    expect(lists).toMatch(/\.list-item--link:has\(\.list-item__stretch:focus-visible\)/);
  });

  it('代码块与图片的键盘焦点态保留，不被悬停门禁波及', async () => {
    const [code, card, version] = await Promise.all([
      read('src/styles/components/code-block.css'),
      read('src/styles/components/bit-card.css'),
      read('src/styles/components/article-version.css')
    ]);

    expect(code).toMatch(/\.code-copy:focus-visible\s*\{/);
    expect(card).toMatch(/\.bit-media-item:focus-visible\s*\{/);
    expect(version).toMatch(/\.article-version-trigger:focus-visible/);
    expect(version).toMatch(/\.article-version-trigger\[data-version-open='true'\]/);
  });

  it('标签选择器的真实状态（:focus-visible / .is-active / [aria-pressed]）在门禁之外', async () => {
    const css = await read('src/styles/components/entry-tags.css');

    for (const block of hoverBlocks(css)) {
      expect(block).not.toContain(':focus-visible');
      expect(block).not.toContain('.is-active');
      expect(block).not.toContain("[aria-pressed='true']");
    }
    expect(css).toMatch(/\.entry-tag-option:focus-visible\s*\{/);
    expect(css).toMatch(
      /\.entry-tag-option\.is-active,\s*\n\.entry-tag-option\[aria-pressed='true'\]/
    );
  });
});

describe('公开样式全量扫描：不留绕过输入模态的裸 :hover', () => {
  it.each(PUBLIC_STYLE_FILES)('%s 的每条 :hover 都有门禁或等效复位', async (file) => {
    const css = await read(file);
    expect(collectUngatedHoverSelectors(css), `${file} 存在未门禁的公开 :hover`).toEqual([]);
  });

  it('扫描器本身能识别裸 :hover、门禁与触屏复位（防止扫描静默失效）', () => {
    const bare = '.demo-card:hover { background: var(--bg); }';
    expect(collectUngatedHoverSelectors(bare)).toEqual(['.demo-card:hover']);

    const gated =
      '@media (hover: hover) { :root:not([data-input="touch"]) .demo-card:hover { background: var(--bg); } }';
    expect(collectUngatedHoverSelectors(gated)).toEqual([]);

    const reset =
      '.demo-card:hover { color: var(--text); }\n:root[data-input="touch"] .demo-card:hover { opacity: 0; }';
    expect(collectUngatedHoverSelectors(reset)).toEqual([]);

    // 注释里的 :hover、(hover: none) 兜底、组合键盘态与禁用态都不算违规
    const tolerated = [
      '/* 注释里的 :hover 不该被当成规则 */',
      '@media (hover: none) { .demo-card:hover { color: var(--muted); } }',
      '.demo-card:is(:hover, :focus-visible) { color: var(--text); }',
      '.demo-card[disabled]:hover { opacity: 1; }'
    ].join('\n');
    expect(collectUngatedHoverSelectors(tolerated)).toEqual([]);
  });
});
