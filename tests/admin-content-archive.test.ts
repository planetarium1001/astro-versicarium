import { describe, expect, it } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { setupAdminContentWriteFixture } from './admin-content-write-fixture';

const createImportRequest = (url: string, zip: Uint8Array) => {
  const formData = new FormData();
  formData.set('file', new File([zip as unknown as BlobPart], 'entry.zip', { type: 'application/zip' }));
  return new Request(url, {
    method: 'POST',
    headers: { origin: new URL(url).origin },
    body: formData
  });
};

const createZip = (entries: Record<string, string | Uint8Array>): Uint8Array =>
  zipSync(Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [
      key,
      typeof value === 'string' ? strToU8(value) : value
    ])
  ));

describe('admin content entry archive', () => {
  const getTempRoot = setupAdminContentWriteFixture();

  it('exports the whole entry directory as a zip and keeps markdown export unchanged', async () => {
    const root = getTempRoot();
    await mkdir(path.join(root, 'content', 'blog', 'demo', 'images'), { recursive: true });
    await mkdir(path.join(root, 'content', 'blog', 'demo', 'files'), { recursive: true });
    await writeFile(path.join(root, 'content', 'blog', 'demo', 'images', 'cover.png'), 'png');
    await writeFile(path.join(root, 'content', 'blog', 'demo', 'files', 'note.pdf'), 'pdf');

    const { GET } = await import('../src/pages/api/admin/content/export');
    const archiveResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export?collection=blog&entryId=demo&format=archive')
    } as never);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.headers.get('content-type')).toBe('application/zip');
    expect(archiveResponse.headers.get('content-disposition')).toContain('.zip');
    const archive = unzipSync(new Uint8Array(await archiveResponse.arrayBuffer()));
    expect(Object.keys(archive).sort()).toEqual([
      'content/blog/demo/files/note.pdf',
      'content/blog/demo/images/cover.png',
      'content/blog/demo/index.md'
    ]);

    const markdownResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export?collection=blog&entryId=demo')
    } as never);
    expect(markdownResponse.status).toBe(200);
    expect(markdownResponse.headers.get('content-type')).toContain('text/markdown');
    expect(await markdownResponse.text()).toContain('title: Demo blog');
  });

  it('imports a zip into a new entry directory and returns editHref', async () => {
    const { POST } = await import('../src/pages/api/admin/content/import');
    const url = 'http://127.0.0.1:4321/api/admin/content/import';
    const zip = createZip({
      'content/blog/imported/index.md': '---\ntitle: 导入条目\n---\n\n正文\n',
      'content/blog/imported/images/cover.png': 'png',
      'content/blog/imported/files/note.pdf': 'pdf'
    });

    const response = await POST({
      request: createImportRequest(url, zip),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      result: expect.objectContaining({
        collection: 'blog',
        entryId: 'imported',
        editHref: '/admin/content/blog/_edit/imported/',
        fileCount: 3
      })
    }));
    await expect(readFile(
      path.join(getTempRoot(), 'content', 'blog', 'imported', 'index.md'),
      'utf8'
    )).resolves.toContain('导入条目');
    await expect(readFile(
      path.join(getTempRoot(), 'content', 'blog', 'imported', 'images', 'cover.png'),
      'utf8'
    )).resolves.toBe('png');
  });


  it('round-trips a nested series/version entry archive', async () => {
    const root = getTempRoot();
    const directory = path.join(root, 'content', 'blog', 'series', 'v1');
    await mkdir(path.join(directory, 'images'), { recursive: true });
    await writeFile(path.join(directory, 'index.md'), '---\ntitle: 嵌套版本\n---\n', 'utf8');
    await writeFile(path.join(directory, 'images', 'cover.png'), 'png', 'utf8');

    const { GET } = await import('../src/pages/api/admin/content/export');
    const archiveResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export?collection=blog&entryId=series%2Fv1&format=archive')
    } as never);
    expect(archiveResponse.status).toBe(200);
    const zip = new Uint8Array(await archiveResponse.arrayBuffer());

    await rm(directory, { recursive: true, force: true });

    const { POST } = await import('../src/pages/api/admin/content/import');
    const url = 'http://127.0.0.1:4321/api/admin/content/import';
    const response = await POST({
      request: createImportRequest(url, zip),
      url: new URL(url)
    } as never);
    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.result.entryId).toBe('series/v1');
    expect(payload.result.editHref).toBe('/admin/content/blog/_edit/series/v1/');
    await expect(readFile(path.join(directory, 'images', 'cover.png'), 'utf8')).resolves.toBe('png');
  });

  it('rejects zip paths containing .. and absolute paths', async () => {
    const { POST } = await import('../src/pages/api/admin/content/import');
    const url = 'http://127.0.0.1:4321/api/admin/content/import';

    for (const zip of [
      createZip({
        'content/blog/evil/../../../tmp/escape.png': 'x',
        'content/blog/evil/index.md': 'x'
      }),
      createZip({
        '/content/blog/absolute/index.md': 'x'
      }),
      createZip({
        'content/unknown/entry/index.md': 'x'
      })
    ]) {
      const response = await POST({
        request: createImportRequest(url, zip),
        url: new URL(url)
      } as never);
      expect(response.status).toBe(400);
      const payload = JSON.parse(await response.text());
      expect(payload.ok).toBe(false);
      expect(Array.isArray(payload.errors)).toBe(true);
    }
  });

  it('refuses to overwrite an existing entry directory', async () => {
    const { POST } = await import('../src/pages/api/admin/content/import');
    const url = 'http://127.0.0.1:4321/api/admin/content/import';
    const zip = createZip({
      'content/blog/demo/index.md': '---\ntitle: 覆盖\n---\n'
    });

    const response = await POST({
      request: createImportRequest(url, zip),
      url: new URL(url)
    } as never);
    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.errors[0]).toContain('不会覆盖');
    await expect(readFile(
      path.join(getTempRoot(), 'content', 'blog', 'demo', 'index.md'),
      'utf8'
    )).resolves.toContain('Demo blog');
  });

  it('rejects archives containing multiple entry directories', async () => {
    const { POST } = await import('../src/pages/api/admin/content/import');
    const url = 'http://127.0.0.1:4321/api/admin/content/import';
    const zip = createZip({
      'content/blog/one/index.md': 'x',
      'content/blog/two/index.md': 'y'
    });

    const response = await POST({
      request: createImportRequest(url, zip),
      url: new URL(url)
    } as never);
    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.errors[0]).toContain('一个条目');
  });
});
