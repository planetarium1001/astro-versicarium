import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveCollectionEntryFiles } from '../src/lib/content-entry-files';

let root = '';
let collectionRoot = '';

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'astro-whono-entry-files-'));
  collectionRoot = path.join(root, 'content', 'blog');
  await mkdir(collectionRoot, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const write = async (relativePath: string, content = '---\ntitle: t\n---\n') => {
  const filePath = path.join(collectionRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
};

describe('resolveCollectionEntryFiles', () => {
  it('prefers index.md and ignores attachments/images', async () => {
    await write('a/index.md');
    await write('a/other.md');
    await write('a/images/ignored.md');
    const files = await resolveCollectionEntryFiles(root, collectionRoot);
    expect(files).toHaveLength(1);
    expect(files[0]?.entryId).toBe('a');
    expect(files[0]?.filePath.endsWith('/a/index.md')).toBe(true);
  });

  it('accepts a unique markdown file or a unique entry: true file', async () => {
    await write('unique/only.md');
    await write('flagged/one.md', '---\nentry: true\ntitle: t\n---\n');
    await write('flagged/two.md');
    const files = await resolveCollectionEntryFiles(root, collectionRoot);
    expect(files.map((file) => file.entryId).sort()).toEqual(['flagged', 'unique']);
  });

  it('rejects ambiguous entry files', async () => {
    await write('ambiguous/one.md', '---\nentry: true\ntitle: t\n---\n');
    await write('ambiguous/two.md', '---\nentry: true\ntitle: t\n---\n');
    await expect(resolveCollectionEntryFiles(root, collectionRoot)).rejects.toThrow(/多个|multiple/);
  });

  it('rejects collection-root markdown so every entry has its own directory', async () => {
    await write('root.md');
    await expect(resolveCollectionEntryFiles(root, collectionRoot)).rejects.toThrow(/根级 Markdown/);
  });
});
