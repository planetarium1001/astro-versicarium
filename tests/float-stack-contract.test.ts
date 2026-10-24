import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readModuleDir } from './module-source-reader';


/**
 * 浮动列可点击性的静态几何探针：jsdom 不做布局，`::before` 覆盖层也拿不到矩形，
 * 端到端用例断言不了「相邻 44px 热区有没有互相压住」「右缘间距是否与桌面统一」。
 * 这里从源码 CSS 取出实际声明的数值，按盒模型手算一遍；构建产物侧的同类断言
 * 由 scripts/check-layout-geometry.mjs 在 dist 上执行。
 *
 * 真机结论（第四轮）：交互改善来自相邻热区之间的净空，不来自整体内移；
 * 桌面视觉间距固定 6px。44px 热区外沿（视觉 34px 之外的 5px 透明外溢）
 * 仍可能压在系统手势判定区边界上，属已知残余，不在断言里当作期望状态。
 *
 * 第七轮起，窄屏右缘距离改为后台可配（`site.railOffsetPx`，0–32，默认 6）：
 * BaseLayout 把值写成 <html> 内联的 `--rail-action-offset-narrow`，layout.css 只在
 * ≤900px 的公开页面引用它覆盖 `--rail-action-offset`；桌面仍用 :root 的 6px。
 *
 * 第六轮真机（华为 ArkWeb）证实：pointer 事件到达页面、click 被内核吞掉，
 * 四个按钮统一接入 touch-activate 的触摸兜底；这里的断言只负责“接入关系与阈值”，
 * 行为用例在 tests/touch-activate.test.ts。
 */

const SRC = process.cwd();
const read = (relative: string) => readFile(path.join(SRC, relative), 'utf8');
const LAYOUT_CSS = 'src/styles/components/layout.css';
const GLOBAL_CSS = 'src/styles/global.css';
const BASE_LAYOUT_ASTRO = 'src/layouts/BaseLayout.astro';
const FLOATING_ACTIONS_TS = 'src/scripts/sidebar-floating-actions.ts';
const TOUCH_ACTIVATE_TS = 'src/scripts/touch-activate.ts';
const ARTICLE_TOC_TS = 'src/scripts/article-toc.ts';
const SIDEBAR_READING_TS = 'src/scripts/sidebar-reading.ts';

/** 相邻 44px 热区之间至少保留的净空，避免边界上互相抢点击。 */
const MIN_HIT_CLEARANCE = 2;

/** 取媒体查询的块体；prelude 传字符串按字面匹配，传正则可匹配带附加条件的查询。 */
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
    let closed = false;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.push(css.slice(open + 1, index));
          from = index;
          closed = true;
          break;
        }
      }
    }
    if (!closed || from <= start) break;
  }
  return bodies;
};

/** 取某个选择器的规则体；选择器按正则匹配，允许前导空白。 */
const ruleBody = (css: string, selector: RegExp): string => {
  const match = new RegExp(`(?:^|\\n)[ \\t]*${selector.source}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  return match?.[1] ?? '';
};

/** 从声明里取第一个 px 数值；取不到返回 null。 */
const px = (declaration: string | undefined): number | null => {
  const match = /(-?\d+(?:\.\d+)?)px/.exec(declaration ?? '');
  return match ? Number(match[1]) : null;
};

const narrowCss = (layout: string) =>
  mediaBodies(layout, '@media (max-width: 900px)').join('\n');

const readGeometry = async () => {
  const [layout, global] = await Promise.all([read(LAYOUT_CSS), read(GLOBAL_CSS)]);
  const root = ruleBody(layout, /:root/);
  return {
    layout,
    narrow: narrowCss(layout),
    railSize: px(/--rail-action-size:([^;]+)/.exec(root)?.[1]),
    tapMin: px(/--tap-min-h:([^;]+)/.exec(ruleBody(global, /:root/))?.[1]),
    baseOffset: px(/--rail-action-offset:([^;]+)/.exec(root)?.[1])
  };
};

/** 取 BaseLayout 里浮动列的标记片段（从容器到脚本之前），用于断言按钮属性。 */
const floatStackMarkup = (source: string) => {
  const start = source.indexOf('data-float-stack');
  const end = source.indexOf('<script>', start);
  return start === -1 || end === -1 ? '' : source.slice(start, end);
};

describe('浮动列：窄屏右缘距离由后台设置控制', () => {
  it('桌面固定 6px，窄屏只引用构建期内联变量', async () => {
    const { layout, narrow, baseOffset } = await readGeometry();

    expect(baseOffset, '桌面视觉间距固定 6px').toBe(6);
    // 两处声明：:root 的桌面 6px + 窄屏对后台变量的引用；窄屏覆盖必须引用内联变量
    expect(layout.match(/--rail-action-offset:/g), '桌面值 + 窄屏引用各一次').toHaveLength(2);
    expect(layout.match(/--rail-action-offset:\s*6px/g), '桌面值只定义一次').toHaveLength(1);
    const narrowToken =
      /--rail-action-offset:\s*([^;]+)/.exec(ruleBody(narrow, /body:not\(\.admin-page\)/))?.[1] ?? '';
    expect(narrowToken.trim(), '窄屏必须引用 --rail-action-offset-narrow 并保留 6px 兜底')
      .toBe('var(--rail-action-offset-narrow, 6px)');
  });

  it('BaseLayout 把后台设置写成 <html> 内联变量（窄屏专用）', async () => {
    const layout = await read(BASE_LAYOUT_ASTRO);
    expect(layout).toContain('settings.site.railOffsetPx');
    expect(layout).toContain('--rail-action-offset-narrow: ${siteRailOffsetPx}px');
    expect(layout).toContain('const siteRailOffsetPx = settings.site.railOffsetPx;');
  });

  it('默认值与范围与后台常量一致（site.json 默认 6）', async () => {
    const [siteJsonRaw, shared] = await Promise.all([
      read('src/data/settings/site.json'),
      readModuleDir(SRC, 'src/lib/admin-console/theme-shared')
    ]);
    const siteJson = JSON.parse(siteJsonRaw) as { railOffsetPx?: number };
    expect(siteJson.railOffsetPx, '默认构建仍输出 6px').toBe(6);
    expect(shared).toContain('ADMIN_SITE_RAIL_OFFSET_DEFAULT = 6');
    expect(shared).toContain('ADMIN_SITE_RAIL_OFFSET_MIN = 0');
    expect(shared).toContain('ADMIN_SITE_RAIL_OFFSET_MAX = 32');
  });

  it('右缘偏移仍与目录把手共用 token，并叠加安全区', async () => {
    const { layout } = await readGeometry();
    const stack = ruleBody(layout, /\.float-stack/);
    expect(stack).toContain('right: calc(var(--rail-action-offset) + env(safe-area-inset-right))');
  });
});

describe('浮动列：44px 热区保留，相邻热区留净空', () => {
  it('覆盖层仍是 44px：桌面居中，窄屏向内侧偏 5px 且右缘对齐视觉按钮', async () => {
    const { layout, narrow, railSize, tapMin } = await readGeometry();
    const overlay = ruleBody(layout, /\.float-stack__button::before/);
    expect(overlay).toContain('width: var(--tap-min-h)');
    expect(overlay).toContain('height: var(--tap-min-h)');
    // 桌面保持四边各外扩 5px 的居中覆盖层
    expect(overlay).toContain('inset: 0');
    expect(overlay).toContain('margin: auto');

    // 窄屏把覆盖层整体向内侧偏「外扩量」：右缘与 34px 视觉按钮右缘对齐，总宽不变
    const overhang = (tapMin! - railSize!) / 2;
    expect(overhang, '44px 覆盖层相对 34px 视觉按钮每侧外扩 5px').toBe(5);
    const narrowOverlay = ruleBody(narrow, /body:not\(\.admin-page\) \.float-stack__button::before/);
    expect(narrowOverlay, '窄屏需要有热区内偏规则').toContain(`transform: translateX(-${overhang}px)`);
  });

  it('窄屏间距 12px：相邻 44px 热区净空 2px（交互改善的关键，不得退回 10px）', async () => {
    const { layout, railSize, tapMin, narrow } = await readGeometry();

    expect(railSize, '视觉按钮尺寸不变').toBe(34);
    expect(tapMin, '触控热区下限不变').toBe(44);

    const baseGap = px(/gap:([^;]+)/.exec(ruleBody(layout, /\.float-stack/))?.[1]);
    expect(baseGap, '桌面间距：中心距恰好相切（44px）').toBe(10);
    expect(railSize! + baseGap!).toBe(tapMin!);

    const touchGap = px(
      /gap:([^;]+)/.exec(ruleBody(narrow, /body:not\(\.admin-page\) \.float-stack/))?.[1]
    );
    expect(touchGap, '窄屏必须有 .float-stack gap 覆盖').toBe(12);
    expect(railSize! + touchGap!).toBe(tapMin! + MIN_HIT_CLEARANCE);
  });

  it('间距覆盖只作用于公开窄屏壳层，后台与桌面不受影响', async () => {
    const { narrow } = await readGeometry();
    expect(narrow, '必须能取到窄屏媒体查询块').not.toBe('');
    expect(ruleBody(narrow, /body:not\(\.admin-page\) \.float-stack/)).not.toBe('');
  });
});

describe('浮动列：华为浏览器（ArkWeb）点按兼容', () => {
  it('按钮只写 aria-label，不写 title（title 会触发原生提示并吞掉首次点按）', async () => {
    const baseLayout = await read(BASE_LAYOUT_ASTRO);
    const block = floatStackMarkup(baseLayout);
    expect(block, '需要能定位浮动列标记').not.toBe('');
    expect(block, '浮动列按钮不得再写 title').not.toMatch(/\stitle=/);
    const labels = Array.from(block.matchAll(/aria-label="([^"]+)"/g), (match) => match[1]);
    expect(labels).toEqual(
      expect.arrayContaining(['查看目录', '阅读模式', '回到上次阅读位置', '回到顶部'])
    );
  });

  it('脚本会移除其它脚本动态写回的 title，且自己不再设置 title', async () => {
    const script = await read(FLOATING_ACTIONS_TS);
    expect(script).toContain("'.float-stack__button[title]'");
    expect(script).toContain("removeAttribute('title')");
    expect(script, '需要观察运行时写回的 title').toContain("attributeFilter: ['title']");
    expect(script, '脚本自身不得再写 title').not.toMatch(/setAttribute\('title'/);
  });

  it('按钮禁用长按选择与系统呼出菜单，touch-action: manipulation 保留', async () => {
    const { layout } = await readGeometry();
    const button = ruleBody(layout, /\.float-stack__button\b/);
    expect(button, '按钮基础规则需要能取到').not.toBe('');
    expect(button).toContain('-webkit-touch-callout: none');
    expect(button).toContain('-webkit-user-select: none');
    expect(button).toContain('user-select: none');
    // 允许单指滚动/点按，不引入双击缩放延迟
    expect(layout).toMatch(/\.float-stack__button\s*\{[^}]*touch-action:\s*manipulation/);
  });
});

describe('浮动列：四个按钮都接入触摸 pointer 兜底', () => {
  it('touch-activate 导出绑定器与三个阈值，且不改变默认行为', async () => {
    const script = await read(TOUCH_ACTIVATE_TS);
    expect(script).toContain('export const bindTouchActivate');
    expect(script).toContain('TOUCH_ACTIVATE_MAX_DISTANCE_PX = 8');
    expect(script).toContain('TOUCH_ACTIVATE_MAX_DURATION_MS = 650');
    expect(script).toContain('TOUCH_ACTIVATE_CLICK_DEDUPE_MS = 500');
    // 兜底只做被动监听：不能 preventDefault，否则会破坏滚动与系统手势
    expect(script).not.toMatch(/\.preventDefault\(/);
  });

  it('回到顶部与回到上次阅读位置接入绑定器，并保留状态同步与禁用判断', async () => {
    const script = await read(FLOATING_ACTIONS_TS);
    expect(script).toContain("import { bindTouchActivate } from './touch-activate';");
    expect(script).toMatch(/bindTouchActivate\(stackButton,/);
    expect(script).toMatch(/bindTouchActivate\(resumeButton,/);
    // 点击时先重算状态的逻辑继续存在（原 click 行为不退化）
    expect(script).toContain('scrollTopDisabled');
    expect(script).toContain('resumeDisabled');
    expect(script).toContain('syncScrollTopButton()');
    expect(script).toContain('syncResumeButton()');
    // 不再保留独立的 click 监听，避免与兜底重复触发
    expect(script).not.toMatch(/\.addEventListener\('click'/);
  });

  it('目录按钮与阅读模式按钮同样接入绑定器', async () => {
    const [toc, reading] = await Promise.all([read(ARTICLE_TOC_TS), read(SIDEBAR_READING_TS)]);
    expect(toc).toContain("import { bindTouchActivate } from './touch-activate';");
    expect(toc).toMatch(/bindTouchActivate\(tocJumpButton,/);
    expect(reading).toContain("import { bindTouchActivate } from './touch-activate';");
    expect(reading).toMatch(/bindTouchActivate\(readerBtn,/);
    // 阅读模式按钮的隐藏态不可触发
    expect(reading).toMatch(/disabled:\s*\(\)\s*=>\s*readerBtn\.hidden/);
  });
});

describe('浮动列：aria 语义不被可点击性修复破坏', () => {
  it('回到顶部仍是按钮，初始禁用态由 aria-disabled 表达', async () => {
    const baseLayout = await read(BASE_LAYOUT_ASTRO);
    expect(baseLayout).toMatch(/id="scroll-top"[\s\S]{0,120}?type="button"[\s\S]{0,200}?aria-disabled="true"/);
  });

  it('禁用态点击仍被脚本忽略，不因「更灵敏」变成有效操作', async () => {
    const script = await read(FLOATING_ACTIONS_TS);
    // 禁用判断在绑定器的 disabled 回调里，pointer 兜底与原生 click 都会先经过它
    const guard = /const scrollTopDisabled = \(\) => \{([\s\S]*?)\n  \};/.exec(script)?.[1] ?? '';
    expect(guard, '需要保留回到顶部的禁用判断').not.toBe('');
    expect(guard).toContain("getAttribute('aria-disabled')");
    expect(guard).toContain("=== 'true'");
    expect(script).toMatch(
      /bindTouchActivate\(stackButton, activateScrollTop, \{ disabled: scrollTopDisabled \}\)/
    );
    // 回到上次阅读位置用 hidden 判断，隐藏态不可激活
    expect(script).toContain('resumeButton.hidden');
  });
});
