import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  resolveContentAssetReference,
  toContentAssetUrl,
  stripBasePath
} from '../src/lib/content-asset-paths.mjs';

let root = '';
let sourceFilePath = '';

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'astro-whono-assets-'));
  const entry = path.join(root, 'content', 'blog', 'entry');
  await mkdir(path.join(entry, 'files'), { recursive: true });
  await mkdir(path.join(entry, 'images'), { recursive: true });
  await mkdir(path.join(root, 'content', 'blog', '_shared'), { recursive: true });
  await mkdir(path.join(root, 'content', 'blog', 'other'), { recursive: true });
  await mkdir(path.join(root, 'public', 'images', 'site'), { recursive: true });
  sourceFilePath = path.join(entry, 'index.md');
  await writeFile(sourceFilePath, 'body', 'utf8');
  await writeFile(path.join(entry, 'files', 'doc.pdf'), 'pdf', 'utf8');
  await writeFile(path.join(entry, 'images', 'cover.png'), 'png', 'utf8');
  await writeFile(path.join(root, 'content', 'blog', '_shared', 'shared.png'), 'png', 'utf8');
  await writeFile(path.join(root, 'content', 'blog', 'other', 'other.png'), 'png', 'utf8');
  await writeFile(path.join(root, 'public', 'images', 'site', 'avatar.png'), 'png', 'utf8');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const resolve = (reference: string) => resolveContentAssetReference({
  reference,
  sourceFilePath,
  projectRoot: root
});

describe('content asset references', () => {
  it('resolves entry-relative images and attachments', () => {
    expect(resolve('./images/cover.png')?.contentRelativePath).toBe('blog/entry/images/cover.png');
    expect(resolve('./files/doc.pdf')?.contentRelativePath).toBe('blog/entry/files/doc.pdf');
  });

  it('resolves images/ and assets/ fallbacks, _shared and cross-entry files', () => {
    expect(resolve('cover.png')?.contentRelativePath).toBe('blog/entry/images/cover.png');
    expect(resolve('../_shared/shared.png')?.contentRelativePath).toBe('blog/_shared/shared.png');
    expect(resolve('../other/other.png')?.contentRelativePath).toBe('blog/other/other.png');
  });

  it('keeps query/hash suffixes and rejects remote or out-of-content paths', () => {
    expect(resolve('./files/doc.pdf#page=2')?.suffix).toBe('#page=2');
    expect(resolve('https://example.com/a.png')).toBeNull();
    expect(resolve('../../outside.png')).toBeNull();
    expect(resolve('/images/site/avatar.png')?.kind).toBe('site');
  });

  it('builds hashed-route-compatible content asset URLs', () => {
    expect(toContentAssetUrl('blog/entry/files/a b.pdf')).toBe('/content-assets/blog/entry/files/a%20b.pdf');
    expect(toContentAssetUrl('blog/entry/files/a.pdf', '/base/')).toBe('/base/content-assets/blog/entry/files/a.pdf');
    expect(stripBasePath('/base/blog/x/', '/base/')).toBe('/blog/x/');
  });
});
