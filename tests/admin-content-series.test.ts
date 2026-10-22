import { describe, expect, it } from 'vitest';
import {
  buildAdminContentListGroups,
  buildAdminContentListProjectGroups,
  buildAdminContentListProjectSections,
  buildAdminContentListSections,
  compareAdminContentSeriesVersions,
  getAdminContentSeriesDisplayTitle,
  resolveAdminContentProjectVersionStates,
  resolveAdminContentSeriesVersionStates
} from '../src/lib/admin-console/content-series';

type VersionInput = {
  id: string;
  series: string | null;
  dateText?: string | null;
  versionOrder?: number | null;
  title?: string;
  versionName?: string | null;
};

const version = ({
  id,
  series,
  dateText = '2026-01-01',
  versionOrder = null,
  title = id,
  versionName = null
}: VersionInput) => ({
  id,
  series,
  title,
  versionName,
  date: dateText ? new Date(`${dateText}T00:00:00+08:00`) : null,
  versionOrder
});

const withStates = (items: ReturnType<typeof version>[]) => {
  const states = resolveAdminContentSeriesVersionStates(items);
  return items.map((item) => ({
    ...item,
    ...(states.get(item.id) ?? { isLatestVersion: true, versionGroupSize: 1 })
  }));
};

type ProjectVersionInput = {
  id: string;
  projectSlug: string | null;
  dateText?: string | null;
  versionOrder?: number | null;
  title?: string;
  versionLabel?: string | null;
  versionName?: string | null;
};

const projectVersion = ({
  id,
  projectSlug,
  dateText = '2026-01-01',
  versionOrder = null,
  title = id,
  versionLabel = null,
  versionName = null
}: ProjectVersionInput) => ({
  id,
  projectSlug,
  title,
  versionLabel,
  versionName,
  date: dateText ? new Date(`${dateText}T00:00:00+08:00`) : null,
  versionOrder
});

const withProjectStates = (items: ReturnType<typeof projectVersion>[]) => {
  const states = resolveAdminContentProjectVersionStates(items);
  return items.map((item) => ({
    ...item,
    ...(states.get(item.id) ?? { isLatestVersion: true, versionGroupSize: 1 })
  }));
};

describe('admin-console/content-series', () => {
  it('sorts versions by date and marks only the newest one as latest', () => {
    const items = [
      version({ id: 'post-v1', series: 'post', dateText: '2026-01-01' }),
      version({ id: 'post-v2', series: 'post', dateText: '2026-03-01' })
    ];

    expect(items.slice().sort(compareAdminContentSeriesVersions).map((item) => item.id))
      .toEqual(['post-v2', 'post-v1']);

    const states = resolveAdminContentSeriesVersionStates(items);

    expect(states.get('post-v2')).toEqual({ isLatestVersion: true, versionGroupSize: 2 });
    expect(states.get('post-v1')).toEqual({ isLatestVersion: false, versionGroupSize: 2 });
  });

  it('uses versionOrder then entryId to break date ties', () => {
    const items = [
      version({ id: 'post-order-1', series: 'post', dateText: '2026-01-01', versionOrder: 1 }),
      version({ id: 'post-order-2', series: 'post', dateText: '2026-01-01', versionOrder: 2 }),
      version({ id: 'post-order-2-b', series: 'post', dateText: '2026-01-01', versionOrder: 2 })
    ];

    const states = resolveAdminContentSeriesVersionStates(items);

    // 同 date / versionOrder 时按 entryId 升序兜底，最新版必须稳定可复现。
    expect(states.get('post-order-2')?.isLatestVersion).toBe(true);
    expect(states.get('post-order-2-b')?.isLatestVersion).toBe(false);
    expect(states.get('post-order-1')?.isLatestVersion).toBe(false);
  });

  it('treats entries without a series as their own single version', () => {
    const items = [
      version({ id: 'single-a', series: null }),
      version({ id: 'single-b', series: null, dateText: '2026-02-01' })
    ];

    const states = resolveAdminContentSeriesVersionStates(items);
    const groups = buildAdminContentListGroups(withStates(items));

    expect(states.get('single-a')).toEqual({ isLatestVersion: true, versionGroupSize: 1 });
    expect(states.get('single-b')).toEqual({ isLatestVersion: true, versionGroupSize: 1 });
    expect(groups).toEqual([
      {
        kind: 'entry',
        key: 'entry:single-a',
        item: expect.objectContaining({ id: 'single-a' })
      },
      {
        kind: 'entry',
        key: 'entry:single-b',
        item: expect.objectContaining({ id: 'single-b' })
      }
    ]);
  });

  it('groups series versions at their first list position and keeps single entries inline', () => {
    const items = withStates([
      version({ id: 'post-v1', series: 'post', dateText: '2026-01-01', title: '旧标题', versionName: '初版' }),
      version({ id: 'single', series: null, dateText: '2026-02-01' }),
      version({ id: 'post-v2', series: 'post', dateText: '2026-03-01', title: '系列名: 最新版', versionName: '最新版' })
    ]);

    const groups = buildAdminContentListGroups(items);

    expect(groups.map((group) => group.kind)).toEqual(['series', 'entry']);
    const seriesGroup = groups[0];
    expect(seriesGroup).toMatchObject({
      kind: 'series',
      key: 'series:post',
      series: 'post',
      title: '系列名: 最新版',
      displayTitle: '系列名',
      versionCount: 2
    });
    if (seriesGroup?.kind !== 'series') throw new Error('expected a series group');
    expect(seriesGroup.items.map((item) => item.id)).toEqual(['post-v2', 'post-v1']);
    expect(groups[1]).toMatchObject({ kind: 'entry', item: { id: 'single' } });
  });

  it('lists standalone entries first, then series sections', () => {
    const items = withStates([
      version({ id: 'post-v1', series: 'post', dateText: '2026-01-01', title: '系列名：最新版', versionName: '最新版' }),
      version({ id: 'single-a', series: null, dateText: '2026-02-01' }),
      version({ id: 'post-v2', series: 'post', dateText: '2026-03-01', title: '系列名：最新版', versionName: '最新版' }),
      version({ id: 'single-b', series: null, dateText: '2026-02-02' })
    ]);

    const sections = buildAdminContentListSections(items);

    expect(sections.map((section) => section.kind)).toEqual(['standalone', 'series']);

    const standaloneSection = sections[0];
    expect(standaloneSection).toMatchObject({
      kind: 'standalone',
      key: 'standalone',
      label: '单篇文章',
      count: 2
    });
    if (standaloneSection?.kind !== 'standalone') throw new Error('expected a standalone section');
    expect(standaloneSection.items.map((item) => item.id)).toEqual(['single-a', 'single-b']);

    const seriesSection = sections[1];
    expect(seriesSection).toMatchObject({
      kind: 'series',
      key: 'series',
      label: '系列',
      count: 1
    });
    if (seriesSection?.kind !== 'series') throw new Error('expected a series section');
    expect(seriesSection.groups.map((group) => group.series)).toEqual(['post']);
    expect(seriesSection.groups[0]?.displayTitle).toBe('系列名');
  });

  it('omits empty sections so subheads only render for real content', () => {
    const standaloneOnly = withStates([
      version({ id: 'single', series: null })
    ]);
    const seriesOnly = withStates([
      version({ id: 'post-v1', series: 'post', dateText: '2026-01-01' }),
      version({ id: 'post-v2', series: 'post', dateText: '2026-02-01' })
    ]);

    expect(buildAdminContentListSections(standaloneOnly).map((section) => section.kind))
      .toEqual(['standalone']);
    expect(buildAdminContentListSections(seriesOnly).map((section) => section.kind))
      .toEqual(['series']);
  });

  it('keeps the full version count when a page only shows part of a series', () => {
    const items = [
      {
        ...version({ id: 'post-v2', series: 'post', dateText: '2026-03-01' }),
        isLatestVersion: true,
        versionGroupSize: 3
      }
    ];

    const groups = buildAdminContentListGroups(items);

    expect(groups[0]).toMatchObject({
      kind: 'series',
      title: 'post-v2',
      versionCount: 3
    });
  });

  it('sorts null dates after dated versions', () => {
    const items = [
      version({ id: 'post-undated', series: 'post', dateText: null }),
      version({ id: 'post-dated', series: 'post', dateText: '2026-01-01' })
    ];

    expect(items.slice().sort(compareAdminContentSeriesVersions).map((item) => item.id))
      .toEqual(['post-dated', 'post-undated']);
    expect(resolveAdminContentSeriesVersionStates(items).get('post-dated')?.isLatestVersion).toBe(true);
  });
});

describe('admin-console/content-series projects', () => {
  it('marks the latest version per project stable slug and counts the group', () => {
    const items = [
      projectVersion({ id: 'demo-v1', projectSlug: 'demo', dateText: '2026-01-01', versionOrder: 1 }),
      projectVersion({ id: 'demo-v2', projectSlug: 'demo', dateText: '2026-03-01', versionOrder: 2 }),
      projectVersion({ id: 'single', projectSlug: 'single', dateText: '2026-02-01' })
    ];

    const states = resolveAdminContentProjectVersionStates(items);

    expect(states.get('demo-v2')).toEqual({ isLatestVersion: true, versionGroupSize: 2 });
    expect(states.get('demo-v1')).toEqual({ isLatestVersion: false, versionGroupSize: 2 });
    expect(states.get('single')).toEqual({ isLatestVersion: true, versionGroupSize: 1 });
  });

  it('uses versionOrder when project versions share a date', () => {
    const items = [
      projectVersion({ id: 'demo-v1', projectSlug: 'demo', dateText: '2026-01-01', versionOrder: 1 }),
      projectVersion({ id: 'demo-v2', projectSlug: 'demo', dateText: '2026-01-01', versionOrder: 2 })
    ];

    const states = resolveAdminContentProjectVersionStates(items);

    expect(states.get('demo-v2')?.isLatestVersion).toBe(true);
    expect(states.get('demo-v1')?.isLatestVersion).toBe(false);
  });

  it('groups project versions by stable slug and keeps single-version projects grouped', () => {
    const items = withProjectStates([
      projectVersion({
        id: 'demo-v1',
        projectSlug: 'demo',
        dateText: '2026-01-01',
        versionOrder: 1,
        title: 'Demo',
        versionLabel: 'v1.0.0',
        versionName: '初版'
      }),
      projectVersion({
        id: 'single',
        projectSlug: 'single',
        dateText: '2026-02-01',
        title: 'Single Project'
      }),
      projectVersion({
        id: 'demo-v2',
        projectSlug: 'demo',
        dateText: '2026-03-01',
        versionOrder: 2,
        title: 'Demo',
        versionLabel: 'v2.0.0',
        versionName: '新版'
      })
    ]);

    const groups = buildAdminContentListProjectGroups(items);

    expect(groups.map((group) => group.projectSlug)).toEqual(['demo', 'single']);

    const demoGroup = groups[0];
    expect(demoGroup).toMatchObject({
      kind: 'project',
      key: 'project:demo',
      projectSlug: 'demo',
      title: 'Demo',
      displayTitle: 'Demo',
      versionCount: 2
    });
    expect(demoGroup?.items.map((item) => item.id)).toEqual(['demo-v2', 'demo-v1']);
    expect(demoGroup?.items.map((item) => item.isLatestVersion)).toEqual([true, false]);

    const singleGroup = groups[1];
    expect(singleGroup).toMatchObject({
      kind: 'project',
      key: 'project:single',
      projectSlug: 'single',
      displayTitle: 'Single Project',
      versionCount: 1
    });
    expect(singleGroup?.items.map((item) => item.id)).toEqual(['single']);
  });

  it('keeps entries without a project slug as separate single-version groups', () => {
    const items = withProjectStates([
      projectVersion({ id: 'loose-a', projectSlug: null }),
      projectVersion({ id: 'loose-b', projectSlug: null })
    ]);

    const groups = buildAdminContentListProjectGroups(items);

    expect(groups.map((group) => group.projectSlug)).toEqual(['loose-a', 'loose-b']);
    expect(groups.map((group) => group.versionCount)).toEqual([1, 1]);
  });

  it('builds one project section whose count is the number of projects', () => {
    const items = withProjectStates([
      projectVersion({ id: 'demo-v1', projectSlug: 'demo', dateText: '2026-01-01' }),
      projectVersion({ id: 'demo-v2', projectSlug: 'demo', dateText: '2026-02-01' }),
      projectVersion({ id: 'single', projectSlug: 'single' })
    ]);

    const sections = buildAdminContentListProjectSections(items);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      kind: 'project',
      key: 'project',
      label: '项目',
      count: 2
    });
    expect(buildAdminContentListProjectSections([])).toEqual([]);
  });
});

describe('getAdminContentSeriesDisplayTitle', () => {
  it('strips a trailing version name after either colon style', () => {
    expect(getAdminContentSeriesDisplayTitle('资源管理演示：最新版', 'resource-demo', '最新版'))
      .toBe('资源管理演示');
    expect(getAdminContentSeriesDisplayTitle('资源管理演示: 最新版', 'resource-demo', '最新版'))
      .toBe('资源管理演示');
    expect(getAdminContentSeriesDisplayTitle('资源管理演示 ： 最新版 ', 'resource-demo', '最新版'))
      .toBe('资源管理演示');
  });

  it('keeps the title when the suffix does not match and falls back to the series slug', () => {
    expect(getAdminContentSeriesDisplayTitle('资源管理演示：初版', 'resource-demo', '最新版'))
      .toBe('资源管理演示：初版');
    expect(getAdminContentSeriesDisplayTitle('资源管理演示', 'resource-demo'))
      .toBe('资源管理演示');
    expect(getAdminContentSeriesDisplayTitle('   ', 'resource-demo', '最新版'))
      .toBe('resource-demo');
  });

  it('escapes regex characters in the version name', () => {
    expect(getAdminContentSeriesDisplayTitle('Demo: v1.0 (latest)', 'demo', 'v1.0 (latest)'))
      .toBe('Demo');
  });
});
