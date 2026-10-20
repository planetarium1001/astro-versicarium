import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 搜索蒙版只能在样式层守住的契约：jsdom 不做布局与合成，截图也不进单测，
 * 因此直接读 CSS 断言「半透明底色 + 模糊 + 遮罩渐隐」的实现方式，以及展开状态的可见性契约。
 */

const SRC = process.cwd();
const LISTS_CSS = 'src/styles/components/lists.css';
const read = (relative: string) => readFile(path.join(SRC, relative), 'utf8');

const escapeRegExp = (selector: string) => selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 取从行首开始的规则体，避免 `.entry-search-panel` 误配 `.entry-search.is-open .entry-search-panel`。 */
const ruleBodies = (css: string, selector: string): string[] => {
  const pattern = new RegExp(`^[ \\t]*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'gm');
  return Array.from(css.matchAll(pattern), (match) => match[1] ?? '');
};

const ruleBody = (css: string, selector: string): string => ruleBodies(css, selector)[0] ?? '';

/** 选择器列表（逗号换行）无法用单个 selector 精确取，这里直接传正则片段。 */
const ruleBodyByPattern = (css: string, pattern: string): string =>
  new RegExp(`^[ \\t]*${pattern}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';

/** 取 at-rule 的 prelude 与规则体，按大括号配对，允许内部再有嵌套。 */
const atRuleBlocks = (css: string, name: string): { head: string; body: string }[] => {
  const blocks: { head: string; body: string }[] = [];
  const marker = `@${name}`;
  let index = css.indexOf(marker);
  while (index !== -1) {
    const open = css.indexOf('{', index);
    if (open === -1) break;
    let depth = 0;
    let end = open;
    for (; end < css.length; end += 1) {
      if (css[end] === '{') depth += 1;
      else if (css[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) break;
    blocks.push({ head: css.slice(index, open).trim(), body: css.slice(open + 1, end) });
    index = css.indexOf(marker, end + 1);
  }
  return blocks;
};

const atRuleBodies = (css: string, name: string): string[] =>
  atRuleBlocks(css, name).map((block) => block.body);

/** 数值统一写在 `.entry-search` 的变量里，测试从变量取值，避免注释与实现漂移。 */
const numericValue = (body: string, variable: string, unit: 'px' | '%' | 'ms'): number => {
  const value = new RegExp(`${escapeRegExp(variable)}:\\s*([\\d.]+)${unit}`).exec(body)?.[1];
  return value ? Number(value) : NaN;
};

/** 截取 `.entry-search` 相关规则段，供“动画属性白名单”这类整段扫描使用。 */
const entrySearchSection = (css: string): string => {
  const start = css.indexOf('\n.entry-search {');
  const end = css.indexOf('\n[data-entry-item][hidden]');
  return start >= 0 && end > start ? css.slice(start, end) : '';
};

describe('搜索蒙版：范围与观感', () => {
  it('面板和输入框不再铺不透明白底', async () => {
    const css = await read(LISTS_CSS);
    const panel = ruleBody(css, '.entry-search-panel');
    const input = ruleBody(css, '.entry-search-panel input');

    expect(panel, '需要基础面板规则').not.toBe('');
    expect(panel).not.toMatch(/background:\s*var\(--bg\)/);
    expect(panel).toMatch(/background:\s*none/);
    expect(input, '需要输入框规则').not.toBe('');
    expect(input).not.toMatch(/background:\s*var\(--bg\)/);
    expect(input).toMatch(/background:\s*transparent/);
  });

  it('蒙版层是半透明底色，并用横向 + 纵向两层遮罩交叉渐隐', async () => {
    const css = await read(LISTS_CSS);
    const root = ruleBody(css, '.entry-search');
    const veil = ruleBody(css, '.entry-search-panel::before');

    expect(veil, '需要蒙版伪元素').not.toBe('');
    expect(veil).toContain('color-mix(in srgb, var(--bg)');
    expect(veil).toContain('var(--entry-search-veil-alpha-fallback)');

    const fallbackAlpha = numericValue(root, '--entry-search-veil-alpha-fallback', '%');
    expect(fallbackAlpha, '无模糊时的兜底底色要半透明').toBeGreaterThanOrEqual(80);
    expect(fallbackAlpha, '兜底底色不能回到全不透明').toBeLessThan(100);

    // 两层渐变分别负责左右与上下，mask-composite 交叉后三条边才会同时衰减
    expect(veil).toMatch(/linear-gradient\(\s*to right/);
    expect(veil).toMatch(/linear-gradient\(\s*to bottom/);
    expect(veil).toMatch(/mask-image:[\s\S]*transparent 0/);
    expect(veil).toContain('-webkit-mask-image');
    expect(veil).toContain('mask-composite: intersect');
    expect(veil).toContain('-webkit-mask-composite: source-in');
  });

  it('渐隐宽度落在 8–16px，且向右不越过与搜索图标的 8px 间距', async () => {
    const css = await read(LISTS_CSS);
    const root = ruleBody(css, '.entry-search');
    const panel = ruleBody(css, '.entry-search-panel');
    const veil = ruleBody(css, '.entry-search-panel::before');

    const fades = ['--entry-search-veil-fade-y', '--entry-search-veil-fade-left', '--entry-search-veil-fade-right'].map(
      (variable) => numericValue(root, variable, 'px')
    );
    for (const fade of fades) {
      expect(Number.isFinite(fade), '渐隐宽度要用 px 变量声明').toBe(true);
      expect(fade).toBeGreaterThanOrEqual(8);
      expect(fade).toBeLessThanOrEqual(16);
    }

    // 面板右缘距图标 8px；蒙版向右外扩不能超过这段间距，否则会盖住按钮热区
    expect(panel).toContain('right: calc(100% + 8px)');
    expect(veil).toContain('calc(var(--entry-search-veil-fade-right) * -1)');
    expect(fades[2]).toBeLessThanOrEqual(8);
  });

  it('支持 backdrop-filter 时叠加模糊并调低底色不透明度', async () => {
    const css = await read(LISTS_CSS);
    const root = ruleBody(css, '.entry-search');
    const supports =
      atRuleBodies(css, 'supports').find((body) => body.includes('.entry-search-panel::before')) ?? '';

    expect(supports, '需要 backdrop-filter 特性查询').not.toBe('');
    expect(supports).toContain('.entry-search-panel::before');
    expect(supports).toMatch(/backdrop-filter:\s*blur\(/);
    expect(supports).toMatch(/-webkit-backdrop-filter:\s*blur\(/);
    expect(supports).toContain('var(--entry-search-veil-blur)');
    expect(supports).toContain('var(--entry-search-veil-alpha)');

    const blur = numericValue(root, '--entry-search-veil-blur', 'px');
    expect(blur).toBeGreaterThanOrEqual(8);
    expect(blur).toBeLessThanOrEqual(16);

    const supportedAlpha = numericValue(root, '--entry-search-veil-alpha', '%');
    const fallbackAlpha = numericValue(root, '--entry-search-veil-alpha-fallback', '%');
    expect(supportedAlpha).toBeGreaterThanOrEqual(60);
    expect(supportedAlpha, '支持模糊时底色要比退化时更透').toBeLessThan(fallbackAlpha);
  });

  it('鼠标热区、键盘可见性与焦点环契约不变', async () => {
    const css = await read(LISTS_CSS);
    const panel = ruleBody(css, '.entry-search-panel');
    const openPanel = ruleBody(css, '.entry-search.is-open .entry-search-panel');
    const veil = ruleBody(css, '.entry-search-panel::before');
    const inputFocus = ruleBody(css, '.entry-search-panel input:focus');
    const toggleFocus = ruleBody(css, '.entry-search-toggle:focus-visible');

    expect(panel).toMatch(/visibility:\s*hidden/);
    expect(panel).toMatch(/pointer-events:\s*none/);
    expect(openPanel).toMatch(/visibility:\s*visible/);
    expect(openPanel).toMatch(/pointer-events:\s*auto/);
    expect(openPanel).toMatch(/transition-delay:\s*0s/);
    // 蒙版只画不拦事件，展开时的热区仍由面板与 bridge 决定
    expect(veil).toMatch(/pointer-events:\s*none/);
    expect(inputFocus).toMatch(/border-bottom-color:\s*var\(--accent\)/);
    expect(toggleFocus).toMatch(/outline:\s*var\(--focus-ring\)/);
  });

  it('宽屏与窄屏宽度覆盖保持原样', async () => {
    const css = await read(LISTS_CSS);
    const media = atRuleBodies(css, 'media');
    const tablet =
      media.find((body) => /^[ \t]*\.entry-search\.is-open \.entry-search-panel\s*\{/m.test(body)) ?? '';
    const narrow = media.find((body) => /^[ \t]*\.entry-search-panel\s*\{/m.test(body)) ?? '';

    expect(tablet).toMatch(/width:\s*min\(196px, 54vw\)/);
    expect(narrow).toMatch(/width:\s*min\(156px, 58vw\)/);
  });
});

describe('搜索蒙版：圆润边缘与开合动效', () => {
  it('四角用径向遮罩收圆，圆角与角衰减半径足够大', async () => {
    const css = await read(LISTS_CSS);
    const root = ruleBody(css, '.entry-search');
    const veil = ruleBody(css, '.entry-search-panel::before');

    expect(veil).toMatch(/border-radius:\s*var\(--entry-search-veil-radius\)/);

    // prefixed 与标准两份 mask 各叠 4 个角，共 8 层径向渐变
    const cornerLayers = veil.match(/radial-gradient\(/g) ?? [];
    expect(cornerLayers.length, '需要四角各一层、prefixed/标准各一份').toBe(8);
    for (const corner of ['circle at 0 0', 'circle at 100% 0', 'circle at 0 100%', 'circle at 100% 100%']) {
      expect(veil).toContain(corner);
    }
    // 角点先透明再恢复实心：圆角是渐变收圆，不是硬切
    expect(veil).toMatch(
      /radial-gradient\(circle at 0 0, transparent 0, transparent var\(--entry-search-veil-corner-core\), #000 var\(--entry-search-veil-corner\)\)/
    );

    const radius = numericValue(root, '--entry-search-veil-radius', 'px');
    const corner = numericValue(root, '--entry-search-veil-corner', 'px');
    const cornerCore = numericValue(root, '--entry-search-veil-corner-core', 'px');
    expect(radius, '圆角要比上一版 12px 更大').toBeGreaterThanOrEqual(16);
    expect(radius).toBeLessThanOrEqual(28);
    expect(corner).toBeGreaterThanOrEqual(20);
    expect(corner).toBeLessThanOrEqual(36);
    expect(cornerCore).toBeGreaterThan(0);
    expect(cornerCore).toBeLessThan(corner);

    // 线性渐隐保持原有的左右/上下过渡
    expect(veil).toMatch(/linear-gradient\(\s*to right/);
    expect(veil).toMatch(/linear-gradient\(\s*to bottom/);
  });

  it('开合过渡：蒙版自身淡入、内容层淡入 + 轻微位移缩放，关闭更快且都在 160–260ms', async () => {
    const css = await read(LISTS_CSS);
    const root = ruleBody(css, '.entry-search');
    const panel = ruleBody(css, '.entry-search-panel');
    const veil = ruleBody(css, '.entry-search-panel::before');
    const openVeil = ruleBody(css, '.entry-search.is-open .entry-search-panel::before');
    const openPanel = ruleBody(css, '.entry-search.is-open .entry-search-panel');
    const content = ruleBodyByPattern(
      css,
      String.raw`\.entry-search-panel input,\s*\n\s*\.entry-search-panel \.entry-search-feedback`
    );
    const openContent = ruleBodyByPattern(
      css,
      String.raw`\.entry-search\.is-open \.entry-search-panel input,\s*\n\s*\.entry-search\.is-open \.entry-search-panel \.entry-search-feedback`
    );

    // 面板不做 opacity：祖先透明度 < 1 会让蒙版的 backdrop-filter 失效
    expect(panel).not.toMatch(/(?:^|\n)\s*opacity\s*:/);
    expect(panel).toMatch(/transition:\s*visibility 0s linear var\(--entry-search-close-duration\)/);
    expect(openPanel).toMatch(/visibility:\s*visible/);
    expect(openPanel).toMatch(/pointer-events:\s*auto/);

    // 蒙版用自身 opacity 淡入淡出，模糊结果按 alpha 混合，不会先清晰后糊
    expect(veil).toMatch(/opacity:\s*0/);
    expect(veil).toMatch(/transition:\s*opacity var\(--entry-search-close-duration\) var\(--entry-search-ease\)/);
    expect(openVeil).toMatch(/opacity:\s*1/);
    expect(openVeil).toMatch(/transition-duration:\s*var\(--entry-search-open-duration\)/);

    // 内容层承担启停时的 6px 位移与 0.985 缩放
    expect(content).toMatch(/opacity:\s*0/);
    expect(content).toMatch(/transform:\s*translate\(6px, 0\) scale\(0\.985\)/);
    expect(content).toMatch(/transform-origin:\s*right center/);
    expect(content).toMatch(/transition:\s*[\s\S]*opacity var\(--entry-search-close-duration\) var\(--entry-search-ease\)/);
    expect(content).toMatch(/transform var\(--entry-search-close-duration\) var\(--entry-search-ease\)/);
    expect(openContent).toMatch(/opacity:\s*1/);
    expect(openContent).toMatch(/transform:\s*translate\(0, 0\) scale\(1\)/);
    expect(openContent).toMatch(/transition-duration:\s*var\(--entry-search-open-duration\)/);

    const open = numericValue(root, '--entry-search-open-duration', 'ms');
    const close = numericValue(root, '--entry-search-close-duration', 'ms');
    expect(open).toBeGreaterThanOrEqual(160);
    expect(open).toBeLessThanOrEqual(260);
    expect(close).toBeGreaterThanOrEqual(160);
    expect(close).toBeLessThanOrEqual(260);
    expect(close, '关闭要略快于打开').toBeLessThan(open);
    expect(root).toMatch(/--entry-search-ease:\s*cubic-bezier\(/);
  });

  it('动画只碰 opacity / transform，不改变 mask、backdrop-filter 等昂贵属性', async () => {
    const css = await read(LISTS_CSS);
    const section = entrySearchSection(css);

    expect(section, '需要定位到 entry-search 规则段').not.toBe('');
    const transitions = Array.from(
      section.matchAll(/transition(?:-property)?:\s*([^;]+);/g),
      (match) => match[1] ?? ''
    );
    expect(transitions.length, '需要有开合过渡声明').toBeGreaterThan(0);
    for (const declaration of transitions) {
      expect(declaration).not.toMatch(/mask/);
      expect(declaration).not.toMatch(/backdrop/);
      expect(declaration).not.toMatch(/filter/);
      expect(declaration).not.toMatch(/visibility[^,]*\.\d/);
    }
    // 蒙版与模糊参与过渡的只有自身 opacity
    const veil = ruleBody(css, '.entry-search-panel::before');
    expect(veil).toMatch(/transition:\s*opacity var\(--entry-search-close-duration\) var\(--entry-search-ease\)/);
    // 面板只过渡 visibility，位移不再挂在带 backdrop-filter 的图层上
    const panel = ruleBody(css, '.entry-search-panel');
    expect(panel).not.toMatch(/transition:[^;]*transform/);
  });

  it('合成提示只在打开态声明，关闭态不留常驻 will-change', async () => {
    const css = await read(LISTS_CSS);
    const panel = ruleBody(css, '.entry-search-panel');
    const veil = ruleBody(css, '.entry-search-panel::before');
    const openVeil = ruleBody(css, '.entry-search.is-open .entry-search-panel::before');
    const content = ruleBodyByPattern(
      css,
      String.raw`\.entry-search-panel input,\s*\n\s*\.entry-search-panel \.entry-search-feedback`
    );
    const openContent = ruleBodyByPattern(
      css,
      String.raw`\.entry-search\.is-open \.entry-search-panel input,\s*\n\s*\.entry-search\.is-open \.entry-search-panel \.entry-search-feedback`
    );

    expect(panel).not.toMatch(/will-change/);
    expect(veil).not.toMatch(/will-change/);
    expect(content).not.toMatch(/will-change/);
    expect(openVeil).toMatch(/will-change:\s*opacity/);
    expect(openContent).toMatch(/will-change:\s*opacity, transform/);
  });

  it('输入框字号与横屏一致：基础 13px，窄屏不再单独放大', async () => {
    const css = await read(LISTS_CSS);
    const input = ruleBody(css, '.entry-search-panel input');
    expect(input).toMatch(/font-size:\s*13px/);

    const narrow =
      atRuleBlocks(css, 'media').find((block) => block.head.includes('max-width: 640px'))?.body ?? '';
    expect(narrow, '需要窄屏 640 档').not.toBe('');
    // 窄屏曾为防 iOS 缩放单独放大到 16px，导致横竖屏字号不一致；统一回基础档。
    expect(narrow).not.toMatch(/\.entry-search-panel input\s*\{[^}]*font-size/);
  });

  it('prefers-reduced-motion 下时长归零，无开合动画', async () => {
    const css = await read(LISTS_CSS);
    const section = entrySearchSection(css);
    const reduced =
      atRuleBlocks(section, 'media').find((block) => block.head.includes('prefers-reduced-motion: reduce'))?.body ?? '';

    expect(reduced, '需要 reduced-motion 覆盖').not.toBe('');
    expect(reduced).toContain('.entry-search');
    expect(reduced).toMatch(/--entry-search-open-duration:\s*0s/);
    expect(reduced).toMatch(/--entry-search-close-duration:\s*0s/);
    expect(reduced).toMatch(/\.entry-search-toggle[\s\S]*transition:\s*none/);
  });
});
