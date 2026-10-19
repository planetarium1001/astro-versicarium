import { formatISODateInTimeZone } from '../utils/format';
import { getSiteTimezone } from '../utils/site-timezone';
import {
  getBlogDerivedText,
  getVisibleBlogRouting,
  getVisibleDevlogs,
  getVisibleProjects
} from './content';
import { getBlogEntryHrefMap } from './blog-routing';
import { stripTrailingLinks } from './trailing-links';
import { flattenEntryIdToSlug } from '../utils/slug-rules';

export type ArchiveRowKind = 'blog' | 'projects' | 'devlog';

export type ProjectVersionRecord = {
  label: string;
  name: string | null;
  dateText: string;
  summary: string | null;
  order: number;
  isCurrent: boolean;
};

type ProjectVersionSource = {
  versionLabel?: string | null | undefined;
  versionName?: string | null | undefined;
  versionSummary?: string | null | undefined;
  versionOrder?: number | null | undefined;
  versions?:
    | ReadonlyArray<{
        label: string;
        name?: string | null | undefined;
        dateText?: string | null | undefined;
        summary?: string | null | undefined;
        order?: number | null | undefined;
      }>
    | undefined;
};

/**
 * 项目大版本文档：当前版本来自项目顶层的 version* 字段，历史版本来自 versions。
 * 只返回给界面消费的展示字段；当前版本永远排第一，历史版本按日期倒序。
 */
export const getProjectVersionHistory = (
  data: ProjectVersionSource,
  currentDateText: string
): ProjectVersionRecord[] => {
  const currentLabel = data.versionLabel?.trim();
  if (!currentLabel) return [];

  const current: ProjectVersionRecord = {
    label: currentLabel,
    name: data.versionName?.trim() || null,
    dateText: currentDateText,
    summary: data.versionSummary?.trim() || null,
    order: data.versionOrder ?? 0,
    isCurrent: true
  };

  const history = (data.versions ?? [])
    .map((version): ProjectVersionRecord => ({
      label: version.label.trim(),
      name: version.name?.trim() || null,
      dateText: version.dateText?.trim() || '',
      summary: version.summary?.trim() || null,
      order: version.order ?? 0,
      isCurrent: false
    }))
    .filter((version) => version.label.length > 0)
    .sort(
      (left, right) =>
        right.dateText.localeCompare(left.dateText, 'en') ||
        right.order - left.order ||
        left.label.localeCompare(right.label, 'en')
    );

  return [current, ...history];
};

export type ArchiveRow = {
  kind: ArchiveRowKind;
  key: string;
  id: string;
  title: string;
  href: string;
  date: Date;
  dateText: string;
  year: number;
  month: number;
  versionOrder: number;
  versionLabel?: string;
  versionName?: string;
  versionSummary?: string;
  isLatest?: boolean;
  series?: string | null;
  project?: string;
  description: string;
  tags: string[];
  text: string;
  /** 项目大版本（含当前版本）；只有配置了版本字段的项目才有。 */
  projectVersions?: ProjectVersionRecord[];
};

export type ArchiveGroup = {
  key: string;
  label: string;
  rows: ArchiveRow[];
};

const toDateMeta = (date: Date, dateText?: string): { dateText: string; year: number; month: number } => {
  const effectiveText = dateText ?? formatISODateInTimeZone(date, getSiteTimezone());
  const [yearText = '0', monthText = '0'] = effectiveText.split('-');
  return {
    dateText: effectiveText,
    year: Number.parseInt(yearText, 10) || 0,
    month: Number.parseInt(monthText, 10) || 0
  };
};

const orderRows = (left: ArchiveRow, right: ArchiveRow): number => {
  const dateOrder = right.date.valueOf() - left.date.valueOf();
  if (dateOrder !== 0) return dateOrder;
  const versionOrder = right.versionOrder - left.versionOrder;
  if (versionOrder !== 0) return versionOrder;
  return left.id.localeCompare(right.id, 'en');
};

export const getArchiveRows = async (
  options: { versionMode?: 'all' | 'latest' } = {}
): Promise<ArchiveRow[]> => {
  const [routing, projects, devlogs] = await Promise.all([
    getVisibleBlogRouting(),
    getVisibleProjects(),
    getVisibleDevlogs()
  ]);
  const hrefByEntryId = getBlogEntryHrefMap(routing);

  const versionMode = options.versionMode ?? 'all';
  const blogRows: ArchiveRow[] = routing.groups.flatMap((group) => {
    const versions = versionMode === 'latest' ? [group.latest] : group.versions;
    return versions.map((entry) => {
      const isLatest = entry.id === group.latest.id;
      const meta = toDateMeta(entry.data.date, entry.data.dateText);
      return {
        kind: 'blog',
        key: `blog:${entry.id}`,
        id: entry.id,
        title: entry.data.title,
        href: hrefByEntryId.get(entry.id) ?? group.latestDatedPath,
        date: entry.data.date,
        ...meta,
        versionOrder: entry.data.versionOrder ?? 0,
        versionLabel: entry.data.versionLabel?.trim() || meta.dateText,
        isLatest,
        series: group.series,
        description: entry.data.description ?? '',
        tags: entry.data.tags ?? [],
        text: getBlogDerivedText(entry).text
      } satisfies ArchiveRow;
    });
  });

  const projectRows: ArchiveRow[] = projects.map((entry) => {
    const meta = toDateMeta(entry.data.date, entry.data.dateText);
    const projectVersions = getProjectVersionHistory(entry.data, meta.dateText);
    return {
      kind: 'projects',
      key: `projects:${entry.id}`,
      id: entry.id,
      title: entry.data.title,
      href: `/projects/#${entry.id}`,
      date: entry.data.date,
      ...meta,
      versionOrder: entry.data.versionOrder ?? 0,
      ...(entry.data.versionLabel?.trim() ? { versionLabel: entry.data.versionLabel.trim() } : {}),
      ...(entry.data.versionName?.trim() ? { versionName: entry.data.versionName.trim() } : {}),
      ...(entry.data.versionSummary?.trim() ? { versionSummary: entry.data.versionSummary.trim() } : {}),
      ...(projectVersions.length > 0 ? { isLatest: true, projectVersions } : {}),
      description: entry.data.description ?? '',
      tags: [],
      text: [entry.data.subtitle, entry.data.description].filter(Boolean).join(' ')
    };
  });

  const devlogRows: ArchiveRow[] = devlogs.map((entry) => {
    const meta = toDateMeta(entry.data.date, entry.data.dateText);
    return {
      kind: 'devlog',
      key: `devlog:${entry.id}`,
      id: entry.id,
      title: entry.data.title,
      href: `/devlog/#${flattenEntryIdToSlug(entry.id)}`,
      date: entry.data.date,
      ...meta,
      versionOrder: 0,
      project: entry.data.project,
      description: entry.data.description ?? '',
      tags: [entry.data.project],
      text: [
        entry.data.project,
        entry.data.kind,
        entry.data.description,
        stripTrailingLinks(entry.body ?? '').replace(/\s+/g, ' ').trim()
      ].filter(Boolean).join(' ')
    };
  });

  return [...blogRows, ...projectRows, ...devlogRows].sort(orderRows);
};

export const groupArchiveRows = (rows: readonly ArchiveRow[]): ArchiveGroup[] => {
  const groups: ArchiveGroup[] = [];
  for (const row of rows) {
    const groupKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
    const last = groups.at(-1);
    if (last && last.key === groupKey) {
      last.rows.push(row);
      continue;
    }
    groups.push({
      key: groupKey,
      label: `${row.year} 年 ${row.month} 月`,
      rows: [row]
    });
  }
  return groups;
};
