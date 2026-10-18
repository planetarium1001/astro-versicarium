import { describe, expect, it } from 'vitest';
import {
  buildAdminContentListGroups,
  buildAdminContentListRenderEntries,
  compareAdminContentSeriesVersions,
  resolveAdminContentSeriesVersionStates
} from '../src/lib/admin-console/content-series';

type VersionInput = {
  id: string;
  series: string | null;
  dateText?: string | null;
  versionOrder?: number | null;
  title?: string;
};

const version = ({
  id,
  series,
  dateText = '2026-01-01',
  versionOrder = null,
  title = id
}: VersionInput) => ({
  id,
  series,
  title,
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
      version({ id: 'post-v1', series: 'post', dateText: '2026-01-01', title: '旧标题' }),
      version({ id: 'single', series: null, dateText: '2026-02-01' }),
      version({ id: 'post-v2', series: 'post', dateText: '2026-03-01', title: '新标题' })
    ]);

    const groups = buildAdminContentListGroups(items);

    expect(groups.map((group) => group.kind)).toEqual(['series', 'entry']);
    const seriesGroup = groups[0];
    expect(seriesGroup).toMatchObject({
      kind: 'series',
      key: 'series:post',
      series: 'post',
      title: '新标题',
      versionCount: 2
    });
    if (seriesGroup?.kind !== 'series') throw new Error('expected a series group');
    expect(seriesGroup.items.map((item) => item.id)).toEqual(['post-v2', 'post-v1']);
    expect(groups[1]).toMatchObject({ kind: 'entry', item: { id: 'single' } });
  });

  it('flattens groups into header and row render entries', () => {
    const items = withStates([
      version({ id: 'post-v1', series: 'post', dateText: '2026-01-01', title: '旧标题' }),
      version({ id: 'single', series: null, dateText: '2026-02-01' }),
      version({ id: 'post-v2', series: 'post', dateText: '2026-03-01', title: '新标题' })
    ]);

    const entries = buildAdminContentListRenderEntries(items);

    expect(entries.map((entry) => entry.kind)).toEqual(['series', 'item', 'item', 'item']);
    expect(entries[0]).toEqual({
      kind: 'series',
      key: 'series:post',
      series: 'post',
      title: '新标题',
      versionCount: 2
    });
    expect(entries.slice(1).map((entry) => entry.kind === 'item' ? entry.item.id : '')).toEqual([
      'post-v2',
      'post-v1',
      'single'
    ]);
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
