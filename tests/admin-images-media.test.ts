import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=',
  'base64'
);

const createJsonWriteRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(url).origin
    },
    body: JSON.stringify(body)
  });

describe('admin media api', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-media-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;

    const writeEntry = async (entryId: string, lines: string[]) => {
      const directory = path.join(tempRoot, 'content', 'blog', ...entryId.split('/'));
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, 'index.md'), lines.join('\n'), 'utf8');
    };

    await writeEntry('series/2026-01-01', [
      '---',
      'title: 系列 v1',
      'series: alpha',
      'versionLabel: v1',
      'date: 2026-01-01',
      '---',
      '',
      '![封面](./images/cover.png)',
      '',
      '[说明](./files/note.pdf)',
      ''
    ]);
    await writeEntry('series/2026-02-01', [
      '---',
      'title: 系列 v2',
      'series: alpha',
      'versionLabel: v2',
      'date: 2026-02-01',
      '---',
      '',
      '没有引用。',
      ''
    ]);

    await mkdir(path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'images'), { recursive: true });
    await mkdir(path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'files'), { recursive: true });
    await writeFile(path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'images', 'cover.png'), PNG_1X1);
    await writeFile(path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'files', 'note.pdf'), 'pdf');
    await writeFile(path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'files', 'old.txt'), 'orphan-ish');
    await writeFile(path.join(tempRoot, 'content', 'blog', 'gone.png'), PNG_1X1);
  });

  afterEach(async () => {
    delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('lists images and attachments with series/version/entry tree and breadcrumb', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/media/list?collection=blog&series=alpha&entry=series%2F2026-01-01&limit=50')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'content/blog/series/2026-01-01/images/cover.png',
        kind: 'image',
        series: 'alpha',
        version: 'series/2026-01-01',
        versionLabel: 'v1',
        entryId: 'series/2026-01-01',
        directory: 'images',
        referenceCount: 1,
        referenceStatus: 'referenced'
      }),
      expect.objectContaining({
        path: 'content/blog/series/2026-01-01/files/note.pdf',
        kind: 'file',
        directory: 'files',
        referenceCount: 1,
        referenceStatus: 'referenced'
      }),
      expect.objectContaining({
        path: 'content/blog/series/2026-01-01/files/old.txt',
        referenceStatus: 'unreferenced'
      })
    ]));
    expect(payload.result.items.some((item: { path: string }) => item.path.includes('2026-02-01'))).toBe(false);

    const collectionNode = payload.result.tree[0];
    expect(collectionNode).toEqual(expect.objectContaining({ kind: 'collection', collection: 'blog', label: '博客' }));
    const seriesNode = collectionNode.children.find((node: { series: string }) => node.series === 'alpha');
    expect(seriesNode).toEqual(expect.objectContaining({ kind: 'series', series: 'alpha' }));
    const versionNode = seriesNode.children.find((node: { version: string }) => node.version === 'series/2026-01-01');
    expect(versionNode).toEqual(expect.objectContaining({ kind: 'version', label: 'v1' }));
    expect(versionNode.children.map((node: { directory: string }) => node.directory)).toEqual(['files', 'images']);

    expect(payload.result.breadcrumb.map((crumb: { label: string }) => crumb.label)).toEqual([
      '全部媒体',
      '博客',
      'alpha',
      'v1'
    ]);
  });

  it('filters by reference status, type and modified time', async () => {
    const { GET } = await import('../src/pages/api/admin/media/list');
    const list = async (query: string) => {
      const response = await GET({
        url: new URL(`http://127.0.0.1:4321/api/admin/media/list?${query}`)
      } as never);
      return JSON.parse(await response.text());
    };

    const orphanPayload = await list('collection=blog&ref=orphan');
    expect(orphanPayload.result.items.map((item: { path: string }) => item.path)).toEqual([
      'content/blog/gone.png'
    ]);
    expect(orphanPayload.result.items[0]).toEqual(expect.objectContaining({
      referenceStatus: 'orphan',
      entryExists: false
    }));

    const filePayload = await list('collection=blog&type=file');
    expect(filePayload.result.items.every((item: { kind: string }) => item.kind === 'file')).toBe(true);

    const versionLabelPayload = await list('collection=blog&version=v1');
    expect(versionLabelPayload.result.items.every(
      (item: { version: string }) => item.version === 'series/2026-01-01'
    )).toBe(true);

    const imagePath = path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'images', 'cover.png');
    const oldTime = new Date('2025-01-01T00:00:00.000Z');
    const newTime = new Date('2026-06-01T00:00:00.000Z');
    await utimes(imagePath, oldTime, oldTime);
    const fromPayload = await list('collection=blog&from=2026-01-01');
    expect(fromPayload.result.items.some((item: { path: string }) => item.path.endsWith('cover.png'))).toBe(false);
    await utimes(imagePath, newTime, newTime);
    const toPayload = await list('collection=blog&to=2025-12-31');
    expect(toPayload.result.items.some((item: { path: string }) => item.path.endsWith('cover.png'))).toBe(false);
  });

  it('renames and moves assets in batch while rewriting content references', async () => {
    const { POST } = await import('../src/pages/api/admin/media/batch');
    const url = 'http://127.0.0.1:4321/api/admin/media/batch';

    const renameResponse = await POST({
      request: createJsonWriteRequest(url, {
        action: 'rename',
        items: [{ path: 'content/blog/series/2026-01-01/files/note.pdf', name: '说明.pdf' }]
      }),
      url: new URL(url)
    } as never);
    expect(renameResponse.status).toBe(200);
    const renamePayload = JSON.parse(await renameResponse.text());
    expect(renamePayload.ok).toBe(true);
    expect(renamePayload.result.results[0]).toEqual(expect.objectContaining({
      ok: true,
      to: 'content/blog/series/2026-01-01/files/说明.pdf'
    }));
    const source = await readFile(
      path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'index.md'),
      'utf8'
    );
    expect(source).toContain('./files/说明.pdf');

    const moveResponse = await POST({
      request: createJsonWriteRequest(url, {
        action: 'move',
        items: [{
          path: 'content/blog/series/2026-01-01/images/cover.png',
          to: 'content/blog/series/2026-01-01/files'
        }]
      }),
      url: new URL(url)
    } as never);
    const movePayload = JSON.parse(await moveResponse.text());
    expect(movePayload.ok).toBe(true);
    expect(movePayload.result.results[0].to).toBe('content/blog/series/2026-01-01/files/cover.png');
    expect(await readFile(
      path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'index.md'),
      'utf8'
    )).toContain('./files/cover.png');
  });

  it('rejects paths outside content/ and public/images/ without touching files', async () => {
    const { POST } = await import('../src/pages/api/admin/media/batch');
    const url = 'http://127.0.0.1:4321/api/admin/media/batch';
    const response = await POST({
      request: createJsonWriteRequest(url, {
        action: 'delete',
        items: [{ path: 'public/author/avatar.png' }, { path: 'content/../secret.txt' }]
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.result.failedCount).toBe(2);
    expect(payload.result.results.every((result: { error?: string }) => typeof result.error === 'string')).toBe(true);
  });

  it('deletes selected files and reports partial failures', async () => {
    const { POST } = await import('../src/pages/api/admin/media/batch');
    const url = 'http://127.0.0.1:4321/api/admin/media/batch';
    const response = await POST({
      request: createJsonWriteRequest(url, {
        action: 'delete',
        items: [
          { path: 'content/blog/series/2026-01-01/files/old.txt' },
          { path: 'content/blog/series/2026-01-01/files/missing.txt' }
        ]
      }),
      url: new URL(url)
    } as never);
    const payload = JSON.parse(await response.text());

    expect(payload.ok).toBe(false);
    expect(payload.result.okCount).toBe(1);
    expect(payload.result.failedCount).toBe(1);
    await expect(
      readFile(path.join(tempRoot, 'content', 'blog', 'series', '2026-01-01', 'files', 'old.txt'))
    ).rejects.toThrow();
  });
});
