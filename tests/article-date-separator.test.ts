import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

describe('文章日期分隔符', () => {
  it('首页 / 博客卡片 / 文章详情共用带 class 的日期分隔点', async () => {
    for (const file of [
      'src/components/EntryListItem.astro',
      'src/components/BlogCard.astro',
      'src/layouts/ArticleLayout.astro'
    ]) {
      const source = await read(file);
      expect(source, file).toContain('<span class="meta-line__sep" aria-hidden="true">·</span>');
      expect(source, file).not.toContain('<span aria-hidden="true"> · </span>');
    }
  });

  it('日期分隔点与条目之间的点使用同一份外边距', async () => {
    const css = await read('src/styles/components/lists.css');
    expect(css).toMatch(/\.meta-line\s*\{[^}]*--meta-line-sep-gap:\s*0\.6em/);
    expect(css).toMatch(/\.meta-line__sep\s*\{[^}]*margin:\s*0 var\(--meta-line-sep-gap\)/);
    expect(css).toMatch(/\.meta-line__item \+ \.meta-line__item::before\s*\{[^}]*margin:\s*0 var\(--meta-line-sep-gap\)/);
  });
});
