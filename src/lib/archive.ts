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
  isLatest?: boolean;
  series?: string | null;
  project?: string;
  description: string;
  tags: string[];
  text: string;
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
    return {
      kind: 'projects',
      key: `projects:${entry.id}`,
      id: entry.id,
      title: entry.data.title,
      href: `/projects/#${entry.id}`,
      date: entry.data.date,
      ...meta,
      versionOrder: 0,
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
