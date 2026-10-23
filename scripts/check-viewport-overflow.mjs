#!/usr/bin/env node
/**
 * 校验构建产物里与「窄屏横向溢出 / 右侧空白」相关的约束。只读 dist，不需要浏览器。
 * 用法：SITE_URL=... npm run build && node ./scripts/check-viewport-overflow.mjs
 *
 * 这三类问题都来自「规则存在但作用域或锚点错了」，DOM 断言抓不到：
 * 1. html 的 scrollbar-gutter 若无条件生效，使用经典（占位）滚动条的移动内核会永久预留一条空白；
 * 2. overflow: clip 在旧内核（iOS Safari < 16 等）不生效，退化为 visible 后真实溢出即可横向拖动；
 * 3. 侧栏动作按钮的悬停提示以按钮中心居中且 nowrap，窄屏按钮靠右时右半段伸出视口。
 *
 * 注意构建产物会压缩并改写媒体查询（min-width: 901px → width>=901px），解析要同时接受两种写法。
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const DESKTOP_MIN_WIDTH = 901;
const NARROW_MAX_WIDTH = 900;

const problems = [];
const lines = [];

/** 收集 dist 下全部 CSS 文本（构建产物把 global.css 打进 _astro）。 */
const collectCss = async () => {
  const chunks = [];
  const astroDir = path.join(DIST, '_astro');
  if (existsSync(astroDir)) {
    for (const name of (await readdir(astroDir)).sort()) {
      if (name.endsWith('.css')) {
        chunks.push({
          label: path.join('dist', '_astro', name),
          css: await readFile(path.join(astroDir, name), 'utf8')
        });
      }
    }
  }
  return chunks;
};

/**
 * 把压缩后的 CSS 拆成规则：{ selector, body, contexts }。
 * contexts 是该规则所在的 at-rule 条件栈（只保留 @media / @supports 的 prelude）。
 */
const collectRules = (css) => {
  const rules = [];
  const stack = [];
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      let start = index - 1;
      while (start >= 0 && !';{}'.includes(css[start])) start -= 1;
      const prelude = css.slice(start + 1, index).trim();
      const isAtRule = prelude.startsWith('@');
      stack.push({
        isAtRule,
        prelude,
        selector: isAtRule ? null : prelude,
        // 记录规则自身的条件栈：此刻栈上的 at-rule 就是它的外层条件
        contexts: stack.filter((entry) => entry.isAtRule).map((entry) => entry.prelude),
        bodyStart: index
      });
    } else if (char === '}') {
      const entry = stack.pop();
      if (entry && !entry.isAtRule && entry.selector) {
        rules.push({
          selector: entry.selector,
          body: css.slice(entry.bodyStart + 1, index),
          contexts: entry.contexts
        });
      }
    }
  }
  return rules;
};

/** 条件是否把视口下限抬到桌面档（兼容 min-width 与 range 语法）。 */
const isDesktopCondition = (condition) => {
  const minWidth = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(condition);
  if (minWidth) return Number(minWidth[1]) >= DESKTOP_MIN_WIDTH;
  const greaterEqual = /width\s*>=\s*(\d+(?:\.\d+)?)px/.exec(condition);
  if (greaterEqual) return Number(greaterEqual[1]) >= DESKTOP_MIN_WIDTH;
  const greater = /width\s*>\s*(\d+(?:\.\d+)?)px/.exec(condition);
  if (greater) return Number(greater[1]) >= DESKTOP_MIN_WIDTH - 1;
  return false;
};

/** 条件是否把视口上限压到窄屏档。 */
const isNarrowCondition = (condition) => {
  const maxWidth = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(condition);
  if (maxWidth) return Number(maxWidth[1]) <= NARROW_MAX_WIDTH;
  const lessEqual = /width\s*<=\s*(\d+(?:\.\d+)?)px/.exec(condition);
  if (lessEqual) return Number(lessEqual[1]) <= NARROW_MAX_WIDTH;
  const less = /width\s*<\s*(\d+(?:\.\d+)?)px/.exec(condition);
  if (less) return Number(less[1]) <= NARROW_MAX_WIDTH + 1;
  return false;
};

/** 选择器列表里任一项满足 predicate。 */
const anySelector = (selector, predicate) =>
  selector.split(',').map((part) => part.trim()).some(predicate);

const main = async () => {
  const sources = await collectCss();
  if (sources.length === 0) {
    console.error('[check-viewport-overflow] 未找到 dist CSS，请先 `SITE_URL=... npm run build`。');
    process.exit(1);
  }
  const css = sources.map((source) => source.css).join('\n');
  const rules = collectRules(css);

  // 1. html 的槽位只在桌面断点内出现。其它元素上的 scrollbar-gutter 是各自滚动容器的选择，不在此列。
  const htmlGutterRules = rules.filter(
    (rule) => anySelector(rule.selector, (one) => one === 'html') && /scrollbar-gutter:\s*stable/.test(rule.body)
  );
  if (htmlGutterRules.length === 0) {
    lines.push('  html 未固定滚动条槽位（桌面不做槽位固定，属可接受）');
  } else if (htmlGutterRules.every((rule) => rule.contexts.some(isDesktopCondition))) {
    lines.push(`  html 的 scrollbar-gutter: stable 仅限桌面断点（>= ${DESKTOP_MIN_WIDTH}px）`);
  } else {
    problems.push(
      '`html{scrollbar-gutter:stable}` 在桌面断点之外生效'
      + `（所在条件：${htmlGutterRules
        .map((rule) => rule.contexts.join(' / ') || '顶层')
        .join('；')}）：`
      + '窄屏单列铺满不需要槽位，经典滚动条内核上会永久预留右侧空白'
    );
  }

  // 2. 窄屏兜底必须落在 body：根元素（html）的 overflow 不约束初始包含块，只靠 html 压不回布局视口
  const htmlRules = rules.filter((rule) => anySelector(rule.selector, (one) => one === 'html'));
  if (!htmlRules.some((rule) => /overflow-x:\s*clip/.test(rule.body))) {
    problems.push('html 规则缺少 `overflow-x: clip`：横向兜底不存在');
  } else {
    lines.push('  html 有 overflow-x: clip');
  }

  const bodyNarrowRules = rules.filter(
    (rule) =>
      anySelector(rule.selector, (one) => one === 'body:not(.admin-page)')
      && /overflow-x:\s*(?:clip|hidden)/.test(rule.body)
      && rule.contexts.some(isNarrowCondition)
  );
  if (bodyNarrowRules.length === 0) {
    problems.push(
      '窄屏 `body:not(.admin-page)` 缺少 `overflow-x` 兜底：根元素的 overflow 不约束初始包含块，'
      + '只靠 html 无法把布局视口压回设备宽度'
    );
  } else if (!bodyNarrowRules.some((rule) => /overflow-x:\s*clip/.test(rule.body))) {
    problems.push('窄屏 `body:not(.admin-page)` 的兜底缺 `overflow-x: clip`（只写了 hidden 回退）');
  } else {
    lines.push('  窄屏兜底落在 body（overflow-x: clip）');
  }

  const hasClipFallback = rules.some(
    (rule) =>
      /overflow-x:\s*hidden/.test(rule.body)
      && rule.contexts.some((condition) => /@supports\s+not\s*\(\s*overflow:\s*clip/.test(condition))
  );
  if (!hasClipFallback) {
    problems.push(
      '缺少 `@supports not (overflow: clip)` 下的 `overflow-x: hidden` 回退：'
      + 'iOS Safari < 16 等内核上 clip 被丢弃，真实溢出会变成可横向拖动'
    );
  } else {
    lines.push('  overflow: clip 不可用时退化为 overflow-x: hidden');
  }

  const bodyHiddenFallback = rules.some(
    (rule) =>
      anySelector(rule.selector, (one) => one === 'body:not(.admin-page)')
      && /overflow-x:\s*hidden/.test(rule.body)
      && rule.contexts.some((condition) => /@supports\s+not\s*\(\s*overflow:\s*clip/.test(condition))
      && rule.contexts.some(isNarrowCondition)
  );
  if (!bodyHiddenFallback) {
    problems.push(
      '窄屏 `body:not(.admin-page)` 缺少 `@supports not (overflow: clip)` 下的 `overflow-x: hidden` 回退：'
      + '不支持 clip 的内核上窄屏仍可被横向拖动'
    );
  } else {
    lines.push('  窄屏 body 兜底在无 clip 内核上退化为 hidden');
  }

  // 3. 窄屏壳层宽度上限，且不得用 100vw（vw 在移动端不含滚动条占位）
  const narrowShells = rules.filter(
    (rule) =>
      anySelector(rule.selector, (one) => one === ':where(body:not(.admin-page)) .shell')
      && /grid-template-columns:\s*1fr/.test(rule.body)
  );
  if (narrowShells.length === 0) {
    problems.push('未找到窄屏公开壳层规则（`:where(body:not(.admin-page)) .shell{grid-template-columns:1fr}`）');
  } else if (!narrowShells.every((rule) => /max-width:\s*100%/.test(rule.body))) {
    problems.push('窄屏 `.shell` 缺少 `max-width: 100%` 上限：内容的最小内容宽度可以直接推宽壳层');
  } else if (narrowShells.some((rule) => /max-width:\s*100vw/.test(rule.body))) {
    problems.push('窄屏 `.shell` 用了 `max-width: 100vw`：移动端 vw 不含滚动条占位，会把壳层推出视口');
  } else {
    lines.push('  窄屏 .shell 有 max-width: 100% 上限');
  }

  // 4. 窄屏下侧栏动作按钮的悬停提示必须改锚点：默认以按钮中心居中 + nowrap，
  //    窄屏按钮靠右时右半段会伸出视口（实测各宽度固定多出 35px）。只断言「有窄屏覆盖、不居中、有宽度上限」。
  const TIP_SELECTOR = /^(?::where\(body:not\(\.admin-page\)\) )?\.sidebar-actions \.icon-button\[data-tooltip\]:after$/;
  const tipRules = rules.filter(
    (rule) => anySelector(rule.selector, (one) => TIP_SELECTOR.test(one)) && rule.contexts.some(isNarrowCondition)
  );
  if (tipRules.length === 0) {
    problems.push(
      '缺少窄屏断点下的 `.sidebar-actions .icon-button[data-tooltip]::after` 覆盖：'
      + '默认规则以按钮中心居中且 nowrap，窄屏按钮靠右时提示会伸出视口右侧'
    );
  } else {
    const centered = tipRules.filter((rule) => /translate\(\s*-50%/.test(rule.body));
    const uncapped = tipRules.filter((rule) => !/max-width:/.test(rule.body));
    if (centered.length > 0) {
      problems.push(
        '窄屏 `.sidebar-actions .icon-button[data-tooltip]::after` 仍用 translate(-50%) 居中：'
        + '按钮靠右时提示右半段会越过视口右缘，把整页撑宽'
      );
    }
    if (uncapped.length > 0) {
      problems.push(
        '窄屏 `.sidebar-actions .icon-button[data-tooltip]::after` 缺少 max-width 上限：'
        + '长文案的 nowrap 气泡仍可能超出视口'
      );
    }
    if (centered.length === 0 && uncapped.length === 0) {
      lines.push('  窄屏悬停提示已改锚点且有宽度上限');
    }
  }

  if (problems.length > 0) {
    console.error(lines.join('\n'));
    console.error('\n[check-viewport-overflow] 构建产物的横向溢出约束不成立：');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(lines.join('\n'));
  console.log('[check-viewport-overflow] OK（槽位作用域 + clip 回退 + 窄屏壳层上限 + 窄屏提示锚点全部成立）');
};

await main();
