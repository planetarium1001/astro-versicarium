/**
 * 后台内容列表的版本组与内容系列纯函数模型。
 * 不依赖 astro:content，也不读文件：只处理已经加载好的列表项，便于测试与复用。
 *
 * 两套语义严格分开，不得混称：
 * - 版本组（frontmatter `versionGroup`）：同一内容的不同版本，列表里折叠成一组，有「最新 / 历史」。
 * - 内容系列（frontmatter `series`）：并列的独立文章构成的有序阅读集合，行内只给「系列名 · 第 N/M 篇」徽标。
 */

import {
  buildBlogSeriesIndexFromGroups,
  type BlogSeriesEntry,
  type BlogSeriesGroupSource
} from '../blog-series';
import { getVersionGroupKey, sortBlogVersions } from '../blog-routing';

export type AdminContentVersionSortable = {
  id: string;
  date: Date | null;
  versionOrder: number | null;
};

export type AdminContentVersionGroupLike = AdminContentVersionSortable & {
  versionGroup: string | null;
};

/** projects 的版本排序只看 date/versionOrder/id，稳定分组键是 projectSlug。 */
export type AdminContentProjectVersionLike = AdminContentVersionSortable & {
  projectSlug: string | null;
};

export type AdminContentVersionGroupListEntry = AdminContentVersionGroupLike & {
  title: string;
  versionName?: string | null;
  isLatestVersion?: boolean;
  versionGroupSize?: number;
};

/** 真系列徽标的输入：与版本组字段正交，单独声明避免两套语义挤在一个类型里。 */
export type AdminContentSeriesBadgeSource = AdminContentVersionGroupLike & {
  title: string;
  series: string | null;
  seriesName?: string | null;
  seriesOrder?: number | null;
};

/**
 * 真系列徽标：系列名 + 阅读次序。
 * `index` / `total` 是「第 N 篇 / 共 M 篇」的阅读序号，与版本号无关。
 */
export type AdminContentSeriesBadge = {
  series: string;
  /** `seriesName` 缺省时回退系列 slug。 */
  name: string;
  index: number;
  total: number;
};

export type AdminContentVersionState = {
  isLatestVersion: boolean;
  versionGroupSize: number;
};

export type AdminContentProjectListEntry = AdminContentProjectVersionLike & {
  title: string;
  versionLabel?: string | null;
  versionName?: string | null;
  isLatestVersion?: boolean;
  versionGroupSize?: number;
};

export type AdminContentListEntryGroup<T extends AdminContentVersionGroupListEntry> = {
  kind: 'entry';
  key: string;
  item: T;
};

export type AdminContentListVersionGroup<T extends AdminContentVersionGroupListEntry> = {
  kind: 'version-group';
  key: string;
  /** 版本组稳定键（frontmatter `versionGroup`）。 */
  versionGroup: string;
  title: string;
  /** 去掉尾部版本名后的组标题；组头只用它，不再直接展示最新版标题。 */
  displayTitle: string;
  versionCount: number;
  items: T[];
};

export type AdminContentListGroup<T extends AdminContentVersionGroupListEntry> =
  | AdminContentListEntryGroup<T>
  | AdminContentListVersionGroup<T>;

export type AdminContentListStandaloneSection<T extends AdminContentVersionGroupListEntry> = {
  kind: 'standalone';
  key: 'standalone';
  label: '单篇文章';
  count: number;
  items: T[];
};

export type AdminContentListVersionGroupSection<T extends AdminContentVersionGroupListEntry> = {
  kind: 'version-group';
  key: 'version-group';
  label: '版本组';
  count: number;
  groups: AdminContentListVersionGroup<T>[];
};

export type AdminContentListSection<T extends AdminContentVersionGroupListEntry> =
  | AdminContentListStandaloneSection<T>
  | AdminContentListVersionGroupSection<T>;

export type AdminContentListProjectGroup<T extends AdminContentProjectListEntry> = {
  kind: 'project';
  key: string;
  /** 项目稳定 slug：frontmatter.slug；缺失或日期形式时由 source index 回退到 publicEntryId。 */
  projectSlug: string;
  title: string;
  /** 去掉尾部版本名后的项目名，与版本组头取值规则一致。 */
  displayTitle: string;
  versionCount: number;
  items: T[];
};

export type AdminContentListProjectSection<T extends AdminContentProjectListEntry> = {
  kind: 'project';
  key: 'project';
  label: '项目';
  count: number;
  groups: AdminContentListProjectGroup<T>[];
};

const compareNullableDateDesc = (left: Date | null, right: Date | null): number => {
  if (left && right) return right.valueOf() - left.valueOf();
  if (left) return -1;
  if (right) return 1;
  return 0;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 组头显示名：从最新版标题去掉尾部的 `: 版本名` / `：版本名`。
 * 兼容中英文冒号、冒号前后空格；标题本身没有版本后缀时保留原标题，空标题兜底稳定键。
 */
export const getAdminContentGroupDisplayTitle = (
  title: string,
  groupKey: string,
  versionName?: string | null
): string => {
  const trimmedTitle = title.trim();
  const trimmedVersionName = versionName?.trim();

  if (trimmedTitle && trimmedVersionName) {
    const suffix = new RegExp(`\\s*[:：]\\s*${escapeRegExp(trimmedVersionName)}\\s*$`);
    const strippedTitle = trimmedTitle.replace(suffix, '').trim();
    if (strippedTitle) return strippedTitle;
  }

  return trimmedTitle || groupKey;
};

/**
 * 同一版本组的版本排序：date 倒序 → versionOrder 倒序 → entryId。
 * versionOrder 缺失按 0 处理，与公开路由的版本判定保持一致。
 */
export const compareAdminContentVersions = (
  left: AdminContentVersionSortable,
  right: AdminContentVersionSortable
): number => {
  const dateOrder = compareNullableDateDesc(left.date, right.date);
  if (dateOrder !== 0) return dateOrder;

  const versionOrder = (right.versionOrder ?? 0) - (left.versionOrder ?? 0);
  if (versionOrder !== 0) return versionOrder;

  return left.id.localeCompare(right.id, 'en');
};

/**
 * 给每个条目补上最新/历史状态与版本数：
 * 同版本组内按上面的排序取第一条为最新；无 versionGroup 的条目视为自身唯一版本。
 */
export const resolveAdminContentVersionGroupStates = (
  items: readonly AdminContentVersionGroupLike[]
): Map<string, AdminContentVersionState> => {
  const membersByVersionGroup = new Map<string, AdminContentVersionGroupLike[]>();

  for (const item of items) {
    if (!item.versionGroup) continue;
    const members = membersByVersionGroup.get(item.versionGroup) ?? [];
    members.push(item);
    membersByVersionGroup.set(item.versionGroup, members);
  }

  const states = new Map<string, AdminContentVersionState>();

  for (const item of items) {
    if (!item.versionGroup) {
      states.set(item.id, { isLatestVersion: true, versionGroupSize: 1 });
    }
  }

  for (const members of membersByVersionGroup.values()) {
    const ordered = members.slice().sort(compareAdminContentVersions);
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
 * `buildBlogSeriesIndexFromGroups` 只需要「每个版本组一行」的投影，
 * 所以这里按版本组收拢后直接交出最小形状，不伪造完整的公开路由结果：
 * 后台列表里可能有 slug 冲突与无效日期，跑 `buildBlogRouting` 会直接抛错。
 */
const buildAdminSeriesGroupSources = (
  entries: readonly BlogSeriesEntry[]
): BlogSeriesGroupSource<BlogSeriesEntry>[] => {
  const membersByVersionGroupKey = new Map<string, BlogSeriesEntry[]>();

  for (const entry of entries) {
    const key = getVersionGroupKey(entry);
    const members = membersByVersionGroupKey.get(key) ?? [];
    members.push(entry);
    membersByVersionGroupKey.set(key, members);
  }

  return Array.from(membersByVersionGroupKey.entries()).map(([versionGroupKey, members]) => ({
    versionGroupKey,
    // 徽标不渲染链接，组的规范地址留空，避免在后台算出可能与公开端不一致的路径。
    canonicalPath: '',
    latest: sortBlogVersions(members)[0]!
  }));
};

/**
 * 真系列徽标：系列名 + 阅读次序，绝不产生「最新 / 历史」语义。
 *
 * 排序与去重规则唯一来源是 `blog-series`：这里把后台条目投影成它的输入模型再取索引，
 * 不在后台另写一套排序，避免列表徽标与公开端系列清单排出不同次序。
 * 同一版本组的多个版本共享同一枚徽标（它们是同一篇文章的不同版本）。
 */
export const buildAdminContentSeriesBadges = (
  items: readonly AdminContentSeriesBadgeSource[]
): Map<string, AdminContentSeriesBadge> => {
  const entries: BlogSeriesEntry[] = items.map((item) => ({
    id: item.id,
    data: {
      title: item.title,
      // 日期缺失的条目在后台是「源文件异常」状态；用纪元时间让它稳定排在系列末尾。
      date: item.date ?? new Date(0),
      ...(item.versionGroup ? { versionGroup: item.versionGroup } : {}),
      ...(item.versionOrder == null ? {} : { versionOrder: item.versionOrder }),
      ...(item.series ? { series: item.series } : {}),
      ...(item.seriesName ? { seriesName: item.seriesName } : {}),
      ...(item.seriesOrder == null ? {} : { seriesOrder: item.seriesOrder })
    }
  }));

  const badgeByVersionGroupKey = new Map<string, AdminContentSeriesBadge>();
  const seriesIndex = buildBlogSeriesIndexFromGroups(entries, buildAdminSeriesGroupSources(entries));
  for (const group of seriesIndex.values()) {
    for (const member of group.members) {
      badgeByVersionGroupKey.set(member.versionGroupKey, {
        series: group.slug,
        name: group.name,
        index: member.index,
        total: group.total
      });
    }
  }

  const badges = new Map<string, AdminContentSeriesBadge>();
  for (const entry of entries) {
    const badge = badgeByVersionGroupKey.get(getVersionGroupKey(entry));
    if (badge) badges.set(entry.id, badge);
  }

  return badges;
};

/**
 * 行内徽标文案：`系列名 · 第 N/M 篇`；两个数字都是阅读序号，不是版本号。
 * 只取文案需要的三个字段，调用方不必为了让类型通过而拼出完整的徽标对象。
 */
export const getAdminContentSeriesBadgeLabel = (
  badge: Pick<AdminContentSeriesBadge, 'name' | 'index' | 'total'>
): string => `${badge.name} · 第 ${badge.index}/${badge.total} 篇`;

/**
 * 项目版本状态：按 projectSlug 归并，组内排序与公开项目路由一致（date → versionOrder → id）。
 * projectSlug 缺失的条目视为自身唯一版本，避免把无稳定键的项目误并成一组。
 */
export const resolveAdminContentProjectVersionStates = (
  items: readonly AdminContentProjectVersionLike[]
): Map<string, AdminContentVersionState> => {
  const membersByProject = new Map<string, AdminContentProjectVersionLike[]>();

  for (const item of items) {
    const key = item.projectSlug ?? `entry:${item.id}`;
    const members = membersByProject.get(key) ?? [];
    members.push(item);
    membersByProject.set(key, members);
  }

  const states = new Map<string, AdminContentVersionState>();

  for (const members of membersByProject.values()) {
    const ordered = members.slice().sort(compareAdminContentVersions);
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
 * 项目列表分组：同一 projectSlug 的多份版本文档归入一组，单版本项目也成组（版本数 1）。
 * 组位置取该组首条出现的位置，组内版本按公开项目路由排序。
 */
export const buildAdminContentListProjectGroups = <T extends AdminContentProjectListEntry>(
  items: readonly T[]
): AdminContentListProjectGroup<T>[] => {
  const membersByProject = new Map<string, T[]>();

  for (const item of items) {
    const key = item.projectSlug ?? `entry:${item.id}`;
    const members = membersByProject.get(key) ?? [];
    members.push(item);
    membersByProject.set(key, members);
  }

  const emittedProjects = new Set<string>();
  const groups: AdminContentListProjectGroup<T>[] = [];

  for (const item of items) {
    const projectKey = item.projectSlug ?? `entry:${item.id}`;
    if (emittedProjects.has(projectKey)) continue;
    emittedProjects.add(projectKey);

    const members = (membersByProject.get(projectKey) ?? [item])
      .slice()
      .sort(compareAdminContentVersions);
    const latest = members.find((member) => member.isLatestVersion === true) ?? members[0]!;
    const projectSlug = item.projectSlug ?? item.id;

    groups.push({
      kind: 'project',
      key: `project:${projectSlug}`,
      projectSlug,
      title: latest.title,
      displayTitle: getAdminContentGroupDisplayTitle(latest.title, projectSlug, latest.versionName),
      versionCount: Math.max(
        ...members.map((member) => member.versionGroupSize ?? members.length),
        members.length
      ),
      items: members
    });
  }

  return groups;
};

/** 项目 segment：所有项目都成组，空列表不产出 section。 */
export const buildAdminContentListProjectSections = <T extends AdminContentProjectListEntry>(
  items: readonly T[]
): AdminContentListProjectSection<T>[] => {
  const groups = buildAdminContentListProjectGroups(items);
  if (groups.length === 0) return [];

  return [{
    kind: 'project',
    key: 'project',
    label: '项目',
    count: groups.length,
    groups
  }];
};

/**
 * 列表渲染分组：同一 versionGroup 的条目合并成一组（首条出现的位置），无 versionGroup 的条目保持独立一行。
 * 组标题取最新版标题并去掉版本名后缀；versionCount 取完整版本数，分页截断后仍显示总数。
 */
export const buildAdminContentListVersionGroups = <T extends AdminContentVersionGroupListEntry>(
  items: readonly T[]
): AdminContentListGroup<T>[] => {
  const membersByVersionGroup = new Map<string, T[]>();

  for (const item of items) {
    if (!item.versionGroup) continue;
    const members = membersByVersionGroup.get(item.versionGroup) ?? [];
    members.push(item);
    membersByVersionGroup.set(item.versionGroup, members);
  }

  const emittedVersionGroups = new Set<string>();
  const groups: AdminContentListGroup<T>[] = [];

  for (const item of items) {
    if (!item.versionGroup) {
      groups.push({ kind: 'entry', key: `entry:${item.id}`, item });
      continue;
    }

    if (emittedVersionGroups.has(item.versionGroup)) continue;
    emittedVersionGroups.add(item.versionGroup);

    const members = (membersByVersionGroup.get(item.versionGroup) ?? [item])
      .slice()
      .sort(compareAdminContentVersions);
    const latest = members.find((member) => member.isLatestVersion === true) ?? members[0]!;

    groups.push({
      kind: 'version-group',
      key: `versionGroup:${item.versionGroup}`,
      versionGroup: item.versionGroup,
      title: latest.title,
      displayTitle: getAdminContentGroupDisplayTitle(latest.title, item.versionGroup, latest.versionName),
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
 * 后台列表的两段式顺序：先「单篇文章」（无 versionGroup 的独立行），再「版本组」。
 * 每组内部仍保持列表原有顺序；版本组内版本顺序由 buildAdminContentListVersionGroups 保证。
 */
export const buildAdminContentListSections = <T extends AdminContentVersionGroupListEntry>(
  items: readonly T[]
): AdminContentListSection<T>[] => {
  const standaloneItems: T[] = [];
  const versionGroupGroups: AdminContentListVersionGroup<T>[] = [];

  for (const group of buildAdminContentListVersionGroups(items)) {
    if (group.kind === 'version-group') versionGroupGroups.push(group);
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

  if (versionGroupGroups.length > 0) {
    sections.push({
      kind: 'version-group',
      key: 'version-group',
      label: '版本组',
      count: versionGroupGroups.length,
      groups: versionGroupGroups
    });
  }

  return sections;
};
