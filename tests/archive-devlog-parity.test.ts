import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readModuleDir } from './module-source-reader';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import { getArchiveRows } from '../src/lib/archive';
import { getVisibleDevlogs } from '../src/lib/content';
import { flattenEntryIdToSlug } from '../src/utils/slug-rules';
import { deriveEntryDescription } from '../src/lib/entry-body';


const getCollectionMock = vi.mocked(getCollection);

const devlogEntry = (id: string, dateText: string, data: Record<string, unknown> = {}) => ({
  id,
  data: {
    title: id,
    project: 'NixOS 发布看板',
    date: new Date(`${dateText}T00:00:00+08:00`),
    dateText,
    draft: false,
    ...data
  },
  body: ''
});

const DEVLOGS = [
  devlogEntry('nixos-release-board/2025-11-30-xantusia-board', '2025-11-30', {
    title: '发布看板适配 25.11',
    projectSlug: 'nixos-release-board',
    kind: 'feature',
    description: '补齐 25.11 版本行。'
  }),
  devlogEntry('nixos-release-board/2025-05-30-warbler-board', '2025-05-30', {
    title: '发布看板适配 25.05',
    projectSlug: 'nixos-release-board',
    kind: 'improvement',
    description: '更新版本时间线。'
  }),
  devlogEntry('whono-theme/2026-03-02-image-paths', '2026-03-02', {
    title: '图片路径迁移',
    project: 'Whono Astro 主题',
    projectSlug: 'whono-theme',
    kind: 'breaking'
  })
];
DEVLOGS[2]!.body = '正文里的第一段会被归档行当作摘要，与 /devlog/ 页保持一致。';

const mockCollections = () => {
  getCollectionMock.mockImplementation(async (collection: string) => {
    if (collection === 'devlog') return DEVLOGS as never;
    return [] as never;
  });
};

describe('归档更新行与 /devlog/ 数据一致', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    mockCollections();
  });

  it('条目集合、标题、项目、日期与锚点逐条对齐', async () => {
    const [rows, devlogs] = await Promise.all([getArchiveRows(), getVisibleDevlogs()]);
    const devlogRows = rows.filter((row) => row.kind === 'devlog');

    expect(devlogRows).toHaveLength(devlogs.length);

    const byId = new Map(devlogRows.map((row) => [row.id, row]));
    for (const entry of devlogs) {
      const row = byId.get(entry.id);
      expect(row, `归档缺少 devlog：${entry.id}`).toBeDefined();
      expect(row!.title).toBe(entry.data.title);
      expect(row!.project).toBe(entry.data.project);
      expect(row!.dateText).toBe(entry.data.dateText);
      expect(row!.href).toBe(`/devlog/#${flattenEntryIdToSlug(entry.id)}`);
      expect(row!.description).toBe(deriveEntryDescription(entry.data.description, entry.body) ?? '');
    }
  });

  it('归档默认不分页，避免较早的 devlog 被藏到第二页', async () => {
    const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');
    const [pageJson, shared, archivePage] = await Promise.all([
      read('src/data/settings/page.json'),
      readModuleDir(process.cwd(), 'src/lib/admin-console/theme-shared'),
      read('src/pages/archive/index.astro')
    ]);

    expect(JSON.parse(pageJson).pagination.archive.enabled).toBe(false);
    expect(shared).toMatch(/archive: \{ enabled: false, pageSize: 20 \}/);
    expect(archivePage).toContain('enabled: false, pageSize: 20');
  });

  it('归档行的排序与 /devlog/ 的日期倒序一致', async () => {
    const [rows, devlogs] = await Promise.all([getArchiveRows(), getVisibleDevlogs()]);
    const archiveOrder = rows.filter((row) => row.kind === 'devlog').map((row) => row.id);
    const devlogOrder = devlogs.map((entry) => entry.id);

    expect(archiveOrder).toEqual(devlogOrder);
  });
});
