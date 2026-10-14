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
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'blog'), { recursive: true });
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'about'), { recursive: true });
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'blog', 'series', 'intro'), { recursive: true });

    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'blog', 'demo.md'),
      ['---', 'title: Demo blog', 'date: 2026-03-18', 'draft: false', '---', '', '# Demo', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'blog', 'admin-console-guide copy.md'),
      ['---', 'title: Space Name blog', 'date: 2026-03-21', 'draft: false', '---', '', '# Space Name', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'blog', 'series', 'intro', 'index.md'),
      ['---', 'title: Intro blog', 'date: 2026-03-19', 'draft: false', '---', '', '# Intro', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'bits', 'demo.md'),
      ['---', 'date: 2025-02-03T22:30:00+08:00', 'draft: false', '---', '', 'Visible bit', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'about', 'index.md'),
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
        relativePath: 'src/content/blog/demo.md'
      })
    );
    expect(payload.result.trashedPath).toMatch(/^\.trash\/content\/\d{8}-\d{9}(?:-\d+)?\/src\/content\/blog\/demo\.md$/);
    await expect(access(path.join(getTempRoot(), 'src', 'content', 'blog', 'demo.md'))).rejects.toThrow();
    await expect(readFile(toAbsoluteTestPath(getTempRoot(), payload.result.trashedPath), 'utf8')).resolves.toContain('# Demo');
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
        relativePath: 'src/content/blog/admin-console-guide copy.md'
      })
    );
    await expect(access(path.join(getTempRoot(), 'src', 'content', 'blog', 'admin-console-guide copy.md'))).rejects.toThrow();
    await expect(readFile(toAbsoluteTestPath(getTempRoot(), payload.result.trashedPath), 'utf8')).resolves.toContain('# Space Name');
  });

  it('keeps nested index entry paths restorable inside trash', async () => {
    const { moveAdminContentEntryToTrash } = await import('../src/lib/admin-console/content-delete');

    const result = await moveAdminContentEntryToTrash('blog', 'series/intro');

    expect(result.relativePath).toBe('src/content/blog/series/intro/index.md');
    expect(result.trashedPath).toMatch(/\/src\/content\/blog\/series\/intro\/index\.md$/);
    await expect(access(path.join(getTempRoot(), 'src', 'content', 'blog', 'series', 'intro', 'index.md'))).rejects.toThrow();
    await expect(readFile(toAbsoluteTestPath(getTempRoot(), result.trashedPath), 'utf8')).resolves.toContain('# Intro');
  });

  it('rejects about delete requests because about is a fixed readonly page', async () => {
    const { POST } = await import('../src/pages/api/admin/content/delete');
    const url = 'http://127.0.0.1:4321/api/admin/content/delete/';

    const response = await POST({
      request: createJsonRequest(url, {
        collection: 'about',
        entryId: 'index',
        revision: 'stale',
        expectedRelativePath: 'src/content/about/index.md'
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('about 是固定单页内容');
    await expect(readFile(path.join(getTempRoot(), 'src', 'content', 'about', 'index.md'), 'utf8')).resolves.toContain('about body');
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
    await expect(readFile(path.join(getTempRoot(), 'src', 'content', 'bits', 'demo.md'), 'utf8')).resolves.toContain('Visible bit');
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
        expectedRelativePath: 'src/content/blog/other.md'
      }),
      url: new URL(url)
    } as never);

    expect(response.status).toBe(409);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain('路径与确认时不一致');
    await expect(readFile(path.join(getTempRoot(), 'src', 'content', 'blog', 'demo.md'), 'utf8')).resolves.toContain('# Demo');
  });
});
