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

  it('tags 组前的点不再叠加 margin-right 与 flex gap', async () => {
    const css = await read('src/styles/components/lists.css');
    expect(css).toMatch(/\.meta-line\s*\{[^}]*--meta-line-tag-gap:\s*0\.65em/);
    expect(css).toMatch(/\.meta-line__item--tags\s*\{[^}]*gap:\s*var\(--meta-line-tag-gap\)/);

    const genericDot = css.indexOf('.meta-line__item + .meta-line__item::before');
    const tagDot = css.indexOf('.meta-line--items .meta-line__item--tags::before');
    expect(genericDot).toBeGreaterThanOrEqual(0);
    expect(tagDot).toBeGreaterThan(genericDot);

    const tagDotRule = css.slice(tagDot, css.indexOf('}', tagDot) + 1);
    expect(tagDotRule).toContain('margin-left: var(--meta-line-sep-gap)');
    expect(tagDotRule).toContain('margin-right: 0');
  });

  it('首页 critical CSS 与全局列表的 tag 间距一致', async () => {
    const home = await read('src/pages/index.astro');
    expect(home).toMatch(/\.meta-line\s*\{[^}]*--meta-line-tag-gap:\s*0\.65em/);
    expect(home).toMatch(/\.meta-line--items \.meta-line__item--tags::before\s*\{[^}]*margin-right:\s*0/);
    expect(home).not.toContain('margin: 0 0.45em');
  });

  it('后台预览的 tag 之间使用单个 NBSP', async () => {
    const codec = await read('src/scripts/admin-console/form-codec.ts');
    expect(codec).toContain("ARTICLE_META_PREVIEW_TAGS.join('\\u00A0')");
    expect(codec).not.toContain("ARTICLE_META_PREVIEW_TAGS.join('\\u00A0\\u00A0')");

    const section = await read('src/components/admin/AdminPageSection.astro');
    expect(section).toContain('\\u00A0#写作');
    expect(section).not.toContain('\\u00A0\\u00A0#写作');
  });
});
