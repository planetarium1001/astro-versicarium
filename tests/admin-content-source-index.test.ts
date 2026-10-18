import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  getAdminContentSourceCounts,
  loadAdminContentSourceIndex,
  loadAdminContentSourceIndexWithBody,
  loadAdminContentSourceManifest
} from '../src/lib/admin-console/content-source-index';
import { formatDateTimeInTimeZone } from '../src/utils/format';
import { DEFAULT_SITE_TIMEZONE } from '../site.config.mjs';

const { deriveMarkdownTextMock, readFileMock } = vi.hoisted(() => ({
  deriveMarkdownTextMock: vi.fn(),
  readFileMock: vi.fn()
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  readFileMock.mockImplementation(actual.readFile);
  return {
    ...actual,
    readFile: readFileMock
  };
});

vi.mock('../src/utils/excerpt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/excerpt')>();
  deriveMarkdownTextMock.mockImplementation(actual.deriveMarkdownText);
  return {
    ...actual,
    deriveMarkdownText: deriveMarkdownTextMock
  };
});

const oldProjectRoot = process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;

const dedent = (value: string): string => {
  const lines = value.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(minIndent)).join('\n');
};

const markdown = (frontmatter: string, body = '') => [
  '---',
  dedent(frontmatter),
  '---',
  body
].join('\n');

describe('admin-console/content-source-index', () => {
  let tempRoot = '';

  beforeEach(async () => {
    deriveMarkdownTextMock.mockClear();
    readFileMock.mockClear();
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-admin-content-source-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
    await Promise.all([
      mkdir(path.join(tempRoot, 'content/blog'), { recursive: true }),
      mkdir(path.join(tempRoot, 'content/bits'), { recursive: true }),
      mkdir(path.join(tempRoot, 'content/about'), { recursive: true })
    ]);
  });

  afterEach(async () => {
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = oldProjectRoot;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  const writeContent = async (collection: 'blog' | 'bits' | 'about', entryPath: string, sourceText: string) => {
    const filePath = path.join(tempRoot, 'content', collection, ...entryPath.split('/'));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, sourceText, 'utf8');
    return filePath;
  };

  it('loads a .md-only manifest and derives counts without reparsing frontmatter', async () => {
    await writeContent('blog', 'plain/index.md', markdown('title: Plain\ndate: 2026-05-01'));
    await writeContent('blog', 'nested/index.md', markdown('title: Nested\ndate: 2026-05-02'));
    await writeContent('blog', 'draft/index.mdx', markdown('title: MDX\ndate: 2026-05-03'));
    await writeContent('bits', 'bit/index.md', markdown('date: 2026-05-01T12:00:00.000Z'));

    const manifest = await loadAdminContentSourceManifest();

    expect(getAdminContentSourceCounts(manifest)).toEqual({
      blog: 2,
      projects: 0,
      bits: 1,
      devlog: 0,
      about: 0
    });
    expect(manifest.blog.every((filePath) => filePath.endsWith('.md'))).toBe(true);
    expect(manifest.blog.some((filePath) => filePath.endsWith('.mdx'))).toBe(false);
  });

  it('builds source index items with stable source identity and public fields', async () => {
    await writeContent('blog', 'Space Name/index.md', markdown(`
      title: Source blog
      description: blog description
      date: 2026-05-01
      tags: [Astro, Admin]
      draft: false
      slug: source-blog
    `));
    await writeContent('bits', 'bits-2026-05-01-1200/index.md', markdown(`
      title: Source Bit
      description: Bit description
      date: 2026-05-01T12:00:00.000Z
      tags: [Bits]
      draft: false
      author:
        name: Writer
        avatar: author/avatar.webp
    `));
    await writeContent('about', 'index.md', markdown('', 'About body text.'));

    const manifest = await loadAdminContentSourceManifest();
    const blog = (await loadAdminContentSourceIndex(manifest, 'blog'))[0];
    const bit = (await loadAdminContentSourceIndex(manifest, 'bits'))[0];
    const about = (await loadAdminContentSourceIndex(manifest, 'about'))[0];

    expect(blog).toMatchObject({
      collection: 'blog',
      id: 'Space Name',
      publicEntryId: 'space-name',
      title: 'Source blog',
      slug: 'source-blog',
      relativePath: 'content/blog/Space Name/index.md',
      publicHref: '/blog/source-blog/',
      isDraft: false,
      dateLabel: '2026-05-01',
      year: 2026,
      tags: ['Astro', 'Admin'],
      sourceError: null
    });
    expect(bit).toMatchObject({
      collection: 'bits',
      id: 'bits-2026-05-01-1200',
      publicHref: '/bits/#bit-bits-2026-05-01-1200',
      slug: 'bits-2026-05-01-1200',
      title: 'Source Bit',
      tags: ['Bits'],
      sourceError: null
    });
    expect(bit?.searchHaystack).toContain('writer');
    expect(bit?.searchHaystack).toContain('author/avatar.webp');
    expect(about).toMatchObject({
      collection: 'about',
      id: 'index',
      publicHref: '/about/',
      readonlyReason: null,
      title: '关于',
      slug: 'about',
      date: null,
      year: null,
      tags: [],
      sourceError: null
    });
    expect(about?.dateLabel).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(about?.dateLabel).not.toBe('固定单页');
    expect(about?.searchHaystack).toContain('关于');
    expect(about?.searchHaystack).not.toContain('About body text');
  });

  it('keeps collection-specific date semantics in source index items', async () => {
    const bitsDateText = '2025-01-01T00:30:00+08:00';
    const bitsDate = new Date(bitsDateText);
    await writeContent('blog', 'legacy-datetime/index.md', markdown(`
      title: Legacy Datetime blog
      date: 2025-01-01T00:30:00+08:00
    `));
    await writeContent('bits', 'timezone-edge/index.md', markdown(`
      title: Timezone Edge Bit
      date: ${bitsDateText}
    `));

    const manifest = await loadAdminContentSourceManifest();
    const blog = (await loadAdminContentSourceIndex(manifest, 'blog'))[0];
    const bit = (await loadAdminContentSourceIndex(manifest, 'bits'))[0];

    expect(blog).toMatchObject({
      dateLabel: '2025-01-01',
      year: 2025
    });
    expect(bit).toMatchObject({
      dateLabel: formatDateTimeInTimeZone(bitsDate, DEFAULT_SITE_TIMEZONE),
      year: 2025
    });
  });

  it('uses the published bits routing helper for draft exclusion and page boundaries', async () => {
    await writeContent('bits', 'draft-newest/index.md', markdown(`
      title: Draft
      date: 2026-06-01T00:00:00.000Z
      draft: true
    `));

    await Promise.all(
      Array.from({ length: 21 }, (_, index) => {
        const day = String(31 - index).padStart(2, '0');
        return writeContent('bits', `published-${String(index + 1).padStart(2, '0')}/index.md`, markdown(`
          title: Published ${index + 1}
          date: 2026-05-${day}T00:00:00.000Z
          draft: false
        `));
      })
    );

    const manifest = await loadAdminContentSourceManifest();
    const items = await loadAdminContentSourceIndex(manifest, 'bits');

    expect(items.find((item) => item.id === 'draft-newest')?.publicHref).toBeNull();
    expect(items.find((item) => item.id === 'published-01')?.publicHref).toBe('/bits/#bit-published-01');
    expect(items.find((item) => item.id === 'published-21')?.publicHref).toBe('/bits/#bit-published-21');
  });

  it('keeps malformed frontmatter and missing required fields as placeholder rows', async () => {
    await writeContent('blog', 'bad-yaml/index.md', '---\ntitle: [\n---\nBody');
    await writeContent('bits', 'missing-date/index.md', markdown('title: Missing date'));

    const manifest = await loadAdminContentSourceManifest();
    const blog = (await loadAdminContentSourceIndex(manifest, 'blog'))[0];
    const bit = (await loadAdminContentSourceIndex(manifest, 'bits'))[0];

    expect(blog?.id).toBe('bad-yaml');
    expect(blog?.title).toBe('bad-yaml');
    expect(blog?.sourceError).toContain('解析');
    expect(blog?.sourceError).not.toContain('blog.title');
    expect(blog?.sourceError).not.toContain('blog.date');
    expect(blog?.dateLabel).toBe('源文件异常');
    expect(bit?.id).toBe('missing-date');
    expect(bit?.sourceError).toContain('bits.date');
    expect(bit?.dateLabel).toBe('未设置日期');
    expect(bit?.publicHref).toBeNull();
  });

  it('derives body text only for body-augmented index calls', async () => {
    await writeContent('bits', 'untitled/index.md', markdown(`
      date: 2026-05-01T00:00:00.000Z
      draft: false
    `, 'Body-only marker for untitled bits.'));

    const manifest = await loadAdminContentSourceManifest();
    readFileMock.mockClear();
    const metadataOnly = (await loadAdminContentSourceIndex(manifest, 'bits'))[0];

    expect(readFileMock).not.toHaveBeenCalled();

    const withBody = (await loadAdminContentSourceIndexWithBody(manifest, 'bits'))[0];

    expect(metadataOnly?.title).toBe('untitled');
    expect(metadataOnly?.searchHaystack).not.toContain('body-only marker');
    expect('bodyDerived' in (metadataOnly ?? {})).toBe(false);
    expect(withBody?.title).toContain('Body-only marker');
    expect(withBody?.searchHaystack).toContain('body-only marker');
    expect(withBody?.bodyDerived.plainText).toBe('Body-only marker for untitled bits.');
    expect(deriveMarkdownTextMock).toHaveBeenCalledTimes(1);
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it('uses about body text only in the body-augmented fixed-page index', async () => {
    await writeContent('about', 'index.md', markdown('legacyField: ignored', 'Body-only about marker.'));

    const manifest = await loadAdminContentSourceManifest();
    const metadataOnly = (await loadAdminContentSourceIndex(manifest, 'about'))[0];
    const withBody = (await loadAdminContentSourceIndexWithBody(manifest, 'about'))[0];

    expect(metadataOnly?.searchHaystack).not.toContain('body-only about marker');
    expect(metadataOnly?.searchHaystack).not.toContain('legacyfield');
    expect(withBody?.bodyDerived.plainText).toBe('Body-only about marker.');
    expect(withBody?.searchHaystack).toContain('body-only about marker');
    expect(withBody?.searchHaystack).not.toContain('legacyfield');
  });

  it('treats the manifest as a page-request snapshot', async () => {
    await writeContent('blog', 'first/index.md', markdown('title: First\ndate: 2026-05-01'));
    const manifest = await loadAdminContentSourceManifest();
    await writeContent('blog', 'second/index.md', markdown('title: Second\ndate: 2026-05-02'));

    expect(getAdminContentSourceCounts(manifest).blog).toBe(1);
    expect(await loadAdminContentSourceIndex(manifest, 'blog')).toHaveLength(1);
    expect(getAdminContentSourceCounts(await loadAdminContentSourceManifest()).blog).toBe(2);
  });
});
