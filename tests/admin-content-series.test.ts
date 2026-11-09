import { describe, expect, it } from 'vitest';
import {
  buildAdminContentListProjectGroups,
  buildAdminContentListProjectSections,
  buildAdminContentListSections,
  buildAdminContentListVersionGroups,
  buildAdminContentSeriesBadges,
  compareAdminContentVersions,
  getAdminContentGroupDisplayTitle,
  getAdminContentSeriesBadgeLabel,
  resolveAdminContentProjectVersionStates,
  resolveAdminContentVersionGroupStates
} from '../src/lib/admin-console/content-series';

type VersionInput = {
  id: string;
  versionGroup: string | null;
  dateText?: string | null;
  versionOrder?: number | null;
  title?: string;
  versionName?: string | null;
};

const version = ({
  id,
  versionGroup,
  dateText = '2026-01-01',
  versionOrder = null,
  title = id,
  versionName = null
}: VersionInput) => ({
  id,
  versionGroup,
  title,
  versionName,
  date: dateText ? new Date(`${dateText}T00:00:00+08:00`) : null,
  versionOrder
});

const withStates = (items: ReturnType<typeof version>[]) => {
  const states = resolveAdminContentVersionGroupStates(items);
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

describe('admin-console/content-series version groups', () => {
  it('sorts versions by date and marks only the newest one as latest', () => {
    const items = [
      version({ id: 'post-v1', versionGroup: 'post', dateText: '2026-01-01' }),
      version({ id: 'post-v2', versionGroup: 'post', dateText: '2026-03-01' })
    ];

    expect(items.slice().sort(compareAdminContentVersions).map((item) => item.id))
      .toEqual(['post-v2', 'post-v1']);

    const states = resolveAdminContentVersionGroupStates(items);

    expect(states.get('post-v2')).toEqual({ isLatestVersion: true, versionGroupSize: 2 });
    expect(states.get('post-v1')).toEqual({ isLatestVersion: false, versionGroupSize: 2 });
  });

  it('uses versionOrder then entryId to break date ties', () => {
    const items = [
      version({ id: 'post-order-1', versionGroup: 'post', dateText: '2026-01-01', versionOrder: 1 }),
      version({ id: 'post-order-2', versionGroup: 'post', dateText: '2026-01-01', versionOrder: 2 }),
      version({ id: 'post-order-2-b', versionGroup: 'post', dateText: '2026-01-01', versionOrder: 2 })
    ];

    const states = resolveAdminContentVersionGroupStates(items);

    // 同 date / versionOrder 时按 entryId 升序兜底，最新版必须稳定可复现。
    expect(states.get('post-order-2')?.isLatestVersion).toBe(true);
    expect(states.get('post-order-2-b')?.isLatestVersion).toBe(false);
    expect(states.get('post-order-1')?.isLatestVersion).toBe(false);
  });

  it('treats entries without a version group as their own single version', () => {
    const items = [
      version({ id: 'single-a', versionGroup: null }),
      version({ id: 'single-b', versionGroup: null, dateText: '2026-02-01' })
    ];

    const states = resolveAdminContentVersionGroupStates(items);
    const groups = buildAdminContentListVersionGroups(withStates(items));

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

  it('groups version group members at their first list position and keeps single entries inline', () => {
    const items = withStates([
      version({ id: 'post-v1', versionGroup: 'post', dateText: '2026-01-01', title: '旧标题', versionName: '初版' }),
      version({ id: 'single', versionGroup: null, dateText: '2026-02-01' }),
      version({ id: 'post-v2', versionGroup: 'post', dateText: '2026-03-01', title: '组名: 最新版', versionName: '最新版' })
    ]);

    const groups = buildAdminContentListVersionGroups(items);

    expect(groups.map((group) => group.kind)).toEqual(['version-group', 'entry']);
    const versionGroup = groups[0];
    expect(versionGroup).toMatchObject({
      kind: 'version-group',
      key: 'versionGroup:post',
      versionGroup: 'post',
      title: '组名: 最新版',
      displayTitle: '组名',
      versionCount: 2
    });
    if (versionGroup?.kind !== 'version-group') throw new Error('expected a version group');
    expect(versionGroup.items.map((item) => item.id)).toEqual(['post-v2', 'post-v1']);
    expect(groups[1]).toMatchObject({ kind: 'entry', item: { id: 'single' } });
  });

  it('lists standalone entries first, then version group sections', () => {
    const items = withStates([
      version({ id: 'post-v1', versionGroup: 'post', dateText: '2026-01-01', title: '组名：最新版', versionName: '最新版' }),
      version({ id: 'single-a', versionGroup: null, dateText: '2026-02-01' }),
      version({ id: 'post-v2', versionGroup: 'post', dateText: '2026-03-01', title: '组名：最新版', versionName: '最新版' }),
      version({ id: 'single-b', versionGroup: null, dateText: '2026-02-02' })
    ]);

    const sections = buildAdminContentListSections(items);

    expect(sections.map((section) => section.kind)).toEqual(['standalone', 'version-group']);

    const standaloneSection = sections[0];
    expect(standaloneSection).toMatchObject({
      kind: 'standalone',
      key: 'standalone',
      label: '单篇文章',
      count: 2
    });
    if (standaloneSection?.kind !== 'standalone') throw new Error('expected a standalone section');
    expect(standaloneSection.items.map((item) => item.id)).toEqual(['single-a', 'single-b']);

    const versionGroupSection = sections[1];
    expect(versionGroupSection).toMatchObject({
      kind: 'version-group',
      key: 'version-group',
      // 版本家族只叫「版本组」，不再与内容系列混称。
      label: '版本组',
      count: 1
    });
    if (versionGroupSection?.kind !== 'version-group') throw new Error('expected a version group section');
    expect(versionGroupSection.groups.map((group) => group.versionGroup)).toEqual(['post']);
    expect(versionGroupSection.groups[0]?.displayTitle).toBe('组名');
  });

  it('omits empty sections so subheads only render for real content', () => {
    const standaloneOnly = withStates([
      version({ id: 'single', versionGroup: null })
    ]);
    const versionGroupOnly = withStates([
      version({ id: 'post-v1', versionGroup: 'post', dateText: '2026-01-01' }),
      version({ id: 'post-v2', versionGroup: 'post', dateText: '2026-02-01' })
    ]);

    expect(buildAdminContentListSections(standaloneOnly).map((section) => section.kind))
      .toEqual(['standalone']);
    expect(buildAdminContentListSections(versionGroupOnly).map((section) => section.kind))
      .toEqual(['version-group']);
  });

  it('keeps the full version count when a page only shows part of a version group', () => {
    const items = [
      {
        ...version({ id: 'post-v2', versionGroup: 'post', dateText: '2026-03-01' }),
        isLatestVersion: true,
        versionGroupSize: 3
      }
    ];

    const groups = buildAdminContentListVersionGroups(items);

    expect(groups[0]).toMatchObject({
      kind: 'version-group',
      title: 'post-v2',
      versionCount: 3
    });
  });

  it('sorts null dates after dated versions', () => {
    const items = [
      version({ id: 'post-undated', versionGroup: 'post', dateText: null }),
      version({ id: 'post-dated', versionGroup: 'post', dateText: '2026-01-01' })
    ];

    expect(items.slice().sort(compareAdminContentVersions).map((item) => item.id))
      .toEqual(['post-dated', 'post-undated']);
    expect(resolveAdminContentVersionGroupStates(items).get('post-dated')?.isLatestVersion).toBe(true);
  });
});

describe('admin-console/content-series badges', () => {
  type SeriesInput = {
    id: string;
    series: string | null;
    seriesName?: string | null;
    seriesOrder?: number | null;
    versionGroup?: string | null;
    dateText?: string;
    title?: string;
  };

  const seriesItem = ({
    id,
    series,
    seriesName = null,
    seriesOrder = null,
    versionGroup = null,
    dateText = '2026-01-01',
    title = id
  }: SeriesInput) => ({
    id,
    title,
    series,
    seriesName,
    seriesOrder,
    versionGroup,
    date: new Date(`${dateText}T00:00:00+08:00`),
    versionOrder: null
  });

  it('numbers series members by seriesOrder and falls back to the series slug', () => {
    const badges = buildAdminContentSeriesBadges([
      seriesItem({ id: 'build-2', series: 'pc-build', seriesName: '折腾主机', seriesOrder: 2 }),
      seriesItem({ id: 'build-1', series: 'pc-build', seriesName: '折腾主机', seriesOrder: 1 }),
      seriesItem({ id: 'build-3', series: 'pc-build', seriesOrder: 3 })
    ]);

    expect(badges.get('build-1')).toEqual({ series: 'pc-build', name: '折腾主机', index: 1, total: 3 });
    expect(badges.get('build-2')).toEqual({ series: 'pc-build', name: '折腾主机', index: 2, total: 3 });
    expect(badges.get('build-3')).toEqual({ series: 'pc-build', name: '折腾主机', index: 3, total: 3 });
  });

  it('puts members without seriesOrder after ordered ones, ordered by date', () => {
    const badges = buildAdminContentSeriesBadges([
      seriesItem({ id: 'undated', series: 'pc-build', dateText: '2026-05-01' }),
      seriesItem({ id: 'first', series: 'pc-build', seriesOrder: 0, dateText: '2026-06-01' })
    ]);

    expect(badges.get('first')?.index).toBe(1);
    expect(badges.get('undated')?.index).toBe(2);
  });

  it('does not emit a badge for entries outside any series', () => {
    const badges = buildAdminContentSeriesBadges([
      seriesItem({ id: 'loose', series: null }),
      seriesItem({ id: 'build-1', series: 'pc-build' })
    ]);

    expect(badges.has('loose')).toBe(false);
    expect(badges.get('build-1')?.index).toBe(1);
  });

  it('counts each version group once and shares the badge with its other versions', () => {
    const badges = buildAdminContentSeriesBadges([
      seriesItem({
        id: 'build-v1',
        series: 'pc-build',
        seriesName: '折腾主机',
        seriesOrder: 1,
        versionGroup: 'pc-build-post',
        dateText: '2026-01-01'
      }),
      seriesItem({
        id: 'build-v2',
        series: 'pc-build',
        seriesName: '折腾主机',
        seriesOrder: 1,
        versionGroup: 'pc-build-post',
        dateText: '2026-03-01'
      }),
      seriesItem({ id: 'other', series: 'pc-build', seriesOrder: 2 })
    ]);

    // 同一版本组只算一篇：系列总篇数是 2，两个版本共享同一枚徽标。
    expect(badges.get('build-v1')).toEqual({ series: 'pc-build', name: '折腾主机', index: 1, total: 2 });
    expect(badges.get('build-v2')).toEqual({ series: 'pc-build', name: '折腾主机', index: 1, total: 2 });
    expect(badges.get('other')).toEqual({ series: 'pc-build', name: '折腾主机', index: 2, total: 2 });
  });

  it('formats the row label as a reading position, never a version number', () => {
    expect(getAdminContentSeriesBadgeLabel({
      name: '折腾主机',
      index: 2,
      total: 5
    })).toBe('折腾主机 · 第 2/5 篇');
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

describe('getAdminContentGroupDisplayTitle', () => {
  it('strips a trailing version name after either colon style', () => {
    expect(getAdminContentGroupDisplayTitle('资源管理演示：最新版', 'resource-demo', '最新版'))
      .toBe('资源管理演示');
    expect(getAdminContentGroupDisplayTitle('资源管理演示: 最新版', 'resource-demo', '最新版'))
      .toBe('资源管理演示');
    expect(getAdminContentGroupDisplayTitle('资源管理演示 ： 最新版 ', 'resource-demo', '最新版'))
      .toBe('资源管理演示');
  });

  it('keeps the title when the suffix does not match and falls back to the group key', () => {
    expect(getAdminContentGroupDisplayTitle('资源管理演示：初版', 'resource-demo', '最新版'))
      .toBe('资源管理演示：初版');
    expect(getAdminContentGroupDisplayTitle('资源管理演示', 'resource-demo'))
      .toBe('资源管理演示');
    expect(getAdminContentGroupDisplayTitle('   ', 'resource-demo', '最新版'))
      .toBe('resource-demo');
  });

  it('escapes regex characters in the version name', () => {
    expect(getAdminContentGroupDisplayTitle('Demo: v1.0 (latest)', 'demo', 'v1.0 (latest)'))
      .toBe('Demo');
  });
});
