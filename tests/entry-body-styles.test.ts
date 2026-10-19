import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

/**
 * `/projects/` 与 `/devlog/` 的正文由同一套 markdown 管线生成，但页面此前只加载
 * 页面私有 CSS，弹窗里的代码块工具栏 SVG 没有尺寸、prose 规则也全部缺失。
 */
describe('弹窗 / 行内正文的 Markdown 样式', () => {
  it('projects 与 devlog 页面引入共享的正文样式聚合入口', async () => {
    const [projects, devlog, about, entryBody] = await Promise.all([
      read('src/styles/projects-page.css'),
      read('src/styles/devlog-page.css'),
      read('src/styles/about.css'),
      read('src/styles/components/entry-body.css')
    ]);

    const bits = await read('src/styles/bits-page.css');
    for (const css of [projects, devlog, about, bits]) {
      expect(css).toContain('@import "./components/entry-body.css";');
    }
    for (const part of ['prose.css', 'figure.css', 'callout.css', 'code-block.css']) {
      expect(entryBody).toContain(`@import "./${part}";`);
    }
  });

  it('语言图标与复制状态图标带固有尺寸，CSS 缺失时也不会铺满容器', async () => {
    const [langIcons, toolbar, codeBlock] = await Promise.all([
      read('src/utils/lang-icons.mjs'),
      read('src/plugins/shiki-toolbar.mjs'),
      read('src/styles/components/code-block.css')
    ]);

    expect(langIcons).toContain('width="16" height="16"');
    expect(toolbar).toContain('width: 16');
    expect(toolbar).toContain('height: 16');
    expect(codeBlock).toMatch(/\.code-lang-icon\s*\{[^}]*width:\s*16px/);
    // 代码块规则同时服务正文与 bits 富文本卡片
    expect(codeBlock).toContain(':where(.prose, .bit-body--rich) .code-block');
  });

  it('bits 弹窗正文使用 prose 渲染完整 Markdown', async () => {
    const dialog = await read('src/components/BitDialog.astro');
    expect(dialog).toContain('bit-body bit-dialog__body prose');
  });

  it('项目弹窗与 devlog 展开正文在出现数学公式时加载 KaTeX 样式', async () => {
    const [projects, devlog] = await Promise.all([
      read('src/pages/projects/index.astro'),
      read('src/pages/devlog/index.astro')
    ]);

    for (const page of [projects, devlog]) {
      expect(page).toContain('containsMarkdownMath');
      expect(page).toContain('MARKDOWN_MATH_STYLESHEET_HREF');
      expect(page).toContain('hasMath ?');
    }
  });
});
