import { describe, expect, it, vi } from 'vitest';
import {
  buildProjectGroups,
  buildProjectResolver,
  getProjectAnchorAliases,
  getProjectGroupKey,
  getProjectLatestAnchor,
  getProjectStableSlug,
  resolveProjectAnchor,
  sortProjectVersions,
  type ProjectEntryData,
  type ProjectEntryLike
} from '../src/lib/project-routing';

const entry = (
  id: string,
  dateText: string,
  data: Partial<ProjectEntryData> = {}
): ProjectEntryLike => ({
  id,
  data: {
    title: data.title ?? id,
    date: new Date(`${dateText}T00:00:00+08:00`),
    dateText,
    ...data
  }
});

const legacyVersion = (label: string, dateText: string, extra: Record<string, unknown> = {}) => ({
  label,
  dateText,
  date: new Date(`${dateText}T00:00:00+08:00`),
  ...extra
});

describe('project routing anchors', () => {
  it('keeps a project without slug on its dated entry id anchor', () => {
    const project = entry('2026-08-20-站点体验优化', '2026-08-20');
    const groups = buildProjectGroups([project]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group?.slug).toBeNull();
    expect(group?.latestAnchor).toBe('2026-08-20-站点体验优化');
    expect(group?.latest).toMatchObject({
      anchor: '2026-08-20-站点体验优化',
      href: '/projects/#2026-08-20-站点体验优化',
      isLatest: true,
      hasDocument: true
    });
    // 没有 slug 时锚点就是 entry.id 压平值，不再生成别名
    expect(getProjectAnchorAliases(group!)).toEqual([]);
    expect(getProjectStableSlug(project)).toBeNull();
    expect(getProjectLatestAnchor(project)).toBe('2026-08-20-站点体验优化');
    expect(getProjectGroupKey(project)).toBe('single:2026-08-20-站点体验优化');
  });

  it('treats a slug equal to the dated entry id as single-version, with one anchor', () => {
    const project = entry('2026-01-02-sample', '2026-01-02', { slug: '2026-01-02-sample' });
    const groups = buildProjectGroups([project]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.slug).toBeNull();
    expect(groups[0]?.latestAnchor).toBe('2026-01-02-sample');
    expect(groups[0]?.versions).toHaveLength(1);
    expect(getProjectAnchorAliases(groups[0]!)).toEqual([]);
  });

  it('treats any date-form slug as single-version even when it differs from the entry id', () => {
    const project = entry('2026-01-01-sample', '2026-01-01', { slug: '2026-01-05-other' });
    const groups = buildProjectGroups([project]);

    expect(groups[0]?.slug).toBeNull();
    expect(groups[0]?.latestAnchor).toBe('2026-01-01-sample');
  });

  it('supports a non-dated latest directory whose name equals the stable slug', () => {
    const groups = buildProjectGroups([
      entry('2024-11-30-nixos-release-board', '2024-11-30', {
        slug: 'nixos-release-board',
        versionLabel: '24.11'
      }),
      entry('2025-05-30-nixos-release-board', '2025-05-30', {
        slug: 'nixos-release-board',
        versionLabel: '25.05'
      }),
      entry('nixos-release-board', '2025-11-30', {
        slug: 'nixos-release-board',
        versionLabel: '25.11'
      })
    ]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group?.slug).toBe('nixos-release-board');
    expect(group?.latestAnchor).toBe('nixos-release-board');
    expect(group?.versions.map((version) => version.anchor)).toEqual([
      'nixos-release-board',
      '2025-05-30-nixos-release-board',
      '2024-11-30-nixos-release-board'
    ]);
    expect(getProjectAnchorAliases(group!)).toEqual([]);
  });

  it('groups shared custom-slug documents, latest first, history on dated anchors', () => {
    const groups = buildProjectGroups([
      entry('2026-01-01-content-workflow', '2026-01-01', {
        slug: 'content-workflow',
        title: '内容流程',
        versionLabel: 'v1.0'
      }),
      entry('2026-03-01-content-workflow-v2', '2026-03-01', {
        slug: 'content-workflow',
        title: '内容流程',
        versionLabel: 'v2.0'
      })
    ]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group?.key).toBe('content-workflow');
    expect(group?.slug).toBe('content-workflow');
    expect(group?.latestAnchor).toBe('content-workflow');
    expect(group?.versions.map((version) => [version.entryId, version.anchor, version.isLatest])).toEqual([
      ['2026-03-01-content-workflow-v2', 'content-workflow', true],
      ['2026-01-01-content-workflow', '2026-01-01-content-workflow', false]
    ]);
    // 只有与锚点不同的 entry.id 才登记别名（旧 /projects/#<entryId> 深链兼容）
    expect(getProjectAnchorAliases(group!)).toEqual([
      { entryId: '2026-03-01-content-workflow-v2', anchor: 'content-workflow' }
    ]);
  });

  it('sorts versions by date DESC, then versionOrder DESC, then entryId ASC', () => {
    const documents = sortProjectVersions([
      entry('2026-02-01-a', '2026-02-01', { slug: 'group', versionOrder: 1 }),
      entry('2026-02-01-c', '2026-02-01', { slug: 'group', versionOrder: 2 }),
      entry('2026-02-01-b', '2026-02-01', { slug: 'group', versionOrder: 2 }),
      entry('2026-03-01-old', '2026-03-01', { slug: 'group' })
    ]);

    expect(documents.map((item) => item.id)).toEqual([
      '2026-03-01-old',
      '2026-02-01-b',
      '2026-02-01-c',
      '2026-02-01-a'
    ]);
  });

  it('sorts project groups by their latest version date DESC', () => {
    const groups = buildProjectGroups([
      entry('2026-01-01-old', '2026-01-01'),
      entry('2026-05-01-new', '2026-05-01'),
      entry('2026-03-01-mid', '2026-03-01')
    ]);

    expect(groups.map((group) => group.latest.entryId)).toEqual([
      '2026-05-01-new',
      '2026-03-01-mid',
      '2026-01-01-old'
    ]);
  });

  it('throws an actionable error when two projects produce the same anchor', () => {
    expect(() =>
      buildProjectGroups([
        // 无 slug 项目：锚点 = demo-project
        entry('demo-project', '2026-02-01'),
        // 另一项目把自定义 slug 取成同名：最新版锚点也是 demo-project
        entry('2026-02-02-renamed-demo', '2026-02-02', { slug: 'demo-project' })
      ])
    ).toThrow(/Project anchor conflict detected[\s\S]*How to fix/);
  });

  it('resolves deep links by anchor, then legacy entry id, then latest slug', () => {
    const groups = buildProjectGroups([
      entry('2026-01-01-content-workflow', '2026-01-01', { slug: 'content-workflow' }),
      entry('2026-03-01-content-workflow-v2', '2026-03-01', { slug: 'content-workflow' })
    ]);

    expect(resolveProjectAnchor(groups, '2026-01-01-content-workflow')?.version.isLatest).toBe(false);
    expect(resolveProjectAnchor(groups, '2026-03-01-content-workflow-v2')?.version.isLatest).toBe(true);
    expect(resolveProjectAnchor(groups, 'content-workflow')?.version.isLatest).toBe(true);
    expect(resolveProjectAnchor(groups, 'missing-anchor')).toBeNull();
    expect(resolveProjectAnchor(groups, '  ')).toBeNull();
  });
});

describe('legacy versions metadata', () => {
  it('keeps versions[] as metadata-only history without generating a dialog anchor', () => {
    const groups = buildProjectGroups([
      entry('2026-03-01-content-workflow', '2026-03-01', {
        slug: 'content-workflow',
        versionLabel: 'v2.0',
        versionName: '体验整理',
        versionOrder: 2,
        versions: [
          legacyVersion('v1.0', '2026-01-01', {
            name: '初版',
            summary: '建立初始范围',
            order: 0
          }),
          // 与文档版本同 label + 日期：以文档为准，不重复展示
          legacyVersion('v2.0', '2026-03-01', { order: 2 })
        ]
      })
    ]);

    const [group] = groups;
    expect(group?.versions.map((version) => [version.versionLabel, version.hasDocument, version.anchor])).toEqual([
      ['v2.0', true, 'content-workflow'],
      ['v1.0', false, '']
    ]);

    const legacy = group?.versions[1];
    expect(legacy).toMatchObject({
      entryId: '',
      href: '',
      isLatest: false,
      isCurrent: false,
      versionName: '初版',
      versionSummary: '建立初始范围'
    });
    // legacy 只有元数据，弹窗数量 = 文档版本数量
    expect(group?.versions.filter((version) => version.hasDocument)).toHaveLength(1);
  });

  it('warns once per duplicated versionOrder instead of failing the build', () => {
    const warn = vi.fn();
    buildProjectGroups(
      [
        entry('2026-01-01-content-workflow', '2026-01-01', {
          slug: 'content-workflow',
          versionOrder: 1
        }),
        entry('2026-02-01-content-workflow-v2', '2026-02-01', {
          slug: 'content-workflow',
          versionOrder: 1
        })
      ],
      { warn }
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('duplicate project versionOrder');
  });
});

describe('project resolver for devlog', () => {
  const groups = () =>
    buildProjectGroups([
      entry('2026-01-01-content-workflow', '2026-01-01', {
        slug: 'content-workflow',
        title: '内容流程',
        versionLabel: 'v1.0'
      }),
      entry('2026-02-01-content-workflow-v2', '2026-02-01', {
        slug: 'content-workflow',
        title: '内容流程',
        versionLabel: 'v2.0'
      }),
      entry('2026-02-10-站点体验优化', '2026-02-10', { title: '站点体验优化' }),
      entry('2026-02-11-同名项目-a', '2026-02-11', { slug: 'same-title-a', title: '同名项目' }),
      entry('2026-02-12-同名项目-b', '2026-02-12', { slug: 'same-title-b', title: '同名项目' })
    ]);

  it('resolves projectSlug by stable slug and by legacy entry id', () => {
    const resolver = buildProjectResolver(groups());

    expect(
      resolver.resolveProjectForDevlog({
        id: '2026-03-01-log-a',
        data: { project: '内容流程', projectSlug: 'content-workflow' }
      })?.key
    ).toBe('content-workflow');

    expect(
      resolver.resolveProjectForDevlog({
        id: '2026-03-01-log-b',
        data: { project: '内容流程', projectSlug: '2026-01-01-content-workflow' }
      })?.key
    ).toBe('content-workflow');
  });

  it('falls back to the display title only when the match is unambiguous', () => {
    const resolver = buildProjectResolver(groups());

    expect(
      resolver.resolveProjectForDevlog({
        id: '2026-03-02-log',
        data: { project: '站点体验优化' }
      })?.latestAnchor
    ).toBe('2026-02-10-站点体验优化');

    // 同名项目无法唯一匹配：不猜测
    expect(
      resolver.resolveProjectForDevlog({
        id: '2026-03-03-log',
        data: { project: '同名项目' }
      })
    ).toBeNull();
  });

  it('warns once for an unresolved non-empty projectSlug but still allows title fallback', () => {
    const warn = vi.fn();
    const resolver = buildProjectResolver(groups(), { warn });
    const devlog = {
      id: '2026-03-04-log',
      data: { project: '内容流程', projectSlug: 'missing-project' }
    };

    expect(resolver.resolveProjectForDevlog(devlog)?.key).toBe('content-workflow');
    expect(resolver.resolveProjectForDevlog(devlog)?.key).toBe('content-workflow');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('missing-project');
    expect(warn.mock.calls[0]?.[0]).toContain('2026-03-04-log');
  });

  it('does not warn for an empty projectSlug', () => {
    const warn = vi.fn();
    const resolver = buildProjectResolver(groups(), { warn });

    expect(
      resolver.resolveProjectForDevlog({
        id: '2026-03-05-log',
        data: { project: '站点体验优化', projectSlug: '  ' }
      })?.title
    ).toBe('站点体验优化');
    expect(warn).not.toHaveBeenCalled();
  });
});
