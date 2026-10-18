import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('admin media text preview api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-media-text-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
    const entryDirectory = path.join(tempRoot, 'content', 'blog', 'entry');
    await mkdir(path.join(entryDirectory, 'files'), { recursive: true });
    await writeFile(path.join(entryDirectory, 'files', 'note.txt'), '第一行\n第二行\n', 'utf8');
    await writeFile(path.join(entryDirectory, 'files', 'cover.png'), 'png');
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('returns utf-8 text for content files', async () => {
    const { GET } = await import('../src/pages/api/admin/media/text');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/text/?path=content/blog/entry/files/note.txt')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.text).toContain('第二行');
    expect(payload.result.truncated).toBe(false);
  });

  it('rejects paths outside content or unsupported extensions', async () => {
    const { GET } = await import('../src/pages/api/admin/media/text');
    const outside = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/text/?path=content/../secret.txt')
    } as never);
    expect(outside.status).toBe(400);

    const binary = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/text/?path=content/blog/entry/files/cover.png')
    } as never);
    expect(binary.status).toBe(415);
  });
});
