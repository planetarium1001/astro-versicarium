import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 开发日志时间线只保留列表上的一条连续虚线。
 * jsdom 不做布局，这里直接读样式源码做契约断言：
 * 单一线路来源、无逐行/逐面板接缝、行内容压在线上方、收尾补丁仍生效。
 */

const DEVLOG_CSS = 'src/styles/devlog-page.css';
const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

/** 取出某个选择器的声明块，选择器按字面量匹配。 */
const rule = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

describe('devlog 时间线：一条连续虚线', () => {
  it('线路只有 .devlog-list::before 一个来源，dash 相位连续', async () => {
    const css = await read(DEVLOG_CSS);
    const list = rule(css, '.devlog-list');
    const line = rule(css, '.devlog-list::before');

    // 绝对定位的线需要列表作为包含块
    expect(list).toMatch(/position:\s*relative/);
    expect(line).not.toBe('');
    expect(line).toMatch(/position:\s*absolute/);
    expect(line).toMatch(/top:\s*0/);
    expect(line).toMatch(/bottom:\s*0/);
    expect(line).toMatch(/left:\s*var\(--devlog-line-x\)/);
    expect(line).toMatch(/width:\s*1px/);
    expect(line).toMatch(/repeating-linear-gradient\(/);
    // 全文只允许一条渐变线
    expect(css.match(/repeating-linear-gradient\(/g) ?? []).toHaveLength(1);
  });

  it('不再有逐行、逐面板的虚线，也没有 bottom:6px 接缝', async () => {
    const css = await read(DEVLOG_CSS);

    expect(css).not.toMatch(/\.devlog-row__toggle::before/);
    expect(css).not.toMatch(/\.devlog-panel__inner::before/);
    expect(css).not.toMatch(/border-left:\s*1px\s+dashed/);
    expect(css).not.toMatch(/bottom:\s*6px/);
  });

  it('行内容压在线上方，且定位不参与布局', async () => {
    const css = await read(DEVLOG_CSS);
    const row = rule(css, '.devlog-row');

    expect(row).toMatch(/position:\s*relative/);
    expect(row).toMatch(/z-index:\s*1/);
    // 只提升层叠，不引入 margin/transform 之类会影响排版的属性
    expect(row).not.toMatch(/margin|transform|translate/);
  });

  it('日期底色、最后一条 4x48px 补丁与 reduced-motion 仍然生效', async () => {
    const css = await read(DEVLOG_CSS);

    // 日期底色继续遮住线，形成节点断口
    expect(css).toMatch(/\.devlog-row__date\s*\{[^}]*background:\s*var\(--bg\)/);
    // 最后一条（含筛选后的最后一条）收起时只在日期下沿停住
    expect(css).toMatch(
      /\.devlog-row:is\(:last-child, \.is-last-visible\) \.devlog-row__date::after\s*\{[^}]*top:\s*100%[^}]*width:\s*4px[^}]*height:\s*48px[^}]*background:\s*var\(--bg\)/
    );
    // 展开时补丁淡出，线延伸到面板末尾
    expect(css).toMatch(
      /\.devlog-row:is\(:last-child, \.is-last-visible\)\.is-open \.devlog-row__date::after\s*\{[^}]*opacity:\s*0/
    );
    // 减少动效时补丁不播过渡
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.devlog-row:is\(:last-child, \.is-last-visible\) \.devlog-row__date::after\s*\{[^}]*transition:\s*none/
    );
  });
});
