import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): Promise<string> =>
  readFile(path.join(process.cwd(), relativePath), 'utf8');

const PAGE = 'src/pages/admin/resources/index.astro';
const SCRIPT = 'src/scripts/admin-resources/index.ts';

describe('admin resources status', () => {
  it('renders the loading text in the shell status slot, not inside the resources root', async () => {
    const page = await read(PAGE);

    expect(page).toContain('data-admin-resources-status>载入中…</p>');
    expect(page).not.toContain('准备中');
    expect(page).toContain('id="admin-resources-status-live"');

    const statusIndex = page.indexOf('data-admin-resources-status');
    const rootIndex = page.indexOf('data-admin-resources-root');
    expect(statusIndex).toBeGreaterThan(-1);
    expect(rootIndex).toBeGreaterThan(-1);
    expect(statusIndex).toBeLessThan(rootIndex);
  });

  it('queries status and live region from the document instead of the resources root', async () => {
    const script = await read(SCRIPT);

    expect(script).toContain("document.querySelector<HTMLElement>('[data-admin-resources-status]')");
    expect(script).not.toContain("root.querySelector<HTMLElement>('[data-admin-resources-status]')");
    expect(script).toContain("document.querySelector<HTMLElement>('#admin-resources-status-live')");
    expect(script).toContain('statusLive.textContent = message');
    expect(script).toContain('未找到 [data-admin-resources-status]');
  });

  it('reports loaded and empty states after a successful list request', async () => {
    const script = await read(SCRIPT);

    expect(script).toContain('已载入 ${lastResult.totalCount} 个资源');
    expect(script).toContain("'当前筛选下没有资源'");
  });
});
