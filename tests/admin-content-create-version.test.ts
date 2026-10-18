import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAdminBlogVersion } from '../src/lib/admin-console/content-create-version';
import { splitMarkdownFrontmatter } from '../src/lib/frontmatter';

let tempRoot = '';

const writeEntry = async (
  entryId: string,
  frontmatter: string,
  files: Record<string, string> = {}
) => {
  const directory = path.join(tempRoot, 'content', 'blog', entryId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.md'), `---\n${frontmatter}\n---\n\nbody\n`, 'utf8');
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(directory, name);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }
};

describe('createAdminBlogVersion', () => {
  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-version-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
    await writeEntry('2026-01-01-post-v1', [
      'title: Series post',
      'date: 2026-01-01',
      'series: post',
      'slug: post',
      'versionLabel: v1',
      'versionOrder: 1',
      'draft: false'
    ].join('\n'));
    await writeEntry('2026-02-01-post-v2', [
      'title: Series post',
      'date: 2026-02-01',
      'series: post',
      'slug: post',
      'versionLabel: v2',
      'versionOrder: 2',
      'draft: false'
    ].join('\n'), {
      'images/cover.webp': 'cover'
    });
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('copies the latest version, keeps the series slug, and creates a draft version', async () => {
    const result = await createAdminBlogVersion({ entryId: '2026-01-01-post-v1' });
    const source = await readFile(path.join(tempRoot, result.relativePath), 'utf8');
    const frontmatter = splitMarkdownFrontmatter(source).frontmatterText ?? '';

    expect(result.entryId).toContain('2026-');
    expect(frontmatter).toContain('series: post');
    expect(frontmatter).toContain('slug: post');
    expect(frontmatter).toContain('versionOrder: 3');
    expect(frontmatter).toContain('draft: true');
    expect(frontmatter).not.toContain('publishedAt');
    await expect(
      readFile(path.join(tempRoot, 'content', 'blog', result.entryId, 'images', 'cover.webp'), 'utf8')
    ).resolves.toBe('cover');
  });
});
