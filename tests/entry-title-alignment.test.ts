import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

describe('条目胶囊与标题第一行垂直对齐', () => {
  it('共享样式用行高与胶囊高度计算顶部偏移，而不是基线裸对齐', async () => {
    const css = await read('src/styles/components/lists.css');

    expect(css).toMatch(/\.entry-title \{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.entry-title \{[^}]*align-items:\s*baseline/);
    expect(css).toMatch(
      /\.entry-title \.entry-title__badge,\s*\n\.entry-title \.entry-title__version-label \{[^}]*align-self:\s*flex-start/
    );
    expect(css).toMatch(
      /margin-top:\s*calc\(\s*\(var\(--entry-title-font-size\) \* var\(--entry-title-line-height\) - var\(--entry-pill-height\)\) \/ 2\s*\)/
    );
    // 覆盖 .badge 的 top:1px，让分类胶囊与版本胶囊同一套对齐。
    expect(css).toMatch(/\.entry-title \.entry-title__badge,[\s\S]*?top:\s*0/);
  });

  it('列表 / 归档 / 项目分别声明字号、行高、间隙与胶囊高度', async () => {
    const [lists, projects] = await Promise.all([
      read('src/styles/components/lists.css'),
      read('src/styles/projects-page.css')
    ]);

    expect(lists).toMatch(/\.entry-title--archive \{[^}]*--entry-title-font-size:\s*15px/);
    expect(lists).toMatch(/\.entry-title--archive \{[^}]*--entry-title-gap:\s*8px/);
    expect(projects).toMatch(/\.project-card__title-row \{[^}]*--entry-title-font-size:\s*16px/);
    expect(projects).toMatch(/\.project-dialog__title-row \{[^}]*--entry-title-font-size:\s*21px/);
  });

  it('首页 critical CSS 同步同一套对齐公式', async () => {
    const index = await read('src/pages/index.astro');

    expect(index).toMatch(/\.entry-title \{[^}]*--entry-pill-height:\s*24px/);
    expect(index).toMatch(
      /margin-top:\s*calc\(\s*\(var\(--entry-title-font-size\) \* var\(--entry-title-line-height\) - var\(--entry-pill-height\)\) \/ 2\s*\)/
    );
    expect(index).not.toContain('entry-format');
  });

  it('源码里不再残留旧的条目格式类名与设置键', async () => {
    const pages = await Promise.all([
      read('src/pages/archive/index.astro'),
      read('src/pages/index.astro'),
      read('src/components/BlogCard.astro'),
      read('src/components/EntryListItem.astro'),
      read('src/pages/projects/index.astro')
    ]);

    for (const page of pages) {
      expect(page).not.toContain('EntryFormatLine');
      expect(page).not.toContain('entry-format');
    }
  });
});
