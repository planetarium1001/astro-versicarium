import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createJsonRequest, setupAdminContentWriteFixture } from './admin-content-write-fixture';

describe('admin content entry payload contract', () => {
  const getTempRoot = setupAdminContentWriteFixture();

  it('loads editable payload for blog entries', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('blog', 'demo');

    expect(payload.collection).toBe('blog');
    if (payload.collection !== 'blog') throw new Error('Expected blog payload');
    expect(payload.writable).toBe(true);
    expect(payload.values.title).toBe('Demo blog');
    expect(payload.values.date).toBe('2026-03-18');
    expect(payload.defaultPublicSlug).toBe('demo');
    if (payload.collection === 'blog') {
      expect(payload.values.publishedAt).toBe('');
      expect(payload.values.updatedAt).toBe('');
    }
  });

  it('loads editable payload for bits entries with body text', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('bits', 'demo');

    expect(payload.writable).toBe(true);
    expect(payload.collection).toBe('bits');
    if (payload.collection === 'bits') {
      expect(payload.bodyText).toBe('\nBits body\n');
      expect(payload.values.imagesText).toContain('bits/demo.webp');
    }
  });

  it('loads the optional projects stable slug into editor values', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');

    const initial = await readAdminContentEntryEditorPayload('projects', 'demo-project');
    if (initial.collection !== 'projects') throw new Error('Expected projects payload');
    expect(initial.values.slug).toBe('');

    const projectPath = path.join(getTempRoot(), 'content', 'projects', 'demo-project', 'index.md');
    await writeFile(
      projectPath,
      [
        '---',
        'title: Demo Project',
        'subtitle: Demo subtitle',
        'description: Demo description',
        'type: 开源',
        'slug: content-workflow',
        'date: 2026-02-01T00:00:00.000Z',
        'draft: false',
        '---',
        '',
        'Project body',
        ''
      ].join('\n'),
      'utf8'
    );

    const payload = await readAdminContentEntryEditorPayload('projects', 'demo-project');
    if (payload.collection !== 'projects') throw new Error('Expected projects payload');
    expect(payload.values.slug).toBe('content-workflow');
  });

  it('loads and validates source files whose names differ from Astro public ids', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');
    const current = await readAdminContentEntryEditorPayload('blog', 'admin-console-guide copy');

    expect(current.entryId).toBe('admin-console-guide copy');
    expect(current.defaultPublicSlug).toBe('admin-console-guide-copy');
    expect(current.relativePath).toBe('content/blog/admin-console-guide copy/index.md');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', {
        collection: 'blog',
        entryId: 'admin-console-guide copy',
        revision: current.revision,
        frontmatter: {
          ...current.values,
          title: 'Space Name blog Updated'
        }
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(['title']);
  });

  it('loads legacy blog datetime dates for compatibility', async () => {
    const legacyDirectory = path.join(getTempRoot(), 'content', 'blog', 'legacy-datetime');
    await mkdir(legacyDirectory, { recursive: true });
    await writeFile(
      path.join(legacyDirectory, 'index.md'),
      [
        '---',
        'title: Legacy Datetime',
        'date: 2024-11-23T18:00:00+08:00',
        'draft: false',
        '---',
        '',
        'legacy body',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('blog', 'legacy-datetime');

    if (payload.collection === 'blog') {
      expect(payload.values.date).toBe('2024-11-23');
      expect(payload.values.publishedAt).toBe('');
    }
  });

  it('loads optional blog updatedAt as editable date text', async () => {
    const updatedDirectory = path.join(getTempRoot(), 'content', 'blog', 'updated-date');
    await mkdir(updatedDirectory, { recursive: true });
    await writeFile(
      path.join(updatedDirectory, 'index.md'),
      [
        '---',
        'title: Updated Date',
        'date: 2026-03-18',
        'updatedAt: 2026-03-20T22:30:00+08:00',
        'draft: false',
        '---',
        '',
        'updated body',
        ''
      ].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const payload = await readAdminContentEntryEditorPayload('blog', 'updated-date');

    if (payload.collection === 'blog') {
      expect(payload.values.updatedAt).toBe('2026-03-20');
    }
  });

  it('does not load .mdx entries into the writable editor path', async () => {
    const legacyMdxDirectory = path.join(getTempRoot(), 'content', 'bits', 'legacy-mdx');
    await mkdir(legacyMdxDirectory, { recursive: true });
    await writeFile(
      path.join(legacyMdxDirectory, 'index.mdx'),
      ['---', 'date: 2025-02-03T22:30:00+08:00', '---', '', '<Aside />', ''].join('\n'),
      'utf8'
    );

    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');

    await expect(readAdminContentEntryEditorPayload('bits', 'legacy-mdx')).rejects.toMatchObject({
      code: 'source-not-found'
    });
  });

  it('returns structured json errors for invalid write inputs', async () => {
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const cases = [
      {
        body: { collection: 'page', entryId: 'demo', revision: 'stale', frontmatter: {} },
        status: 400,
        issuePath: 'collection',
        message: '不支持的 content collection'
      },
      {
        body: { collection: 'about', entryId: 'index', revision: null, body: 'about body' },
        status: 400,
        issuePath: 'revision',
        message: '请求体缺少 revision'
      },
      {
        body: { collection: 'blog', entryId: '../secret', revision: 'stale', frontmatter: {} },
        status: 400,
        issuePath: 'entryId',
        message: 'entryId'
      },
      {
        body: { collection: 'blog', entryId: 'missing', revision: 'stale', frontmatter: {} },
        status: 404,
        issuePath: 'entryId',
        message: '未找到 content 源文件'
      },
      {
        body: { collection: 'blog', entryId: 'demo', revision: 'stale', frontmatter: [] },
        status: 400,
        issuePath: 'frontmatter',
        message: 'frontmatter 必须是对象'
      },
      {
        body: { collection: 'about', entryId: 'index', revision: 'stale' },
        status: 400,
        issuePath: 'body',
        message: 'about 保存请求缺少 body 字段'
      },
      {
        body: { collection: 'blog', entryId: 'demo', revision: 'stale', frontmatter: {}, body: 42 },
        status: 400,
        issuePath: 'body',
        message: 'body 必须是 Markdown 字符串'
      }
    ];

    for (const testCase of cases) {
      const response = await POST({
        request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1', testCase.body),
        url: new URL('http://127.0.0.1:4321/api/admin/content/entry?dryRun=1')
      } as never);

      expect(response.status).toBe(testCase.status);
      const payload = JSON.parse(await response.text());
      expect(payload.ok).toBe(false);
      expect(payload.errors[0]).toContain(testCase.message);
      expect(payload.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: testCase.issuePath
          })
        ])
      );
    }
  });

});
