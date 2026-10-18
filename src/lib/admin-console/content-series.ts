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
  versionName?: string | null;
  isLatestVersion?: boolean;
  versionGroupSize?: number;
};

export type AdminContentSeriesVersionState = {
  isLatestVersion: boolean;
  versionGroupSize: number;
};

export type AdminContentListEntryGroup<T extends AdminContentSeriesListEntry> = {
  kind: 'entry';
  key: string;
  item: T;
};

export type AdminContentListSeriesGroup<T extends AdminContentSeriesListEntry> = {
  kind: 'series';
  key: string;
  series: string;
  title: string;
  /** 去掉尾部版本名后的系列显示名；系列头只用它，不再直接展示最新版标题。 */
  displayTitle: string;
  versionCount: number;
  items: T[];
};

export type AdminContentListGroup<T extends AdminContentSeriesListEntry> =
  | AdminContentListEntryGroup<T>
  | AdminContentListSeriesGroup<T>;

export type AdminContentListStandaloneSection<T extends AdminContentSeriesListEntry> = {
  kind: 'standalone';
  key: 'standalone';
  label: '单篇文章';
  count: number;
  items: T[];
};

export type AdminContentListSeriesSection<T extends AdminContentSeriesListEntry> = {
  kind: 'series';
  key: 'series';
  label: '系列';
  count: number;
  groups: AdminContentListSeriesGroup<T>[];
};

export type AdminContentListSection<T extends AdminContentSeriesListEntry> =
  | AdminContentListStandaloneSection<T>
  | AdminContentListSeriesSection<T>;

const compareNullableDateDesc = (left: Date | null, right: Date | null): number => {
  if (left && right) return right.valueOf() - left.valueOf();
  if (left) return -1;
  if (right) return 1;
  return 0;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 系列头显示名：从最新版标题去掉尾部的 `: 版本名` / `：版本名`。
 * 兼容中英文冒号、冒号前后空格；标题本身没有版本后缀时保留原标题，空标题兜底 series slug。
 */
export const getAdminContentSeriesDisplayTitle = (
  title: string,
  series: string,
  versionName?: string | null
): string => {
  const trimmedTitle = title.trim();
  const trimmedVersionName = versionName?.trim();

  if (trimmedTitle && trimmedVersionName) {
    const suffix = new RegExp(`\\s*[:：]\\s*${escapeRegExp(trimmedVersionName)}\\s*$`);
    const strippedTitle = trimmedTitle.replace(suffix, '').trim();
    if (strippedTitle) return strippedTitle;
  }

  return trimmedTitle || series;
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
 * 组标题取最新版标题并去掉版本名后缀；versionCount 取完整 series 版本数，分页截断后仍显示总数。
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
      displayTitle: getAdminContentSeriesDisplayTitle(latest.title, item.series, latest.versionName),
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
 * 后台列表的两段式顺序：先「单篇文章」（无 series 的独立行），再「系列」。
 * 每组内部仍保持列表原有顺序；系列组内版本顺序由 buildAdminContentListGroups 保证。
 */
export const buildAdminContentListSections = <T extends AdminContentSeriesListEntry>(
  items: readonly T[]
): AdminContentListSection<T>[] => {
  const standaloneItems: T[] = [];
  const seriesGroups: AdminContentListSeriesGroup<T>[] = [];

  for (const group of buildAdminContentListGroups(items)) {
    if (group.kind === 'series') seriesGroups.push(group);
    else standaloneItems.push(group.item);
  }

  const sections: AdminContentListSection<T>[] = [];

  if (standaloneItems.length > 0) {
    sections.push({
      kind: 'standalone',
      key: 'standalone',
      label: '单篇文章',
      count: standaloneItems.length,
      items: standaloneItems
    });
  }

  if (seriesGroups.length > 0) {
    sections.push({
      kind: 'series',
      key: 'series',
      label: '系列',
      count: seriesGroups.length,
      groups: seriesGroups
    });
  }

  return sections;
};
