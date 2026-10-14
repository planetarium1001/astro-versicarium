import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createJsonRequest,
  setupAdminContentWriteFixture
} from './admin-content-write-fixture';

describe('admin content projects/devlog write contract', () => {
  const getTempRoot = setupAdminContentWriteFixture();

  it('writes projects frontmatter fields through the shared entry api', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('projects', 'demo-project');
    const nextValues = {
      ...current.values,
      title: 'Edited Project',
      subtitle: 'Edited subtitle',
      type: '实验',
      tagsText: 'Astro\n工程',
      repoLabel: '',
      demoLabel: '',
      date: '2026-02-03'
    };

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'projects',
        entryId: 'demo-project',
        revision: current.revision,
        frontmatter: nextValues,
        body: current.bodyText
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(
      expect.arrayContaining(['title', 'subtitle', 'type', 'tags', 'repoLabel', 'demoLabel', 'date'])
    );

    const saved = await readFile(path.join(getTempRoot(), 'src', 'content', 'projects', 'demo-project.md'), 'utf8');
    expect(saved).toContain('title: Edited Project');
    expect(saved).toContain('type: 实验');
    expect(saved).toContain('Project body');
    // 清空的 Label 走 delete patch，不残留空字符串。
    expect(saved).not.toContain('repoLabel:');
    expect(saved).not.toContain('demoLabel:');
  });

  it('rejects non-https projects links before writing', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('projects', 'demo-project');
    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'projects',
        entryId: 'demo-project',
        revision: current.revision,
        frontmatter: { ...current.values, repo: 'ftp://example.com/repo' },
        body: current.bodyText
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'repo' })])
    );
  });

  // devlog 已完全 markdown 化：外链写在正文里，frontmatter 不再有 links，
  // 这里同时守住「不会把 links 写回 frontmatter」。
  it('writes devlog frontmatter + body markdown links, and never writes a links field', async () => {
    const { readAdminContentEntryEditorPayload } = await import('../src/lib/admin-console/content-shared');
    const { POST } = await import('../src/pages/api/admin/content/entry');

    const current = await readAdminContentEntryEditorPayload('devlog', 'demo-devlog');
    expect(
      Object.prototype.hasOwnProperty.call(current.values, 'linksText'),
      'devlog 编辑器值里不应再有 linksText（行编辑器已随字段取消）'
    ).toBe(false);

    const nextValues = {
      ...current.values,
      title: 'Edited Devlog',
      kind: 'fix'
    };
    const nextBody = [
      '正文第一段。',
      '',
      '[站内](https://example.com/blog) · [仓库](https://example.com/repo)'
    ].join('\n');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/content/entry', {
        collection: 'devlog',
        entryId: 'demo-devlog',
        revision: current.revision,
        frontmatter: nextValues,
        body: nextBody
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/content/entry')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.changedFields).toEqual(expect.arrayContaining(['title', 'kind', 'body']));

    const saved = await readFile(path.join(getTempRoot(), 'src', 'content', 'devlog', 'demo-devlog.md'), 'utf8');
    expect(saved).toContain('title: Edited Devlog');
    expect(saved).toContain('kind: fix');
    // 链接在正文里（markdown 写法），而不是 frontmatter
    expect(saved).toContain('[站内](https://example.com/blog)');
    expect(saved).toContain('[仓库](https://example.com/repo)');
    expect(saved, 'frontmatter 不应再出现 links:').not.toMatch(/^links:/m);
  });
});

// 客户端保存体若只给 blog/bits 附 frontmatter，projects/devlog 的保存会被服务端
// 以「frontmatter 必须是对象」拒绝；这里直接断言客户端构造的请求体形态。
describe('client write request body for new collections', () => {
  it.each(['projects', 'devlog'] as const)('attaches frontmatter for %s', async (collection) => {
    const { buildContentWriteRequestBody } = await import(
      '../src/components/admin/editor/shared/content-editor-client'
    );

    const values = collection === 'projects'
      ? {
          title: 'P',
          subtitle: '',
          description: '',
          type: '',
          tagsText: '',
          icon: '',
          repo: '',
          repoLabel: '',
          demo: '',
          demoLabel: '',
          date: '2026-02-01',
          draft: false
        }
      : {
          title: 'D',
          date: '2026-02-02',
          project: 'P',
          kind: '',
          description: '',
          draft: false
        };

    const body = buildContentWriteRequestBody({
      endpoint: '/api/admin/content/entry/',
      collection,
      entryId: 'demo',
      revision: 'rev',
      frontmatter: values,
      body: 'body text'
    } as never);

    expect(body).toMatchObject({ collection, entryId: 'demo', revision: 'rev' });
    expect(body.frontmatter).toEqual(values);
    expect(body.body).toBe('body text');
  });
});

// entry-transport 的载荷守卫若没有 projects/devlog 分支，
// 这两个集合的删除（单条与批量）与保存回读会全部拿到 null。
describe('entry transport guards for new collections', () => {
  it.each(['projects', 'devlog'] as const)('resolves %s payloads from a response body', async (collection) => {
    const { getPayloadEditorPayload, getPayloadEditorValues, getPayloadEditorBody } = await import(
      '../src/scripts/admin-content/entry-transport'
    );

    const values = collection === 'projects'
      ? {
          title: 'P',
          subtitle: '',
          description: '',
          type: '',
          tagsText: '',
          icon: '',
          repo: '',
          repoLabel: '',
          demo: '',
          demoLabel: '',
          date: '2026-02-01',
          draft: false
        }
      : {
          title: 'D',
          date: '2026-02-02',
          project: 'P',
          kind: '',
          description: '',
          draft: false
        };

    const response = {
      payload: {
        collection,
        entryId: 'demo',
        publicEntryId: 'demo',
        defaultPublicSlug: 'demo',
        revision: 'rev',
        relativePath: `src/content/${collection}/demo.md`,
        writable: true,
        readonlyReason: null,
        bodyText: 'body text',
        values
      }
    };

    expect(getPayloadEditorPayload(response)?.collection).toBe(collection);
    expect(getPayloadEditorValues(response, collection)).toEqual(values);
    expect(getPayloadEditorBody(response, collection)).toBe('body text');
  });
});

// bits 的 create 属性不能被 ContentListActions 匹配，
// 否则一次点击会同时打开两个创建弹窗（bits 由 BitsCreateAction 独占）。
describe('create trigger ownership', () => {
  it('keeps the bits create attribute out of the generic list-actions selector', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src', 'components', 'admin', 'editor', 'list-actions', 'ContentListActions.svelte'),
      'utf8'
    );

    const selectorBlock = source.slice(
      source.indexOf('const CREATE_TRIGGER_SELECTOR'),
      source.indexOf('const ALL_CREATE_TRIGGER_SELECTOR')
    );

    expect(selectorBlock).toContain('data-admin-content-create-action');
    expect(selectorBlock).toContain('data-admin-content-projects-create-action');
    expect(selectorBlock).toContain('data-admin-content-devlog-create-action');
    expect(selectorBlock).not.toContain('data-admin-content-bits-create-action');

    // 但 disabled 的解除必须覆盖 bits，否则 SSR 的 disabled 永远摘不掉。
    const allBlock = source.slice(
      source.indexOf('const ALL_CREATE_TRIGGER_SELECTOR'),
      source.indexOf('const CREATE_DIALOG_TITLES')
    );
    expect(allBlock).toContain('data-admin-content-bits-create-action');
  });
});
