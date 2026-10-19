import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  loadAdminContentSourceIndex,
  loadAdminContentSourceManifest
} from '../src/lib/admin-console/content-source-index';

const readSource = (relativePath: string): Promise<string> =>
  readFile(path.join(process.cwd(), relativePath), 'utf8');

const oldProjectRoot = process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;

const writeMarkdown = async (
  root: string,
  collection: 'blog' | 'devlog',
  entryPath: string,
  lines: readonly string[]
): Promise<void> => {
  const directory = path.join(root, 'content', collection, ...entryPath.split('/'));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.md'), lines.join('\n'), 'utf8');
};

describe('admin content devlog project label', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-admin-content-project-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
    await Promise.all([
      writeMarkdown(tempRoot, 'devlog', '2026-05-01-resources-status', [
        '---',
        'title: 修复资源库状态',
        'date: 2026-05-01',
        'project: Whono',
        'kind: fix',
        '---',
        '',
        '资源库状态不再停在准备中。',
        ''
      ]),
      writeMarkdown(tempRoot, 'blog', 'plain-post', [
        '---',
        'title: 普通文章',
        'date: 2026-05-02',
        '---',
        '',
        '没有项目字段。',
        ''
      ])
    ]);
  });

  afterEach(async () => {
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = oldProjectRoot;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('fills project for devlog source index items and keeps it empty elsewhere', async () => {
    const manifest = await loadAdminContentSourceManifest();
    const devlog = (await loadAdminContentSourceIndex(manifest, 'devlog'))[0];
    const blog = (await loadAdminContentSourceIndex(manifest, 'blog'))[0];

    expect(devlog).toMatchObject({
      collection: 'devlog',
      title: '修复资源库状态',
      project: 'Whono'
    });
    expect(devlog?.searchHaystack).toContain('whono');
    expect(blog).toMatchObject({
      collection: 'blog',
      title: '普通文章',
      project: null
    });
  });

  it('renders `项目名: 标题` with an ASCII colon inside the linked title', async () => {
    const row = await readSource('src/components/admin/content/ContentRow.astro');
    const titleLink = /<a class="admin-content-row-title"[\s\S]*?<\/a>/.exec(row)?.[0] ?? '';

    expect(titleLink).toContain("item.collection === 'devlog' && item.project");
    expect(titleLink).toContain('{`${item.project}: `}');
    expect(titleLink).toContain('admin-content-row-project');
    expect(titleLink.trimEnd().endsWith('{item.title}</a>')).toBe(true);
  });

  it('keeps the project prefix muted without raising its weight above the title', async () => {
    const css = await readSource('src/styles/components/admin/content/console.css');
    const project = /\.admin-content-row-project\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(project).toContain('color: var(--muted)');
    expect(project).toContain('font-weight: 400');
    expect(css).toMatch(
      /\.admin-content-row-title:hover \.admin-content-row-project,\s*\.admin-content-row-title:focus-visible \.admin-content-row-project\s*\{[^}]*color: inherit/
    );
  });
});
