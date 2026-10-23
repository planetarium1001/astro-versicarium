import { beforeEach, describe, expect, it } from 'vitest';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createJsonRequest,
  setupTempProjectRoot,
  toAbsoluteTestPath
} from './admin-content-write-fixture';

describe('admin content delete api', () => {
  const getTempRoot = setupTempProjectRoot('astro-whono-content-delete-');

  beforeEach(async () => {
    const contentRoot = path.join(getTempRoot(), 'content');
    const writeEntry = async (collection: string, entryId: string, lines: string[]): Promise<string> => {
      const entryDirectory = path.join(contentRoot, collection, ...entryId.split('/'));
      await mkdir(entryDirectory, { recursive: true });
      const filePath = path.join(entryDirectory, 'index.md');
      await writeFile(filePath, lines.join('\n'), 'utf8');
      return filePath;
    };

    await mkdir(path.join(contentRoot, 'blog'), { recursive: true });
    await mkdir(path.join(contentRoot, 'bits'), { recursive: true });
    await mkdir(path.join(contentRoot, 'about'), { recursive: true });

    await writeEntry('blog', 'demo', ['---', 'title: Demo blog', 'date: 2026-03-18', 'draft: false', '---', '', '# Demo', '']);
    await writeEntry('blog', 'admin-console-guide copy', ['---', 'title: Space Name blog', 'date: 2026-03-21', 'draft: false', '---', '', '# Space Name', '']);
    await writeEntry('blog', 'series/intro', ['---', 'title: Intro blog', 'date: 2026-03-19', 'draft: false', '---', '', '# Intro', '']);
    await writeEntry('bits', 'demo', ['---', 'date: 2025-02-03T22:30:00+08:00', 'draft: false', '---', '', 'Visible bit', '']);
    await writeFile(
      path.join(contentRoot, 'about', 'index.md'),
      ['---', '---', '', 'about body', ''].join('\n'),
      'utf8'
    );
  });

  it('moves an entry source file to the project trash folder', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('blog', 'demo');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'blog',
        entryId: 'demo',
        revision: current.revision,
        expectedRelativePath: current.relativePath
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result).toEqual(
      expect.objectContaining({
        collection: 'blog',
        entryId: 'demo',
        deleted: true,
        relativePath: 'content/blog/demo'
      })
    );
    expect(payload.result.trashedPath).toMatch(/^\.trash\/content\/\d{8}-\d{9}(?:-\d+)?\/content\/blog\/demo$/);
    await expect(access(path.join(getTempRoot(), 'content', 'blog', 'demo'))).rejects.toThrow();
    await expect(readFile(path.join(toAbsoluteTestPath(getTempRoot(), payload.result.trashedPath), 'index.md'), 'utf8')).resolves.toContain('# Demo');
  });

  it('deletes a source file whose file name contains spaces', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('blog', 'admin-console-guide copy');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'blog',
        entryId: 'admin-console-guide copy',
        revision: current.revision,
        expectedRelativePath: current.relativePath
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.result).toEqual(
      expect.objectContaining({
        collection: 'blog',
        entryId: 'admin-console-guide copy',
        relativePath: 'content/blog/admin-console-guide copy'
      })
    );
    await expect(access(path.join(getTempRoot(), 'content', 'blog', 'admin-console-guide copy'))).rejects.toThrow();
    await expect(readFile(path.join(toAbsoluteTestPath(getTempRoot(), payload.result.trashedPath), 'index.md'), 'utf8')).resolves.toContain('# Space Name');
  });

  it('keeps nested index entry paths restorable inside trash', async () => {
    const { moveAdminContentEntryToTrash } = await import('../src/lib/admin-console/content-delete');

    const result = await moveAdminContentEntryToTrash('blog', 'series/intro');

    expect(result.relativePath).toBe('content/blog/series/intro');
    expect(result.trashedPath).toMatch(/\/content\/blog\/series\/intro$/);
    await expect(access(path.join(getTempRoot(), 'content', 'blog', 'series', 'intro'))).rejects.toThrow();
    await expect(readFile(path.join(toAbsoluteTestPath(getTempRoot(), result.trashedPath), 'index.md'), 'utf8')).resolves.toContain('# Intro');
  });

  it('rejects about delete requests because about is a fixed readonly page', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'about',
        entryId: 'index',
        revision: 'stale',
        expectedRelativePath: 'content/about/index.md'
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('about 是固定单页内容');
    await expect(readFile(path.join(getTempRoot(), 'content', 'about', 'index.md'), 'utf8')).resolves.toContain('about body');
  });

  it('rejects stale revisions and leaves the source file in place', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('bits', 'demo');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'bits',
        entryId: 'demo',
        revision: 'stale-revision',
        expectedRelativePath: current.relativePath
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('已拒绝删除');
    await expect(readFile(path.join(getTempRoot(), 'content', 'bits', 'demo', 'index.md'), 'utf8')).resolves.toContain('Visible bit');
  });

  it('rejects mismatched confirmed source paths', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const current = await readAdminContentEntryEditorPayload('blog', 'demo');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'blog',
        entryId: 'demo',
        revision: current.revision,
        expectedRelativePath: 'content/blog/other/index.md'
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('路径与确认时不一致');
    await expect(readFile(path.join(getTempRoot(), 'content', 'blog', 'demo', 'index.md'), 'utf8')).resolves.toContain('# Demo');
  });
});
