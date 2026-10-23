import { describe, expect, it } from 'vitest';
import type { PhrasingContent, Root } from 'mdast';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkSmartypants from 'remark-smartypants';
import { unified } from 'unified';
import { rehypeAboutDirectives, remarkAboutDirectives } from '../src/plugins/about-directives.mjs';
import { remarkLiteralTextDirectives } from '../src/plugins/remark-literal-text-directives.mjs';
import {
  createMarkdownShikiConfig,
  createProjectMarkdownRehypePlugins,
  createProjectMarkdownRemarkPlugins,
  createPublicMarkdownConfig,
  markdownFeatureContract,
  markdownMathOptions,
  markdownRenderingDifferences,
  markdownShikiThemes,
  markdownSmartypantsOptions,
  previewMarkdownRehypeSegments,
  previewMarkdownRemarkSegments,
  publicMarkdownRehypeSegments,
  publicMarkdownRemarkSegments,
  rehypeDeploymentBaseLinks,
  withDeploymentBase
} from '../src/plugins/markdown-pipeline.mjs';
import {
  markdownMathRawOptions,
  rehypeProtectMarkdownMath,
  rehypeRestoreMarkdownMathBoundary
} from '../src/plugins/rehype-markdown-math-boundary.mjs';
import { sanitizeSchema } from '../src/plugins/sanitize-schema.mjs';
import { deriveMarkdownText } from '../src/utils/excerpt';

const pluginOf = (entry: unknown) => (Array.isArray(entry) ? entry[0] : entry);
const optionsOf = (entry: unknown) => (Array.isArray(entry) ? entry[1] : undefined);
const previewSegmentIndex = (id: string) =>
  previewMarkdownRehypeSegments.findIndex((segment) => segment.id === id);
const publicSegmentIndex = (id: string) =>
  publicMarkdownRehypeSegments.findIndex((segment) => segment.id === id);

describe('markdown pipeline contract', () => {
  it('declares the shared markdown feature boundaries', () => {
    expect(markdownFeatureContract.map((feature) => feature.id)).toEqual([
      'callout',
      'math',
      'about-directives',
      'code-block',
      'gfm',
      'smartypants',
      'raw-html-sanitize'
    ]);

    expect(markdownFeatureContract.find((feature) => feature.id === 'math')?.options).toEqual({
      singleDollarTextMath: false
    });
    expect(markdownFeatureContract.find((feature) => feature.id === 'code-block')?.shikiThemes).toEqual({
      light: 'github-light',
      dark: 'github-dark'
    });
    expect(markdownFeatureContract.find((feature) => feature.id === 'raw-html-sanitize')).toMatchObject({
      sanitizeSource: 'src/plugins/sanitize-schema.mjs',
      sanitizeStrategy: 'shared-schema',
      perFeatureSchemaMerge: false
    });
  });

  it('keeps Astro public GFM and smartypants as built-ins instead of public remark plugins', () => {
    const publicConfig = createPublicMarkdownConfig({ base: '/blog/' });
    const { options: processorOptions } = publicConfig.processor;
    const publicRemarkPlugins = processorOptions.remarkPlugins.map(pluginOf);

    expect(publicMarkdownRemarkSegments).toEqual([
      {
        id: 'astro-built-in-remark',
        plugins: ['astro-gfm', 'astro-smartypants'],
        before: 'project-remark'
      },
      {
        id: 'project-remark',
        plugins: [
          'remark-math',
          'remark-directive',
          'remark-literal-text-directives',
          'remark-about-directives',
          'remark-callout'
        ]
      }
    ]);
    expect(publicConfig.processor.name).toBe('unified');
    expect(publicConfig).not.toHaveProperty('remarkPlugins');
    expect(publicConfig).not.toHaveProperty('rehypePlugins');
    expect(processorOptions.gfm).toBeUndefined();
    expect(processorOptions.smartypants).toBeUndefined();
    expect(publicRemarkPlugins).not.toContain(remarkGfm);
    expect(publicRemarkPlugins).not.toContain(remarkSmartypants);
    expect(pluginOf(processorOptions.remarkPlugins[0])).toBe(remarkMath);
    expect(optionsOf(processorOptions.remarkPlugins[0])).toBe(markdownMathOptions);
    expect(optionsOf(processorOptions.rehypePlugins[3])).toEqual({ base: '/blog/' });
  });

  it('documents Astro public rehype order without pretending Shiki is a project rehype plugin', () => {
    expect(publicSegmentIndex('astro-code-highlighting')).toBeLessThan(publicSegmentIndex('project-rehype'));
    expect(publicMarkdownRehypeSegments.find((segment) => segment.id === 'astro-code-highlighting')).toMatchObject({
      provider: 'Astro markdown.shikiConfig',
      excludedLanguages: ['math']
    });
    expect(publicMarkdownRehypeSegments.find((segment) => segment.id === 'project-rehype')).toMatchObject({
      plugins: [
        'rehypeProtectMarkdownMath',
        'rehype-raw',
        'rehypeRestoreMarkdownMathBoundary',
        'rehype-about-directives',
        'rehype-sanitize',
        'rehype-katex'
      ]
    });
  });

  it('declares preview GFM and smartypants before project remark plugins', () => {
    expect(previewMarkdownRemarkSegments.map((segment) => segment.id)).toEqual([
      'preview-parser',
      'preview-astro-built-in-parity',
      'project-remark'
    ]);
    expect(previewMarkdownRemarkSegments[1]).toMatchObject({
      plugins: ['remark-gfm', 'remark-smartypants'],
      before: 'project-remark'
    });
    expect(markdownSmartypantsOptions).toEqual({});
  });

  it('creates shared project remark and rehype plugin entries with explicit about options', () => {
    const remarkPlugins = createProjectMarkdownRemarkPlugins({ aboutEnabled: true });
    const rehypePlugins = createProjectMarkdownRehypePlugins({
      aboutBase: '/blog/',
      aboutEnabled: true
    });

    expect(pluginOf(remarkPlugins[0])).toBe(remarkMath);
    expect(optionsOf(remarkPlugins[0])).toBe(markdownMathOptions);
    expect(pluginOf(remarkPlugins[2])).toBe(remarkLiteralTextDirectives);
    expect(pluginOf(remarkPlugins[3])).toBe(remarkAboutDirectives);
    expect(optionsOf(remarkPlugins[3])).toEqual({ enabled: true });

    expect(pluginOf(rehypePlugins[0])).toBe(rehypeProtectMarkdownMath);
    expect(pluginOf(rehypePlugins[1])).toBe(rehypeRaw);
    expect(optionsOf(rehypePlugins[1])).toBe(markdownMathRawOptions);
    expect(pluginOf(rehypePlugins[2])).toBe(rehypeRestoreMarkdownMathBoundary);
    expect(pluginOf(rehypePlugins[3])).toBe(rehypeAboutDirectives);
    expect(optionsOf(rehypePlugins[3])).toEqual({ base: '/blog/', enabled: true });
    // 内容附件链接改写与部署 base 链接改写依次插在 about directives 与 sanitize 之间。
    expect(rehypePlugins).toHaveLength(8);
    expect(pluginOf(rehypePlugins[4])).not.toBe(rehypeSanitize);
    expect(optionsOf(rehypePlugins[4])).toEqual({ base: '/blog/' });
    expect(pluginOf(rehypePlugins[5])).toBe(rehypeDeploymentBaseLinks);
    expect(optionsOf(rehypePlugins[5])).toEqual({ base: '/blog/' });
    expect(pluginOf(rehypePlugins[6])).toBe(rehypeSanitize);
    expect(optionsOf(rehypePlugins[6])).toBe(sanitizeSchema);
    expect(pluginOf(rehypePlugins[7])).toBe(rehypeKatex);
  });

  it('keeps Shiki themes and toolbar transformer in one public factory', () => {
    const shikiConfig = createMarkdownShikiConfig();

    expect(shikiConfig.themes).toEqual(markdownShikiThemes);
    expect(shikiConfig.transformers).toHaveLength(1);
    expect(shikiConfig.transformers[0]?.name).toBe('astro-whono-code-toolbar');
  });

  it('declares the ordered preview rehype segments that the preview adapter must preserve', () => {
    expect(previewSegmentIndex('preview-outline')).toBeLessThan(previewSegmentIndex('math-boundary-protect'));
    expect(previewSegmentIndex('math-boundary-protect')).toBeLessThan(previewSegmentIndex('code-highlighting'));
    expect(previewSegmentIndex('code-highlighting')).toBeLessThan(previewSegmentIndex('raw-html'));
    expect(previewSegmentIndex('raw-html')).toBeLessThan(previewSegmentIndex('sanitize'));
    expect(previewSegmentIndex('preview-local-image-src')).toBeLessThan(previewSegmentIndex('sanitize'));
    expect(previewSegmentIndex('about-directives')).toBeLessThan(previewSegmentIndex('sanitize'));
    expect(previewSegmentIndex('sanitize')).toBeLessThan(previewSegmentIndex('katex'));
    expect(previewSegmentIndex('katex')).toBeLessThan(previewSegmentIndex('preview-stringify'));
  });

  it('documents the sanitize and heading-id strategies as accepted adapter differences', () => {
    expect(markdownRenderingDifferences.sanitize).toEqual({
      source: 'src/plugins/sanitize-schema.mjs',
      strategy: 'shared-schema',
      perFeatureSchemaMerge: false,
      previewOnlyAllowedAttributes: ['data-admin-outline-key']
    });
    expect(markdownRenderingDifferences.headingId).toEqual({
      acceptedDifference: true,
      public: 'Astro generated heading id',
      preview: 'data-admin-outline-key'
    });
  });
});

/**
 * 卡片摘要走纯文本派生，图片只在弹窗正文里渲染，不得以语法原文漏到卡片上。
 */
describe('弹窗正文的 markdown 图片', () => {
  it('图片正常渲染，且不会进入卡片摘要', () => {
    // sanitize 白名单保留 img 与它的常用属性
    expect(sanitizeSchema.tagNames).toContain('img');
    const imgAttrs = JSON.stringify(sanitizeSchema.attributes?.img ?? []);
    expect(imgAttrs).toContain('src');
    expect(imgAttrs).toContain('alt');

    // 摘要派生剥掉图片语法，只留文字
    const derived = deriveMarkdownText('![封面](/images/projects/demo/cover.webp)\n\n这是正文。');
    expect(derived.plainText).toContain('这是正文。');
    expect(derived.plainText).not.toContain('![');
    expect(derived.plainText).not.toContain('cover.webp');
  });
});

/**
 * 子路径部署（GitHub Pages `/astro-versicarium/`）时，源码里的站内根相对链接必须补上 base；
 * 外链、锚点、查询、相对链接与已带 base 的链接保持不变。
 */
describe('部署 base 链接', () => {
  const BASE = '/astro-versicarium/';

  const renderLinks = async (markdown: string, base: string | undefined) => {
    const processor = unified().use(remarkParse);
    if (base === undefined) {
      processor.use(remarkRehype).use(rehypeDeploymentBaseLinks).use(rehypeStringify);
    } else {
      processor
        .use(remarkRehype)
        .use(rehypeDeploymentBaseLinks, { base })
        .use(rehypeStringify);
    }
    return String(await processor.process(markdown));
  };

  it('给站内根相对链接补 base，其它链接原样保留', async () => {
    const html = await renderLinks(
      [
        '[博客](/blog/2026-10-20-content-model/)',
        '[项目](/projects/#versicarium)',
        '[动态](/devlog/#versicarium-2026-10-20-versicarium-rename)',
        '[站点根](/)',
        '[外链](https://example.com/blog/)',
        '[协议相对](//cdn.example.com/a)',
        '[锚点](#intro)',
        '[查询](?page=2)',
        '[相对](./neighbor/)',
        '[邮件](mailto:me@planetarium1001.com)',
        '[电话](tel:+8613800000000)',
        '[已带 base](/astro-versicarium/blog/2026-10-20-admin-console/)'
      ].join(' '),
      BASE
    );

    expect(html).toContain('href="/astro-versicarium/blog/2026-10-20-content-model/"');
    expect(html).toContain('href="/astro-versicarium/projects/#versicarium"');
    expect(html).toContain(
      'href="/astro-versicarium/devlog/#versicarium-2026-10-20-versicarium-rename"'
    );
    expect(html).toContain('href="/astro-versicarium/"');
    expect(html).toContain('href="https://example.com/blog/"');
    expect(html).toContain('href="//cdn.example.com/a"');
    expect(html).toContain('href="#intro"');
    expect(html).toContain('href="?page=2"');
    expect(html).toContain('href="./neighbor/"');
    expect(html).toContain('href="mailto:me@planetarium1001.com"');
    expect(html).toContain('href="tel:+8613800000000"');
    expect(html).toContain('href="/astro-versicarium/blog/2026-10-20-admin-console/"');
    expect(html).not.toContain('/astro-versicarium/astro-versicarium');
  });

  it('给正文图片、source 与 srcset 补 base，外部与 data 地址保留', async () => {
    const html = String(
      await unified()
        .use(remarkParse)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeDeploymentBaseLinks, { base: BASE })
        .use(rehypeStringify)
        .process(
          [
            '![归档页](/images/demo/archive.png)',
            '',
            '<figure><source srcset="/images/pages/a.webp 1x, /images/pages/b.webp 2x" type="image/webp" />',
            '<img src="/images/pages/c.webp" alt="c" />',
            '<img src="https://example.com/d.png" alt="d" /></figure>'
          ].join('\n')
        )
    );

    expect(html).toContain('src="/astro-versicarium/images/demo/archive.png"');
    expect(html).toContain('/astro-versicarium/images/pages/a.webp 1x');
    expect(html).toContain('/astro-versicarium/images/pages/b.webp 2x');
    expect(html).toContain('src="/astro-versicarium/images/pages/c.webp"');
    expect(html).toContain('src="https://example.com/d.png"');
    expect(html).not.toContain('/astro-versicarium/astro-versicarium');
  });

  it('base 为根路径时不改写任何链接', async () => {
    const html = await renderLinks('[博客](/blog/a/) [外链](https://example.com/)', '/');
    expect(html).toContain('href="/blog/a/"');
    expect(html).toContain('href="https://example.com/"');
  });

  it('withDeploymentBase 归一化 base 并避免重复前缀', () => {
    expect(withDeploymentBase('/blog/a/', '/astro-versicarium/')).toBe(
      '/astro-versicarium/blog/a/'
    );
    expect(withDeploymentBase('/blog/a/', 'astro-versicarium')).toBe(
      '/astro-versicarium/blog/a/'
    );
    expect(withDeploymentBase('/', BASE)).toBe(BASE);
    expect(withDeploymentBase('/astro-versicarium', BASE)).toBe('/astro-versicarium');
    expect(withDeploymentBase('/astro-versicarium/', BASE)).toBe('/astro-versicarium/');
    expect(withDeploymentBase('/blog/a/', '/')).toBe('/blog/a/');
    expect(withDeploymentBase('//cdn.example.com/a', BASE)).toBe('//cdn.example.com/a');
    expect(withDeploymentBase('https://example.com/a', BASE)).toBe('https://example.com/a');
  });
});

/**
 * remark-directive 会把时间写法里的 `:MM` 当成文本指令，渲染成空元素并拆开段落。
 * 主题不认识的文本指令必须还原成原文；about 页的已知指令保持原样。
 */
describe('文本指令与正文时间', () => {
  const parseWithDirectives = (markdown: string): Root => {
    const processor = unified().use(remarkParse).use(remarkDirective).use(remarkLiteralTextDirectives);
    return processor.runSync(processor.parse(markdown)) as Root;
  };

  const firstParagraphChildren = (tree: Root): PhrasingContent[] => {
    const paragraph = tree.children[0];
    if (!paragraph || paragraph.type !== 'paragraph') throw new Error('expected paragraph');
    return paragraph.children;
  };

  const textContent = (children: PhrasingContent[]) =>
    children
      .filter((node) => node.type === 'text')
      .map((node) => (node as { value: string }).value)
      .join('');

  it('把时间写法里的冒号还原为正文', () => {
    const children = firstParagraphChildren(parseWithDirectives('10-22 00:34 的 `185c2be` 只做一件事。'));
    expect(textContent(children)).toContain('10-22 00:34 的');
    expect(children.some((node) => node.type === 'textDirective')).toBe(false);
  });

  it('保留 about 页的已知文本指令', () => {
    const children = firstParagraphChildren(
      parseWithDirectives(':friend[示例站]{name="示例" url="https://example.com"}')
    );
    expect(children[0]).toMatchObject({ type: 'textDirective', name: 'friend' });
  });

  it('还原没有标签的文本指令写法', () => {
    const children = firstParagraphChildren(parseWithDirectives('共 :30 分钟。'));
    expect(textContent(children)).toBe('共 :30 分钟。');
  });
});
