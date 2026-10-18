/**
 * 后台内容列表的 series/version 纯函数模型。
 * 不依赖 astro:content，也不读文件：只处理已经加载好的列表项，便于测试与复用。
 */

export type AdminContentSeriesVersionLike = {
  id: string;
  series: string | null;
  date: Date | null;
  versionOrder: number | null;
};

export type AdminContentSeriesListEntry = AdminContentSeriesVersionLike & {
  title: string;
  isLatestVersion?: boolean;
  versionGroupSize?: number;
};

export type AdminContentSeriesVersionState = {
  isLatestVersion: boolean;
  versionGroupSize: number;
};

export type AdminContentListGroup<T extends AdminContentSeriesListEntry> =
  | { kind: 'entry'; key: string; item: T }
  | {
      kind: 'series';
      key: string;
      series: string;
      title: string;
      versionCount: number;
      items: T[];
    };

export type AdminContentListRenderEntry<T extends AdminContentSeriesListEntry> =
  | { kind: 'series'; key: string; series: string; title: string; versionCount: number }
  | { kind: 'item'; key: string; item: T };

const compareNullableDateDesc = (left: Date | null, right: Date | null): number => {
  if (left && right) return right.valueOf() - left.valueOf();
  if (left) return -1;
  if (right) return 1;
  return 0;
};

/**
 * 同一 series 的版本排序：date 倒序 → versionOrder 倒序 → entryId。
 * versionOrder 缺失按 0 处理，与公开路由的版本判定保持一致。
 */
export const compareAdminContentSeriesVersions = (
  left: AdminContentSeriesVersionLike,
  right: AdminContentSeriesVersionLike
): number => {
  const dateOrder = compareNullableDateDesc(left.date, right.date);
  if (dateOrder !== 0) return dateOrder;

  const versionOrder = (right.versionOrder ?? 0) - (left.versionOrder ?? 0);
  if (versionOrder !== 0) return versionOrder;

  return left.id.localeCompare(right.id, 'en');
};

/**
 * 给每个条目补上最新/历史状态与 series 版本数：
 * 同 series 内按上面的排序取第一条为最新；无 series 的条目视为自身唯一版本。
 */
export const resolveAdminContentSeriesVersionStates = (
  items: readonly AdminContentSeriesVersionLike[]
): Map<string, AdminContentSeriesVersionState> => {
  const membersBySeries = new Map<string, AdminContentSeriesVersionLike[]>();

  for (const item of items) {
    if (!item.series) continue;
    const members = membersBySeries.get(item.series) ?? [];
    members.push(item);
    membersBySeries.set(item.series, members);
  }

  const states = new Map<string, AdminContentSeriesVersionState>();

  for (const item of items) {
    if (!item.series) {
      states.set(item.id, { isLatestVersion: true, versionGroupSize: 1 });
    }
  }

  for (const members of membersBySeries.values()) {
    const ordered = members.slice().sort(compareAdminContentSeriesVersions);
    ordered.forEach((member, index) => {
      states.set(member.id, {
        isLatestVersion: index === 0,
        versionGroupSize: ordered.length
      });
    });
  }

  return states;
};

/**
 * 列表渲染分组：series 条目合并成一组（首条出现的位置），无 series 的条目保持独立一行。
 * 组标题取最新版标题；versionCount 取完整 series 版本数，分页截断后仍显示总数。
 */
export const buildAdminContentListGroups = <T extends AdminContentSeriesListEntry>(
  items: readonly T[]
): AdminContentListGroup<T>[] => {
  const membersBySeries = new Map<string, T[]>();

  for (const item of items) {
    if (!item.series) continue;
    const members = membersBySeries.get(item.series) ?? [];
    members.push(item);
    membersBySeries.set(item.series, members);
  }

  const emittedSeries = new Set<string>();
  const groups: AdminContentListGroup<T>[] = [];

  for (const item of items) {
    if (!item.series) {
      groups.push({ kind: 'entry', key: `entry:${item.id}`, item });
      continue;
    }

    if (emittedSeries.has(item.series)) continue;
    emittedSeries.add(item.series);

    const members = (membersBySeries.get(item.series) ?? [item])
      .slice()
      .sort(compareAdminContentSeriesVersions);
    const latest = members.find((member) => member.isLatestVersion === true) ?? members[0]!;

    groups.push({
      kind: 'series',
      key: `series:${item.series}`,
      series: item.series,
      title: latest.title,
      versionCount: Math.max(
        ...members.map((member) => member.versionGroupSize ?? members.length),
        members.length
      ),
      items: members
    });
  }

  return groups;
};

/**
 * 把分组展开成单层渲染条目：series 组先插入标题条目，再按版本顺序插入行；
 * 无 series 的条目直接作为单行。模板只需一次 map，避免重复行标记。
 */
export const buildAdminContentListRenderEntries = <T extends AdminContentSeriesListEntry>(
  items: readonly T[]
): AdminContentListRenderEntry<T>[] =>
  buildAdminContentListGroups(items).flatMap((group) =>
    group.kind === 'series'
      ? [
          {
            kind: 'series' as const,
            key: group.key,
            series: group.series,
            title: group.title,
            versionCount: group.versionCount
          },
          ...group.items.map((item) => ({
            kind: 'item' as const,
            key: `item:${item.id}`,
            item
          }))
        ]
      : [{ kind: 'item' as const, key: group.key, item: group.item }]
  );
