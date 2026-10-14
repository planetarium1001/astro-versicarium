#!/usr/bin/env node
/**
 * check-layout-geometry —— 校验间距方案的几何不变量；取值分散在 dist CSS、页面内联 <style> 与
 * critical CSS 快照里，只读一处会得出错误结论。O = --page-inline，G = --scrollbar-gutter-inline。
 * G1 nav gap + dot + sidebarPad == contentPad；G2 O + sidebarPad == O + G；G3 floatRight >= 8px；
 * G4 floatRight == railActionOffset 且 rail padding-right == railActionOffset；G5 两行页头的 display:grid 未被更高特异度的 .page-heading 压回 flex。用法：`SITE_URL=... npm run build && node ./scripts/check-layout-geometry.mjs`
 */

import process from 'node:process';
import {
  collectDistStyleSources,
  collectOrderedDeclarations,
  toSelectorTable
} from './css-sources.mjs';

const ROOT = process.cwd();
const GUTTER = 15; // html { scrollbar-gutter: stable } 在桌面浏览器上的槽宽
const TOLERANCE = 0.5;
const MIN_RAIL_INSET = 8;
const MIN_CLEARANCE = 4;

const problems = [];
const lines = [];

// 求值：解析 var() 链、把 env(...) 视为 0、把 calc() 内的 px 项求和。返回 px 数字或 null。
const evaluatePx = (value, variables, depth = 0) => {
  if (!value || depth > 10) return null;
  let text = value.replace(/\s*!important\s*$/, '').trim();

  text = text.replace(/env\([^)]*\)/g, '0px');
  text = text.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]*))?\)/g, (_all, name, fallback) => {
    const next = variables.get(name) ?? fallback ?? '';
    const resolved = evaluatePx(next, variables, depth + 1);
    return resolved === null ? '0px' : `${resolved}px`;
  });

  const calc = /^calc\(([\s\S]*)\)$/.exec(text);
  if (calc) {
    let total = 0;
    let sawTerm = false;
    for (const term of calc[1].split(/(?=[+-])/)) {
      // `+ 6px` 这种带前导加号的项要先去掉加号再解析
      const trimmed = term.trim().replace(/^\+\s*/, '');
      if (!trimmed) continue;
      const px = evaluatePx(trimmed, variables, depth + 1);
      if (px === null) return null;
      total += px;
      sawTerm = true;
    }
    return sawTerm ? total : null;
  }

  const px = /^(-?\d+(?:\.\d+)?)px$/.exec(text);
  if (px) return Number(px[1]);
  if (text === '0') return 0;
  return null;
};

// 选择器特异度（只算 G5 需要的三类；:where() 按规范计 0）。
// 返回可直接比较的数字：id * 10000 + class/attr/伪类 * 100 + 元素/伪元素。
const specificity = (selector) => {
  const stripped = selector.replace(/:where\([^)]*\)/g, '');
  const ids = (stripped.match(/#[\w-]+/g) ?? []).length;
  const classes = (stripped.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g) ?? []).length;
  const elements = (stripped.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length
    + (stripped.match(/::[\w-]+/g) ?? []).length;
  return ids * 10000 + classes * 100 + elements;
};

const main = async () => {
  const sources = await collectDistStyleSources(ROOT);
  if (sources.length === 0) {
    console.error('[check-layout-geometry] 未找到样式源，请先 `SITE_URL=... npm run build`。');
    process.exit(1);
  }

  const ordered = collectOrderedDeclarations(sources);
  const bySelector = toSelectorTable(ordered);

  const variables = new Map();
  for (const [property, value] of bySelector.get(':root') ?? []) {
    if (property.startsWith('--')) variables.set(property, value);
  }

  const readPx = (name) => evaluatePx(variables.get(name) ?? '', variables);
  const O = readPx('--page-inline');
  const gutter = readPx('--scrollbar-gutter-inline') ?? GUTTER;
  const sidebarPad = readPx('--sidebar-padding-inline');
  const contentPad = readPx('--public-content-padding-inline');
  const railOffset = readPx('--rail-action-offset');
  const railSize = readPx('--rail-action-size');

  const navGap = evaluatePx(bySelector.get('.nav a')?.get('gap') ?? '', variables);
  const dot = evaluatePx(bySelector.get('.nav .dot')?.get('width') ?? '', variables);

  // 壳层外边距（公开站点；admin 有自己的壳层规则）
  const shellPad = evaluatePx(
    bySelector.get(':where(body:not(.admin-page)) .shell')?.get('padding-inline') ?? '',
    variables
  );
  const floatRight = evaluatePx(bySelector.get('.float-stack')?.get('right') ?? '', variables);
  const railPadRight = (() => {
    const padding = bySelector.get('.article-toc--rail')?.get('padding') ?? '';
    const parts = padding.split(/\s+/);
    // padding: block inline-end block-end inline-start
    return parts.length === 4 ? evaluatePx(parts[1], variables) : null;
  })();

  lines.push(`[check-layout-geometry] 样式源 ${sources.length} 个`);
  lines.push(
    `[check-layout-geometry] O(--page-inline)=${O} gutter=${gutter} sidebarPad=${sidebarPad}`
    + ` contentPad=${contentPad} navGap=${navGap} dot=${dot} railOffset=${railOffset} railSize=${railSize}`
  );

  const requireNumber = (label, value) => {
    if (value === null || Number.isNaN(value)) {
      problems.push(`${label} 无法解析为 px（token 缺失或写法不受支持）`);
      return false;
    }
    return true;
  };

  const ready = [
    requireNumber('--page-inline', O),
    requireNumber('--scrollbar-gutter-inline', gutter),
    requireNumber('--sidebar-padding-inline', sidebarPad),
    requireNumber('--public-content-padding-inline', contentPad),
    requireNumber('--rail-action-offset', railOffset),
    requireNumber('.nav a gap', navGap),
    requireNumber('.nav .dot width', dot),
    requireNumber('.shell padding-inline', shellPad),
    requireNumber('.float-stack right', floatRight),
    requireNumber('.article-toc--rail padding（右内边距）', railPadRight)
  ];
  if (ready.includes(false)) {
    console.error(lines.join('\n'));
    console.error('\n[check-layout-geometry] 有无法解析的取值：');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const near = (a, b) => Math.abs(a - b) <= TOLERANCE;

  // G1：竖线两侧呼吸一致（导航文字右缘 ↔ 竖线 == 竖线 ↔ 正文左缘）
  const breathingLeft = navGap + dot + sidebarPad;
  if (!near(breathingLeft, contentPad)) {
    problems.push(
      `G1 不成立：nav gap(${navGap}) + dot(${dot}) + sidebarPad(${sidebarPad}) = ${breathingLeft}`
      + ` != contentPad(${contentPad})`
    );
  } else {
    lines.push(`  ✓ G1 竖线两侧呼吸一致 = ${contentPad}px`);
  }

  // G2：视口左右对称（最左文字到左缘 == 内容盒右缘到右缘）
  const leftInset = O + sidebarPad;
  const rightInset = O + gutter;
  if (!near(leftInset, rightInset)) {
    problems.push(`G2 不成立：左 ${leftInset} != 右 ${rightInset}（差 ${(leftInset - rightInset).toFixed(1)}px）`);
  } else {
    lines.push(`  ✓ G2 视口左右视觉对称 = ${leftInset}px`);
  }

  // G3：悬浮列右缘距 ICB 右缘必须为正且不太小，否则会被视口边缘与滚动条压住。
  // 偏移公式不叠加 --page-inline，因此不拿槽宽当阈值。
  if (floatRight < MIN_RAIL_INSET - TOLERANCE) {
    problems.push(`G3 不成立：悬浮列 right(${floatRight}) < ${MIN_RAIL_INSET}px，会贴住视口右缘`);
  } else {
    lines.push(`  ✓ G3 悬浮列右缘距 ICB 右缘 ${floatRight}px（>= ${MIN_RAIL_INSET}px，不贴边）`);
  }

  // G4：把手与悬浮列右缘都直接以「距 ICB 右缘」计量，目录列用 margin-right: -page-inline 抵消壳层内边距。
  if (!near(floatRight, railOffset)) {
    problems.push(`G4 不成立：悬浮列 right(${floatRight}) != railOffset(${railOffset})`);
  }
  if (!near(railPadRight, railOffset)) {
    problems.push(`G4 不成立：目录列右内边距(${railPadRight}) != railOffset(${railOffset})`);
  }
  if (near(floatRight, railOffset) && near(railPadRight, railOffset)) {
    lines.push(`  ✓ G4 目录把手与悬浮列右缘对齐（距内容盒右缘 ${railOffset}px）`);
  }

  // 壳层外边距必须真的落在 --page-inline 上（两侧都加宽）
  if (!near(shellPad, O)) {
    problems.push(`壳层外边距不成立：.shell padding-inline(${shellPad}) != --page-inline(${O})`);
  } else {
    lines.push(`  ✓ 壳层左右外边距 = --page-inline = ${O}px`);
  }
  if (O <= 0) {
    problems.push('壳层外边距不成立：--page-inline 必须为正（两侧都要加宽）');
  }

  // 悬浮列不能与正文文字相交。两者都换算到「距 ICB 右缘」参照系：
  // 正文占据 [proseRightInset, ∞)（越靠左数值越大），悬浮列占据 [floatRight, floatRight + railSize]。
  // 因此重叠条件是 floatLeftInset > proseRightInset。
  const proseRightInset = O + contentPad;
  const floatLeftInset = floatRight + railSize;
  if (floatLeftInset > proseRightInset - MIN_CLEARANCE) {
    problems.push(
      `悬浮列与正文相交/过近：悬浮列左缘距 ICB 右缘 ${floatLeftInset} 已越过正文右缘 `
      + `${proseRightInset}（净空 ${(proseRightInset - floatLeftInset).toFixed(1)}px，要求 >= ${MIN_CLEARANCE}px）`
    );
  } else {
    lines.push(
      `  ✓ 悬浮列左缘(${floatLeftInset}) 在正文右缘(${proseRightInset}) 右侧，净空 `
      + `${(proseRightInset - floatLeftInset).toFixed(1)}px`
    );
  }

  // G5：`.page-heading--tag-bar` 的 display:grid 必须真的生效。
  // lists.css 里更高特异度、且加载更晚的 `.page-heading { display: flex }` 会把它压回去，
  // 而类型检查、构建与 DOM 断言都看不出来。判据取充分条件：所有声明了 display 且选择器提到
  // .page-heading 的规则里，没有任何一条的 (特异度, 顺序) 能压过提到 .page-heading--tag-bar 的那条。
  const displayDeclarations = ordered
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.property === 'display' && entry.selector.includes('page-heading'));
  const tagBarGrid = displayDeclarations.filter(
    (entry) => entry.selector.includes('page-heading--tag-bar') && entry.value.includes('grid')
  );
  const others = displayDeclarations.filter((entry) => !entry.selector.includes('page-heading--tag-bar'));

  if (tagBarGrid.length === 0) {
    problems.push('G5 不成立：没有找到 `.page-heading--tag-bar { display: grid }`');
  } else {
    const rank = (entry) => specificity(entry.selector) * 1e6 + entry.index;
    const bestTagBar = tagBarGrid.reduce((best, entry) => (rank(entry) > rank(best) ? entry : best), tagBarGrid[0]);
    const beaten = others.filter((entry) => rank(entry) > rank(bestTagBar));
    if (beaten.length > 0) {
      for (const entry of beaten) {
        problems.push(
          `G5 不成立：\`${entry.selector}{display:${entry.value}}\`（特异度 ${specificity(entry.selector)}）`
          + ` 压过了两行页头的 \`${bestTagBar.selector}{display:${bestTagBar.value}}\``
          + `（特异度 ${specificity(bestTagBar.selector)}）—— 页头会退回 flex，副标题被推到右边`
        );
      }
    } else {
      lines.push(
        `  ✓ G5 两行页头的 display:grid 未被任何 .page-heading 规则压过`
        + `（最高 ${specificity(bestTagBar.selector)}：${bestTagBar.selector}）`
      );
    }
  }

  if (problems.length > 0) {
    console.error(lines.join('\n'));
    console.error('\n[check-layout-geometry] 以下几何不变量不成立：');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(lines.join('\n'));
  console.log('[check-layout-geometry] OK（G1–G5 + 壳层外边距全部成立）');
};

await main();
