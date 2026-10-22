import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { ROLE_SELECTORS, TEXT_EXCLUDE_SELECTORS } from '../scripts/font/role-selectors.mjs';
import { extractRoleCharsets, mergeRoleCharsets, setToSortedString } from '../scripts/font/roles.mjs';

const FIXTURE = `<!doctype html>
<html><head><title>页面标题不参与</title><style>.x { color: red; }</style></head>
<body>
  <h1>主标题</h1>
  <p>正文<span class="badge">徽章</span><strong>加粗</strong></p>
  <div class="bit-meta">2026<span>日期</span></div>
  <div class="meta-line">元信息</div>
  <div class="intro">导语<strong>强调</strong></div>
  <blockquote>引用</blockquote>
  <time>时间</time>
  <a class="sidebar__title-text">品牌</a>
  <script>脚本内容</script>
  <svg><text>图标文字</text></svg>
</body></html>`;

const extract = (html: string) => {
  const dom = new JSDOM(html);
  const result = extractRoleCharsets(dom.window.document);
  dom.window.close();
  return result;
};

describe('font/roles', () => {
  it('attributes text nodes to display > meta > brand > text roles', () => {
    const result = extract(FIXTURE);
    const display = setToSortedString(result.display);
    const meta = setToSortedString(result.meta);
    const brand = setToSortedString(result.brand);
    const textOnly = setToSortedString(result.textOnly);
    const all = setToSortedString(result.text);

    expect(display).toContain('标');
    expect(display).toContain('徽');
    expect(display).toContain('章');
    // intro 里的 strong 优先级高于 meta：加粗文本进 display，不进 meta。
    expect(display).toContain('强');
    expect(meta).not.toContain('强');
    expect(meta).toContain('引');
    expect(meta).toContain('元');
    expect(brand).toContain('品');
    expect(textOnly).toContain('正');
    expect(textOnly).toContain('文');
    // text 是页面可见文本并集，包含 display/meta/brand 字符。
    for (const ch of display + meta + brand) expect(all).toContain(ch);
    // script/style/svg/head 不参与任何角色。
    expect(all).not.toContain('脚');
    expect(all).not.toContain('式');
    expect(all).not.toContain('图');
    expect(all).not.toContain('页');
  });

  it('merges page charsets and frequencies', () => {
    const first = extract(FIXTURE);
    const merged = extract(FIXTURE);
    mergeRoleCharsets(merged, first);
    expect(merged.frequency.get('一')).toBeUndefined();
    const word = extract('<p>的的</p>');
    mergeRoleCharsets(merged, word);
    expect(merged.frequency.get('的')).toBe(2);
  });

  it('keeps centralized selectors in sync with CSS font usage', () => {
    const cssFiles = [
      'src/styles/global.css',
      'src/styles/components/lists.css',
      'src/styles/components/layout.css',
      'src/styles/components/trailing-links.css',
      'src/styles/components/callout.css',
      'src/styles/components/article-toc.css'
    ];
    const css = cssFiles
      .map((file) => {
        try {
          return readFileSync(path.join(process.cwd(), file), 'utf8');
        } catch {
          return '';
        }
      })
      .join('\n')
      .replace(/\s+/g, ' ');

    const requiredDisplaySelectors = ['.list-item__title', '.badge', '.trailing-links a', '.callout-title'];
    const requiredMetaSelectors = ['.bit-meta', '.meta-line', '.page-subtitle', '.intro', '.note', 'blockquote'];
    for (const selector of [...requiredDisplaySelectors, ...requiredMetaSelectors]) {
      expect(
        css.includes(selector),
        `CSS 中找不到 ${selector}；角色选择器需与实际字体使用同步`
      ).toBe(true);
    }
    expect(ROLE_SELECTORS.display.selectors.length).toBeGreaterThan(10);
    expect(ROLE_SELECTORS.meta.selectors.length).toBeGreaterThan(10);
    expect(new Set([...ROLE_SELECTORS.display.selectors, ...ROLE_SELECTORS.meta.selectors]).size).toBe(
      ROLE_SELECTORS.display.selectors.length + ROLE_SELECTORS.meta.selectors.length
    );
    expect(TEXT_EXCLUDE_SELECTORS).toContain('script');
  });
});
