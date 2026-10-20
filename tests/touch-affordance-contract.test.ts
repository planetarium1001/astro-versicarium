import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 触屏可发现性的源码契约：jsdom 不做布局、也不匹配 `:hover`，端到端用例断言不了
 * 「提示显示在哪个方向」「气泡会不会伸出视口」「悬停视觉在哪种指针能力下生效」。
 * 这几条一旦回退，只会在真机上以「提示被裁 / 页面能左右平移 / 按钮像被选中」的形式复现。
 */

const SRC = process.cwd();
const read = (relative: string) => readFile(path.join(SRC, relative), 'utf8');

const LAYOUT_CSS = 'src/styles/components/layout.css';
const GLOBAL_CSS = 'src/styles/global.css';
const FLOATING_ACTIONS_TS = 'src/scripts/sidebar-floating-actions.ts';
const INPUT_MODALITY_TS = 'src/scripts/input-modality.ts';
const BASE_LAYOUT_ASTRO = 'src/layouts/BaseLayout.astro';

const TOOLTIP = String.raw`\.sidebar-actions \.icon-button\[data-tooltip\]`;
const PUBLIC_SCOPE = String.raw`:where\(body:not\(\.admin-page\)\)`;

/**
 * 取媒体查询的块体。prelude 传字符串按字面匹配，传正则可匹配带附加条件的查询
 * （例如 `@media (hover: hover) and (pointer: fine)`），同一查询可多次出现。
 */
const mediaBodies = (css: string, prelude: string | RegExp): string[] => {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    let start = -1;
    let open = -1;
    if (typeof prelude === 'string') {
      start = css.indexOf(`${prelude} {`, from);
      open = start === -1 ? -1 : start + prelude.length + 1;
    } else {
      const flags = prelude.flags.includes('g') ? prelude.flags : `${prelude.flags}g`;
      const matcher = new RegExp(prelude.source, flags);
      matcher.lastIndex = from;
      const match = matcher.exec(css);
      if (match) {
        start = match.index;
        const brace = css.indexOf('{', match.index + match[0].length - 1);
        open = brace === -1 ? -1 : brace;
      }
    }
    if (start === -1 || open === -1) break;
    let depth = 0;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.push(css.slice(open + 1, index));
          from = index;
          break;
        }
      }
    }
    if (from <= start) break;
  }
  return bodies;
};

/** 取某个选择器的规则体；选择器按正则匹配，允许前导空白。 */
const ruleBody = (css: string, selector: RegExp): string => {
  const match = new RegExp(`(?:^|\\n)[ \\t]*${selector.source}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  return match?.[1] ?? '';
};

const narrowTooltipRule = (css: string, pseudo: 'after' | 'before', hovered = false): string => {
  const state = hovered ? String.raw`:is\(:hover, :focus-visible\)` : '';
  const selector = new RegExp(
    `${PUBLIC_SCOPE} ${TOOLTIP}${state}::${pseudo}`
  );
  const bodies = mediaBodies(css, '@media (max-width: 900px)');
  for (const body of bodies) {
    const found = ruleBody(body, selector);
    if (found) return found;
  }
  return '';
};

describe('窄屏图标提示：宽屏在上、窄屏在下', () => {
  it('宽屏保持贴在按钮上方，箭头朝下', async () => {
    const layout = await read(LAYOUT_CSS);
    const after = ruleBody(layout, new RegExp(`${TOOLTIP}::after`));
    expect(after).toContain('bottom: calc(100% + 8px)');
    expect(after).not.toMatch(/(?:^|;)\s*top\s*:/);
    expect(ruleBody(layout, new RegExp(`${TOOLTIP}::before`))).toContain(
      'border-top-color: var(--panel)'
    );
  });

  it('窄屏把气泡翻到按钮下方，箭头同步翻转', async () => {
    const layout = await read(LAYOUT_CSS);
    const after = narrowTooltipRule(layout, 'after');
    expect(after, '窄屏必须有气泡覆盖规则').not.toBe('');
    expect(after).toContain('top: calc(100% + 8px)');
    expect(after).toMatch(/(?:^|;)\s*bottom:\s*auto/);

    const before = narrowTooltipRule(layout, 'before');
    expect(before, '窄屏必须有箭头覆盖规则').not.toBe('');
    expect(before).toContain('border-bottom-color: var(--panel)');
    expect(before).toContain('border-top-color: transparent');
    // 箭头仍锚在按钮中心，不能跟着气泡右对齐跑偏
    expect(before).toContain('left: 50%');
  });

  it('窄屏气泡右缘对齐按钮并限宽：长文案不再把页面撑宽', async () => {
    const layout = await read(LAYOUT_CSS);
    const after = narrowTooltipRule(layout, 'after');
    // 居中 + nowrap 会让气泡右半段越过视口；绝对定位盒子即使 opacity:0 也计入 scrollWidth
    expect(after).toMatch(/(?:^|;)\s*left:\s*auto/);
    expect(after).toMatch(/(?:^|;)\s*right:\s*0/);
    expect(after).toMatch(/max-width:\s*calc\(100vw/);
    expect(after).toContain('white-space: normal');
    // 入场位移只动纵向，不再做水平居中平移
    expect(after).toMatch(/transform:\s*translateY/);
    expect(narrowTooltipRule(layout, 'after', true)).toContain('transform: translateY(0)');
  });

  it('触屏（hover: none）仍整体隐藏悬停提示', async () => {
    const layout = await read(LAYOUT_CSS);
    const hidden = mediaBodies(layout, '@media (hover: none)').join('\n');
    expect(hidden).toContain('display: none');
    expect(hidden).toContain('[data-tooltip]::after');
    expect(hidden).toContain('[data-tooltip]::before');
    // 隐藏规则必须排在窄屏翻向之后，否则触屏会重新看到提示
    expect(layout.indexOf('@media (hover: none) {')).toBeGreaterThan(
      layout.indexOf('@media (max-width: 900px) {')
    );
  });

  it('后台竖向 rail 的既有覆盖不被窄屏规则波及', async () => {
    const layout = await read(LAYOUT_CSS);
    expect(layout).toMatch(
      /body\.admin-page \.sidebar-actions \.icon-button\[data-tooltip\]::after\s*\{[^}]*display: var\(--admin-sidebar-action-tooltip-display\)/
    );
    // 窄屏翻向全部收敛在公开站点作用域内，后台没有同款覆盖
    expect(layout).not.toMatch(
      new RegExp(`body\\.admin-page[^,{]*${TOOLTIP}::(?:after|before)\\s*\\{[^}]*top:\\s*calc\\(100% \\+ 8px\\)`)
    );
  });
});

describe('浮动列按钮：悬停视觉只在非触屏输入下生效', () => {
  it('`.float-stack__button:hover` 唯一、位于 @media (hover: hover) 内且受 data-input 约束', async () => {
    const layout = await read(LAYOUT_CSS);
    expect(layout.split('.float-stack__button:hover').length - 1, '只允许一处').toBe(1);

    // 媒体查询预置允许带附加条件（如 and (pointer: fine)）
    const hoverable = mediaBodies(layout, /@media \(hover: hover\)[^{]*/).join('\n');
    expect(hoverable, '必须有 @media (hover: hover) 块').not.toBe('');

    // 关键：上报 hover: hover / pointer: fine 的触屏也命中媒体查询，
    // 必须再按输入模态排除触屏，否则点按后粘住的 :hover 照样显示成「已选中」。
    const hoverRule = ruleBody(
      hoverable,
      /:root:not\(\[data-input="touch"\]\) \.float-stack__button:hover/
    );
    expect(hoverRule, '悬停视觉必须同时受 data-input 非 touch 约束').not.toBe('');
    expect(hoverRule).toContain('color: var(--text)');
    expect(hoverRule).toContain('border-color: var(--muted)');
  });

  it('触屏模态下悬停提示不再出现（只关 :hover 一支，不动 :focus-visible）', async () => {
    const layout = await read(LAYOUT_CSS);
    const reset = ruleBody(
      layout,
      new RegExp(`:root\\[data-input="touch"\\] ${TOOLTIP}:hover::after,\\s*:root\\[data-input="touch"\\] ${TOOLTIP}:hover::before`)
    );
    expect(reset, '必须有触屏模态的悬停提示复位').not.toBe('');
    expect(reset).toContain('opacity: 0');
    // 键盘提示不能被一并关掉
    expect(layout).not.toMatch(new RegExp(`:root\\[data-input="touch"\\][^{]*${TOOLTIP}:(?:focus-visible|focus)`));
  });

  it('输入模态脚本存在、在布局里加载，并对触屏的兼容鼠标事件设窗口', async () => {
    const script = await read(INPUT_MODALITY_TS);
    expect(script).toContain("setInput('touch')");
    expect(script).toContain("setInput('mouse')");
    expect(script).toContain('pointerType');
    // tap 之后浏览器补发的兼容鼠标事件（WebKit 连 pointerType 都是 mouse）不能翻回 mouse，
    // 否则 iOS Safari 上悬停视觉照样复活。
    expect(script).toMatch(/TOUCH_SETTLE_MS\s*=\s*\d+/);
    expect(script).toMatch(/performance\.now\(\)\s*-\s*lastTouchAt\s*<\s*TOUCH_SETTLE_MS/);

    const baseLayout = await read(BASE_LAYOUT_ASTRO);
    expect(baseLayout, '公开脚本块必须加载输入模态标记').toContain(
      "import '../scripts/input-modality.ts';"
    );
  });

  it('触屏按压反馈由 :active 承担', async () => {
    const layout = await read(LAYOUT_CSS);
    const active = ruleBody(layout, /\.float-stack__button:active/);
    expect(active, '触屏需要瞬时的按压反馈').not.toBe('');
    expect(active).toContain('border-color: var(--muted)');
  });

  it('真实语义状态单独表达：阅读模式开启时有明确外观', async () => {
    const layout = await read(LAYOUT_CSS);
    const pressed = ruleBody(layout, /\.float-stack__button\[aria-pressed="true"\]/);
    expect(pressed, 'aria-pressed="true" 必须有显式样式').not.toBe('');
    expect(pressed).toContain('color: var(--text)');
    expect(pressed).toContain('border-color: var(--muted)');
  });

  it('键盘焦点环保留，指针点按不出环', async () => {
    const layout = await read(LAYOUT_CSS);
    const ring = ruleBody(layout, /\.float-stack__button:focus-visible/);
    expect(ring, '键盘 Tab 必须有可见焦点环').not.toBe('');
    expect(ring).toContain('outline: var(--focus-ring)');
    expect(ring).toContain('outline-offset: var(--focus-ring-offset)');
    // 用 :focus-visible 而不是 :focus，指针点按才不会留下焦点环
    expect(layout).not.toMatch(/\.float-stack__button:focus\s*\{/);
  });

  it('44px 触控覆盖层保持不变', async () => {
    const layout = await read(LAYOUT_CSS);
    const overlay = ruleBody(layout, /\.float-stack__button::before/);
    expect(overlay).toContain('width: var(--tap-min-h)');
    expect(overlay).toContain('height: var(--tap-min-h)');
  });

  it('浮动列按钮不靠 title 提供可访问名称（国产内核会用原生提示吞掉点按）', async () => {
    const [baseLayout, script] = await Promise.all([
      read(BASE_LAYOUT_ASTRO),
      read(FLOATING_ACTIONS_TS)
    ]);
    const start = baseLayout.indexOf('data-float-stack');
    const end = baseLayout.indexOf('<script>', start);
    const block = start === -1 || end === -1 ? '' : baseLayout.slice(start, end);
    expect(block, '需要能定位浮动列标记').not.toBe('');
    expect(block).not.toMatch(/\stitle=/);
    expect(block, '可访问名称仍由 aria-label 提供').toMatch(/aria-label="回到顶部"/);
    // 其它脚本（如 sidebar-reading.ts）会动态写回 title，主脚本负责移除
    expect(script).toContain("removeAttribute('title')");
  });

  it('点击后不强制 blur：键盘焦点语义不被脚本破坏', async () => {
    const script = await read(FLOATING_ACTIONS_TS);
    expect(script).not.toMatch(/\.blur\(\)/);
  });
});

describe('导航点按：去掉设计外的焦点框与点按高亮，保留键盘焦点环', () => {
  it('非键盘焦点不画浏览器默认描边', async () => {
    const global = await read(GLOBAL_CSS);
    const suppress = ruleBody(
      global,
      /:where\(a,\s*button,\s*summary,\s*\[role='button'\]\):focus:not\(:focus-visible\)/
    );
    expect(suppress, '需要 :focus:not(:focus-visible) 覆盖点按后的默认焦点框').not.toBe('');
    expect(suppress).toContain('outline: none');
  });

  it('触屏模态下 :focus / :focus-visible 描边一起关闭（真机复现：点按会命中 :focus-visible）', async () => {
    const global = await read(GLOBAL_CSS);
    const touchFocus = ruleBody(
      global,
      /:root\[data-input="touch"\]:not\(\[data-keyboard\]\) :where\(a,\s*button,\s*summary,\s*\[role='button'\]\):focus/
    );
    expect(touchFocus, '触屏模态需要关闭 :focus 描边').toContain('outline: none');

    const touchFocusVisible = ruleBody(
      global,
      /:root\[data-input="touch"\]:not\(\[data-keyboard\]\) :where\(a,\s*button,\s*summary,\s*\[role='button'\]\):focus-visible/
    );
    expect(touchFocusVisible, '触屏模态需要关闭 :focus-visible 描边').toContain('outline: none');

    // 压制只允许出现在触屏模态作用域内：不能存在无作用域的 :focus-visible 关闭
    expect(global).not.toMatch(
      /(?:^|\n)[ \t]*:where\(a,\s*button,\s*summary,\s*\[role='button'\]\):focus-visible\s*\{[^}]*outline:\s*none/
    );
  });

  it('键盘/鼠标模态仍保留设计焦点环', async () => {
    const global = await read(GLOBAL_CSS);
    const ring = ruleBody(global, /a:focus-visible/);
    expect(ring, '键盘焦点必须仍有设计内的可见环').toContain('outline: 2px solid var(--accent)');
    expect(ring).toContain('outline-offset: 2px');
    // 触屏压制全部带 :root[data-input="touch"] 前缀，键盘模态（data-input 非 touch）不受影响
    expect(global.match(/:root\[data-input="touch"\]:not\(\[data-keyboard\]\) [^{}]*?:focus(?:-visible)?/g)).toHaveLength(2);
  });

  it('点按高亮在根元素与交互元素两层都声明为 transparent', async () => {
    const global = await read(GLOBAL_CSS);
    // 根元素上的声明可继承；部分内核不继承，因此在交互元素上再声明一次
    expect(global).toMatch(/:root\s*\{[\s\S]*?-webkit-tap-highlight-color:\s*transparent/);
    const interactive = ruleBody(global, /:where\(a, button, summary, \[role='button'\]\)/);
    expect(interactive).toContain('-webkit-tap-highlight-color: transparent');
  });

  it('触屏按压反馈由 .nav a:active 承担', async () => {
    const layout = await read(LAYOUT_CSS);
    const active = ruleBody(layout, /\.nav a:active/);
    expect(active, '去掉浏览器高亮后需要有设计内的按压反馈').not.toBe('');
    expect(active).toContain('opacity:');
  });

  it('窄屏导航改为普通文字链接：无胶囊圆角，仍保留 44px 触控高与当前页下划线', async () => {
    const layout = await read(LAYOUT_CSS);
    const narrow = mediaBodies(layout, '@media (max-width: 900px)').join('\n');
    const navLink = ruleBody(narrow, /:where\(body:not\(\.admin-page\)\) \.nav a\b/);
    expect(navLink, '窄屏需要有 .nav a 规则').not.toBe('');
    expect(navLink).toContain('min-height: var(--tap-min-h)');
    // 去掉半圆胶囊：即使内核仍画焦点框，矩形细线也不会变成醒目的圆弧
    expect(navLink).not.toContain('border-radius');
    expect(navLink).not.toContain('transform-origin');

    // 当前页下划线沿用桌面基础规则，窄屏不再单独加粗/挪位，保证横竖屏粗细与位置一致。
    const narrowCurrent = ruleBody(narrow, /:where\(body:not\(\.admin-page\)\) \.nav a\[aria-current="page"\]/);
    expect(narrowCurrent).toBe('');
    const baseCurrent = ruleBody(layout, /\.nav a\[aria-current="page"\]/);
    expect(baseCurrent).toContain('text-decoration: underline');

    // 首页首屏内联快照在 global/layout 之后输出，必须同步删掉胶囊，否则首页仍是圆弧外观。
    const home = await read('src/pages/index.astro');
    const snapshot = /String\.raw`([\s\S]*?)`\s*\]\s*\.join/.exec(home)?.[1] ?? '';
    const homeNarrow = mediaBodies(snapshot, '@media (max-width: 900px)').join('\n');
    const homeNavLink = ruleBody(homeNarrow, /\.nav a\b/);
    expect(homeNavLink, '首页快照需要有窄屏 .nav a 规则').not.toBe('');
    expect(homeNavLink).not.toContain('border-radius');
    expect(homeNavLink).not.toContain('transform-origin');
    expect(homeNarrow).not.toContain('.nav a[aria-current="page"]');
  });
});
