import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import { getArchiveRows, getProjectVersionHistory } from '../src/lib/archive';

const getCollectionMock = vi.mocked(getCollection);

const projectData = {
  title: '站点体验优化',
  subtitle: '从列表密度到移动端触控的体验整理',
  description: '记录列表、卡片与移动端交互的体验检查与调整。',
  type: '演示',
  date: new Date('2026-08-20T00:00:00.000Z'),
  dateText: '2026-08-20',
  dateHasTime: false,
  draft: false,
  versionLabel: 'v2.0',
  versionName: '体验整理',
  versionSummary: '统一列表、卡片与移动端交互。',
  versionOrder: 2,
  versions: [
    {
      label: 'v1.1',
      name: '列表与触控',
      date: new Date('2026-08-18T00:00:00.000Z'),
      dateText: '2026-08-18',
      hasTime: false,
      summary: '调整列表密度与移动端触控热区。',
      order: 1
    },
    {
      label: 'v1.0',
      name: '初版',
      date: new Date('2026-08-12T00:00:00.000Z'),
      dateText: '2026-08-12',
      hasTime: false,
      summary: '建立站点体验检查的初始范围。',
      order: 0
    }
  ]
};

describe('getProjectVersionHistory', () => {
  it('当前版本在首位，历史版本按日期倒序，并保留 label/name/date/summary', () => {
    const versions = getProjectVersionHistory(projectData, '2026-08-20');
    expect(versions.map((version) => [version.label, version.isCurrent])).toEqual([
      ['v2.0', true],
      ['v1.1', false],
      ['v1.0', false]
    ]);
    expect(versions[0]).toMatchObject({
      name: '体验整理',
      dateText: '2026-08-20',
      summary: '统一列表、卡片与移动端交互。'
    });
    expect(versions[1]).toMatchObject({
      name: '列表与触控',
      dateText: '2026-08-18',
      summary: '调整列表密度与移动端触控热区。'
    });
  });

  it('旧项目没有 versionLabel 时完全不产生版本历史', () => {
    const { versionLabel: _label, versionName: _name, versionSummary: _summary, versionOrder: _order, versions: _versions, ...legacy } = projectData;
    expect(getProjectVersionHistory({ ...legacy, versionLabel: undefined }, '2026-08-20')).toEqual([]);
  });

  it('空白字段回退为 null，不渲染空节点内容', () => {
    const versions = getProjectVersionHistory({
      versionLabel: ' v1.0 ',
      versionName: '  ',
      versionSummary: ''
    }, '2026-01-01');
    expect(versions).toEqual([
      {
        label: 'v1.0',
        name: null,
        dateText: '2026-01-01',
        summary: null,
        order: 0,
        isCurrent: true
      }
    ]);
  });
});

describe('archive project rows', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it('把项目当前大版本字段与历史版本数组带进归档行', async () => {
    getCollectionMock.mockImplementation(async (collection: string) => {
      if (collection === 'projects') {
        return [{ id: '2026-08-20-站点体验优化', data: projectData, body: '' }] as never;
      }
      return [] as never;
    });

    const rows = await getArchiveRows();
    const row = rows.find((item) => item.kind === 'projects');
    expect(row).toMatchObject({
      title: '站点体验优化',
      versionLabel: 'v2.0',
      versionName: '体验整理',
      versionSummary: '统一列表、卡片与移动端交互。',
      versionOrder: 2,
      isLatest: true
    });
    expect(row?.projectVersions?.map((version) => version.label)).toEqual(['v2.0', 'v1.1', 'v1.0']);
  });
});

describe('项目大版本页面契约', () => {
  it('卡片展示当前版本，弹窗用版本历史区与更新日志区分', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const page = await readFile(path.join(process.cwd(), 'src/pages/projects/index.astro'), 'utf8');
    expect(page).toContain('project-card__version');
    expect(page).toContain('project-versions__title');
    expect(page).toContain('大版本记录；逐条改动见下方更新日志。');
    expect(page).toContain("version.isCurrent ? <span class=\"project-version__status\">当前版本</span> : null");
  });

  it('demo 项目带上当前版本与历史版本 frontmatter', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    for (const file of [
      'content/projects/2026-08-20-站点体验优化/index.md',
      'content/projects/2026-09-08-内容发布流水线/index.md'
    ]) {
      const source = await readFile(path.join(process.cwd(), file), 'utf8');
      expect(source, file).toMatch(/^versionLabel: v2\.0$/m);
      expect(source, file).toMatch(/^versions:$/m);
      expect(source, file).toContain('    date: 2026-');
    }
  });
});
