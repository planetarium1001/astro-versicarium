import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { patchMarkdownFrontmatter, replaceMarkdownBody, splitMarkdownFrontmatter } from '../src/lib/frontmatter';
import { buildBlogFrontmatterFromValues } from '../src/lib/admin-console/content-blog-frontmatter';
import type { AdminBlogEditorValues } from '../src/lib/admin-console/content-editor-payload';

const toBlogEditorValues = (overrides: Partial<AdminBlogEditorValues> = {}): AdminBlogEditorValues => ({
  title: 'Demo blog',
  description: '',
  date: '2026-11-09',
  publishedAt: '',
  updatedAt: '',
  tagsText: '',
  draft: false,
  slug: '',
  versionGroup: '',
  versionLabel: '',
  versionName: '',
  versionSummary: '',
  versionOrder: '',
  series: '',
  seriesName: '',
  seriesOrder: '',
  ogImage: '',
  ogImageAlt: '',
  badge: '',
  ...overrides
});

const getFrontmatter = (source: string): Record<string, unknown> => {
  const section = splitMarkdownFrontmatter(source);
  return YAML.parse(section.frontmatterText ?? '') as Record<string, unknown>;
};

describe('admin-console/frontmatter', () => {
  it('keeps markdown body byte-identical when only frontmatter changes', () => {
    const source = [
      '---',
      'title: Old Title',
      'date: 2026-03-18',
      '---',
      '',
      '# Heading',
      '',
      '正文保持不变。',
      ''
    ].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: 'New Title', action: 'set' }
    ]);

    const before = splitMarkdownFrontmatter(source);
    const after = splitMarkdownFrontmatter(next);

    expect(after.bodyText).toBe(before.bodyText);
    expect(getFrontmatter(next).title).toBe('New Title');
  });

  it('replaces markdown body while keeping the frontmatter block byte-identical', () => {
    const source = [
      '---',
      'title: Old Title',
      'description: "A&B: #hash"',
      'date: 2026-03-18',
      '---',
      '',
      '# Old body',
      ''
    ].join('\n');

    const nextBody = ['# New body', '', '正文已更新。', ''].join('\n');
    const next = replaceMarkdownBody(source, nextBody);

    expect(splitMarkdownFrontmatter(next).frontmatterBlock).toBe(splitMarkdownFrontmatter(source).frontmatterBlock);
    expect(splitMarkdownFrontmatter(next).bodyText).toBe(nextBody);
  });

  it('round-trips Chinese text without corrupting YAML', () => {
    const source = ['---', 'title: 旧标题', '---', '', '正文', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: '中文标题：后台演进', action: 'set' }
    ]);

    expect(getFrontmatter(next).title).toBe('中文标题：后台演进');
  });

  it('round-trips special characters in scalar fields', () => {
    const source = ['---', 'description: old', '---', '', 'body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['description'], value: 'A&B: "quotes" #hash ?query', action: 'set' }
    ]);

    expect(getFrontmatter(next).description).toBe('A&B: "quotes" #hash ?query');
  });

  it('writes multiline strings as valid YAML while preserving body', () => {
    const source = ['---', 'description: old', '---', '', 'line-1', 'line-2', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['description'], value: '第一行\n第二行\n第三行', action: 'set' }
    ]);

    expect(getFrontmatter(next).description).toBe('第一行\n第二行\n第三行');
    expect(splitMarkdownFrontmatter(next).bodyText).toBe(splitMarkdownFrontmatter(source).bodyText);
  });

  it('adds fields into an empty frontmatter block', () => {
    const source = ['---', '---', '', 'body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: 'From Empty Frontmatter', action: 'set' }
    ]);

    expect(getFrontmatter(next).title).toBe('From Empty Frontmatter');
  });

  it('creates a frontmatter block when the markdown file had none', () => {
    const source = ['# Plain Markdown', '', 'without frontmatter', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['title'], value: 'Generated Frontmatter', action: 'set' }
    ]);

    expect(getFrontmatter(next).title).toBe('Generated Frontmatter');
    expect(splitMarkdownFrontmatter(next).bodyText).toBe(source);
  });

  it('keeps timezone date values intact when they are updated', () => {
    const source = ['---', 'date: 2025-02-03T01:01:45+08:00', '---', '', 'body', ''].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['date'], value: '2026-02-03T22:30:00+08:00', action: 'set' }
    ]);

    expect(getFrontmatter(next).date).toBe('2026-02-03T22:30:00+08:00');
  });

  it('round-trips YAML arrays and nested image objects', () => {
    const source = [
      '---',
      'tags:',
      '  - Markdown',
      'images:',
      '  - src: bits/demo.webp',
      '    width: 800',
      '    height: 600',
      '---',
      '',
      'body',
      ''
    ].join('\n');

    const next = patchMarkdownFrontmatter(source, [
      { path: ['tags'], value: ['Markdown', '示例'], action: 'set' },
      {
        path: ['images'],
        value: [
          { src: 'bits/demo.webp', width: 800, height: 600, alt: 'demo' },
          { src: 'https://example.com/hero.webp', width: 1200, height: 630 }
        ],
        action: 'set'
      }
    ]);

    expect(getFrontmatter(next).tags).toEqual(['Markdown', '示例']);
    expect(getFrontmatter(next).images).toEqual([
      { src: 'bits/demo.webp', width: 800, height: 600, alt: 'demo' },
      { src: 'https://example.com/hero.webp', width: 1200, height: 630 }
    ]);
  });

});

describe('admin blog frontmatter from editor values', () => {
  it('keeps the time part of updatedAt instead of compressing it to a date', () => {
    const { frontmatter, issues } = buildBlogFrontmatterFromValues(
      toBlogEditorValues({ updatedAt: '2026-11-09 14:30' })
    );

    expect(issues).toEqual([]);
    expect(frontmatter?.updatedAt).toBe('2026-11-09 14:30');
  });

  it('normalizes a changed updatedAt into site timezone text', () => {
    const { frontmatter, issues } = buildBlogFrontmatterFromValues(
      toBlogEditorValues({ updatedAt: '2026-11-09T06:30Z' }),
      { originalUpdatedAt: '2026-11-08' }
    );

    expect(issues).toEqual([]);
    expect(frontmatter?.updatedAt).toBe('2026-11-09 14:30');
  });

  it('keeps the original updatedAt text when the instant did not change', () => {
    const original = '2026-11-09T03:44Z';
    const { frontmatter, issues } = buildBlogFrontmatterFromValues(
      toBlogEditorValues({ updatedAt: '2026-11-09 11:44' }),
      { originalUpdatedAt: original }
    );

    // 作者提交的文本与原文指向同一时刻时保留原文，避免无意义 diff。
    expect(issues).toEqual([]);
    expect(frontmatter?.updatedAt).toBe(original);
  });

  it('rejects an updatedAt earlier than the blog date', () => {
    const { frontmatter, issues } = buildBlogFrontmatterFromValues(
      toBlogEditorValues({ updatedAt: '2026-11-08 23:30' })
    );

    expect(frontmatter).toBeUndefined();
    expect(issues).toEqual([expect.objectContaining({ path: 'updatedAt' })]);
  });

  it('accepts every supported publishedAt text', () => {
    const inputs = [
      '2026-11-09',
      '2026-11-09 14:30',
      '2026-11-09T14:30',
      '2026-11-09T06:30Z',
      '2026-11-09T14:30+08:00'
    ];

    for (const publishedAt of inputs) {
      const { frontmatter, issues } = buildBlogFrontmatterFromValues(
        toBlogEditorValues({ publishedAt })
      );
      expect(issues, publishedAt).toEqual([]);
      expect(frontmatter?.publishedAt, publishedAt).toBe(publishedAt);
    }
  });

  it('rejects an unreadable publishedAt text', () => {
    const { frontmatter, issues } = buildBlogFrontmatterFromValues(
      toBlogEditorValues({ publishedAt: '下周一' })
    );

    expect(frontmatter).toBeUndefined();
    expect(issues).toEqual([expect.objectContaining({ path: 'publishedAt' })]);
  });

  it('writes versionGroup and the three series fields independently', () => {
    const { frontmatter, issues } = buildBlogFrontmatterFromValues(
      toBlogEditorValues({
        versionGroup: 'theme-introduction',
        versionLabel: 'v2',
        series: 'pc-build',
        seriesName: '折腾主机',
        seriesOrder: '2'
      })
    );

    expect(issues).toEqual([]);
    expect(frontmatter).toMatchObject({
      versionGroup: 'theme-introduction',
      versionLabel: 'v2',
      series: 'pc-build',
      seriesName: '折腾主机',
      seriesOrder: 2
    });
  });

  it('drops series fields when the author clears them', () => {
    const { frontmatter, issues } = buildBlogFrontmatterFromValues(
      toBlogEditorValues({ versionGroup: 'theme-introduction' })
    );

    expect(issues).toEqual([]);
    expect(frontmatter).not.toHaveProperty('series');
    expect(frontmatter).not.toHaveProperty('seriesName');
    expect(frontmatter).not.toHaveProperty('seriesOrder');
  });

  it('rejects a seriesOrder that is not a non-negative integer', () => {
    for (const seriesOrder of ['-1', '2.5', 'abc']) {
      const { frontmatter, issues } = buildBlogFrontmatterFromValues(
        toBlogEditorValues({ series: 'pc-build', seriesOrder })
      );
      expect(issues, seriesOrder).toEqual([
        expect.objectContaining({ path: 'seriesOrder', message: 'seriesOrder 必须是非负整数' })
      ]);
      expect(frontmatter, seriesOrder).toBeUndefined();
    }
  });
});
