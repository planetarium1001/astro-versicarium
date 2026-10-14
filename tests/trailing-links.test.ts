import { describe, expect, it } from 'vitest';
import {
  parseTrailingLinks,
  renderTrailingLinksHtml,
  stripTrailingLinks
} from '../src/lib/trailing-links';

describe('parseTrailingLinks', () => {
  it('按书写顺序解析连续多行链接组', () => {
    const body = [
      '正文第一段。',
      '',
      '[迁移说明1](https://example.com/a)',
      '[迁移说明2](https://example.com/b)',
      '[迁移说明3](https://example.com/c)'
    ].join('\n');

    expect(parseTrailingLinks(body)).toEqual([
      { label: '迁移说明1', href: 'https://example.com/a' },
      { label: '迁移说明2', href: 'https://example.com/b' },
      { label: '迁移说明3', href: 'https://example.com/c' }
    ]);
  });

  it('一行多个链接按出现顺序返回，分隔符被丢弃', () => {
    expect(
      parseTrailingLinks('正文\n\n[仓库](https://example.com/repo) · [演示](https://example.com/demo)')
    ).toEqual([
      { label: '仓库', href: 'https://example.com/repo' },
      { label: '演示', href: 'https://example.com/demo' }
    ]);
    expect(parseTrailingLinks('正文\n\n[a](https://a.com)、[b](https://b.com)/[c](https://c.com)')).toHaveLength(3);
  });

  it('忽略末尾空行与 CRLF', () => {
    expect(parseTrailingLinks('正文\r\n\r\n[仓库](https://example.com/repo)\r\n\r\n')).toEqual([
      { label: '仓库', href: 'https://example.com/repo' }
    ]);
  });

  it('正文中间的链接、缺少空行、链接行后仍有正文都不算末尾链接组', () => {
    // 正文中间的同名语法按普通 markdown 链接渲染
    expect(parseTrailingLinks('正文\n\n见 [仓库](https://example.com/repo) 说明')).toEqual([]);
    expect(parseTrailingLinks('正文\n[A](https://a.com)')).toEqual([]);
    expect(parseTrailingLinks('正文\n\n[A](https://a.com)\n正文继续')).toEqual([]);
    expect(parseTrailingLinks('')).toEqual([]);
    expect(parseTrailingLinks(null)).toEqual([]);
  });

  it('只有链接组的正文也算末尾链接组', () => {
    expect(parseTrailingLinks('[仓库](https://example.com/repo)')).toHaveLength(1);
  });

  it('丢弃非白名单协议的链接（链接行不经过 rehype-sanitize）', () => {
    expect(
      parseTrailingLinks('正文\n\n[仓库](https://example.com/repo)\n[危险](javascript:alert(1))')
    ).toEqual([{ label: '仓库', href: 'https://example.com/repo' }]);
    expect(parseTrailingLinks('正文\n\n[信](mailto:a@example.com)')).toHaveLength(1);
  });
});

describe('stripTrailingLinks', () => {
  it('去掉链接组及其前置空行', () => {
    const body = ['正文第一段。', '', '## 小标题', '', '[仓库](https://example.com/repo)', '[演示](https://example.com/demo)'].join('\n');
    expect(stripTrailingLinks(body)).toBe('正文第一段。\n\n## 小标题');
  });

  it('没有末尾链接组时原样返回', () => {
    const body = '正文\n\n见 [仓库](https://example.com/repo) 说明';
    expect(stripTrailingLinks(body)).toBe(body);
  });

  it('正文只有链接组时返回空串', () => {
    expect(stripTrailingLinks('[仓库](https://example.com/repo)')).toBe('');
  });
});

describe('renderTrailingLinksHtml', () => {
  it('输出统一的链接行标记，链接之间没有分隔符', () => {
    const html = renderTrailingLinksHtml([
      { label: '仓库', href: 'https://example.com/repo' },
      { label: '演示', href: 'https://example.com/demo' }
    ]);
    expect(html).toBe(
      '<p class="trailing-links"><a href="https://example.com/repo">仓库</a><a href="https://example.com/demo">演示</a></p>'
    );
    expect(html).not.toContain('·');
    expect(renderTrailingLinksHtml([])).toBe('');
  });

  it('转义链接文字与地址里的 HTML 字符', () => {
    expect(renderTrailingLinksHtml([{ label: 'a<b>&"c', href: 'https://example.com/?a=1&b=2' }])).toBe(
      '<p class="trailing-links"><a href="https://example.com/?a=1&amp;b=2">a&lt;b&gt;&amp;&quot;c</a></p>'
    );
  });
});
