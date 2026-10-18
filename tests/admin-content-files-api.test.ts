import { describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setupAdminContentWriteFixture } from './admin-content-write-fixture';

const createUploadRequest = (url: string, formData: FormData) =>
  new Request(url, {
    method: 'POST',
    headers: { origin: new URL(url).origin },
    body: formData
  });

describe('admin content files api', () => {
  const getTempRoot = setupAdminContentWriteFixture();

  it('lists attachments under content entry files/', async () => {
    const directory = path.join(getTempRoot(), 'content', 'blog', 'demo', 'files');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'note.pdf'), 'pdf', 'utf8');
    await writeFile(path.join(directory, 'orphan.txt'), 'orphan', 'utf8');
    const sourcePath = path.join(getTempRoot(), 'content', 'blog', 'demo', 'index.md');
    const source = await readFile(sourcePath, 'utf8');
    await writeFile(sourcePath, `${source}\n\n[note](./files/note.pdf)\n`, 'utf8');

    const { GET } = await import('../src/pages/api/admin/content/files/list');
    const response = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/files/list?owner=content/blog/demo')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: 'content/blog/demo',
          value: './files/note.pdf',
          fileName: 'note.pdf',
          referenced: true
        })
      ])
    );
    expect(payload.result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'orphan.txt',
          referenced: false,
          referenceCount: 0
        })
      ])
    );
  });

  it('uploads an attachment into the selected entry files/', async () => {
    const { POST } = await import('../src/pages/api/admin/content/files/upload');
    const url = 'http://127.0.0.1:4321/api/admin/content/files/upload';
    const formData = new FormData();
    formData.set('collection', 'blog');
    formData.set('entryId', 'demo');
    formData.set('file', new File(['attachment'], 'notes.txt', { type: 'text/plain' }));

    const response = await POST({
      request: createUploadRequest(url, formData),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result).toEqual(
      expect.objectContaining({
        src: './files/notes.txt',
        path: 'content/blog/demo/files/notes.txt',
        fileName: 'notes.txt'
      })
    );
    await expect(
      readFile(path.join(getTempRoot(), 'content', 'blog', 'demo', 'files', 'notes.txt'), 'utf8')
    ).resolves.toBe('attachment');
  });
});
