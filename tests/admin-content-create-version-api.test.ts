import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createJsonRequest, setupAdminContentWriteFixture } from './admin-content-write-fixture';

describe('admin content create version api', () => {
  const getTempRoot = setupAdminContentWriteFixture();

  it('creates a draft version from the latest entry and returns its edit href', async () => {
    const { POST } = await import('../src/pages/api/admin/content/create-version');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/create-version', {
        entryId: 'demo',
        versionLabel: 'v2'
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/create-version')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.entryId).toMatch(/^\d{4}-\d{2}-\d{2}-demo/);
    expect(payload.result.editHref).toContain('/admin/content/blog/_edit/');

    const source = await readFile(path.join(getTempRoot(), payload.result.relativePath), 'utf8');
    expect(source).toContain('series: demo');
    expect(source).toContain('slug: demo');
    expect(source).toContain('versionLabel: v2');
    expect(source).toContain('draft: true');
  });
});
