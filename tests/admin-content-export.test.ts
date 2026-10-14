import { beforeEach, describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setupTempProjectRoot } from './admin-content-write-fixture';

describe('admin content source export', () => {
  const getTempRoot = setupTempProjectRoot('astro-whono-content-export-');

  beforeEach(async () => {
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'blog'), { recursive: true });
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'bits'), { recursive: true });
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'about'), { recursive: true });

    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'blog', 'demo.md'),
      ['---', 'title: Demo blog', 'date: 2026-03-18', '---', '', '# Demo', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'blog', 'admin-console-guide copy.md'),
      ['---', 'title: Space Name blog', 'date: 2026-03-21', '---', '', '# Space Name', ''].join('\n'),
      'utf8'
    );
    await mkdir(path.join(getTempRoot(), 'src', 'content', 'blog', 'series', 'intro'), { recursive: true });
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'blog', 'series', 'intro', 'index.md'),
      ['---', 'title: Intro blog', 'date: 2026-03-19', '---', '', '# Intro', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'bits', 'bits-2026-02-03-2230.mdx'),
      ['---', 'date: 2025-02-03T22:30:00+08:00', '---', '', '<Aside />', ''].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(getTempRoot(), 'src', 'content', 'about', 'index.md'),
      ['---', '---', '', 'about body', ''].join('\n'),
      'utf8'
    );
  });

  it('reads a normal content source file with the original file name', async () => {
    const { readAdminContentSourceDownload } = await import('../src/lib/admin-console/content-export');

    const download = await readAdminContentSourceDownload('blog', 'demo');

    expect(download.fileName).toBe('demo.md');
    expect(download.relativePath).toBe('src/content/blog/demo.md');
    expect(download.contentType).toBe('text/markdown; charset=utf-8');
    expect(download.sourceText).toContain('title: Demo blog');
  });

  it('exports a source file whose file name contains spaces', async () => {
    const { readAdminContentSourceDownload } = await import('../src/lib/admin-console/content-export');

    const download = await readAdminContentSourceDownload('blog', 'admin-console-guide copy');

    expect(download.fileName).toBe('admin-console-guide copy.md');
    expect(download.relativePath).toBe('src/content/blog/admin-console-guide copy.md');
    expect(download.sourceText).toContain('# Space Name');
  });

  it('keeps mdx extensions and gives index source files stable download names', async () => {
    const { readAdminContentSourceDownload } = await import('../src/lib/admin-console/content-export');

    const bitsDownload = await readAdminContentSourceDownload('bits', 'bits-2026-02-03-2230');
    const nestedBlogDownload = await readAdminContentSourceDownload('blog', 'series/intro');
    const aboutDownload = await readAdminContentSourceDownload('about', 'index');

    expect(bitsDownload.fileName).toBe('bits-2026-02-03-2230.mdx');
    expect(bitsDownload.contentType).toBe('text/plain; charset=utf-8');
    expect(nestedBlogDownload.fileName).toBe('intro.md');
    expect(aboutDownload.fileName).toBe('about.md');
  });

  it('serves the source file as an attachment from the export api', async () => {
    const { GET } = await import('../src/pages/api/admin/content/export');
    const url = new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=blog&entryId=demo');

    const response = await GET({ url } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('content-disposition')).toContain('filename="demo.md"');
    expect(await response.text()).toContain('# Demo');
  });

  it('exports the readonly about fixed page source', async () => {
    const { GET } = await import('../src/pages/api/admin/content/export');
    const url = new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=about&entryId=index');

    const response = await GET({ url } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('filename="about.md"');
    expect(await response.text()).toContain('about body');
  });

  it('encodes non-ascii and special attachment file names for filename*', async () => {
    const { createAdminContentSourceDownloadHeaders } = await import('../src/lib/admin-console/content-export');

    const headers = new Headers(createAdminContentSourceDownloadHeaders(
      "一篇'story(1)*.md",
      'text/markdown; charset=utf-8'
    ));

    expect(headers.get('content-disposition')).toContain(
      "filename*=UTF-8''%E4%B8%80%E7%AF%87%27story%281%29%2A.md"
    );
  });

  it('returns structured errors for invalid export inputs', async () => {
    const { GET } = await import('../src/pages/api/admin/content/export');

    const invalidCollectionResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=page&entryId=demo')
    } as never);
    expect(invalidCollectionResponse.status).toBe(400);
    expect(JSON.parse(await invalidCollectionResponse.text()).errors[0]).toContain('不支持的 content collection');

    const invalidEntryResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=blog&entryId=../secret')
    } as never);
    expect(invalidEntryResponse.status).toBe(400);
    expect(JSON.parse(await invalidEntryResponse.text()).errors[0]).toContain('不支持的 content entryId');

    const missingEntryResponse = await GET({
      url: new URL('http://127.0.0.1:4321/api/admin/content/export/?collection=blog&entryId=missing')
    } as never);
    expect(missingEntryResponse.status).toBe(404);
    expect(JSON.parse(await missingEntryResponse.text()).errors[0]).toContain('未找到 content 源文件');
  });
});
