import type { AdminMediaItem, AdminMediaListRequest, AdminMediaTreeNode } from './types';

export type MediaCounts = Pick<AdminMediaTreeNode, 'count' | 'imageCount' | 'fileCount' | 'orphanCount'>;

const matchesQuery = (item: AdminMediaItem, query: string): boolean => {
  if (!query) return true;
  const haystack = [
    item.path,
    item.fileName,
    item.series,
    item.seriesLabel,
    item.version,
    item.versionLabel,
    item.entryId,
    item.entryLabel,
    item.directory
  ].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const parseDateBoundary = (value: string, endOfDay: boolean): number | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return endOfDay ? parsed.getTime() + 24 * 60 * 60 * 1000 - 1 : parsed.getTime();
};

export const filterMediaItems = (
  items: readonly AdminMediaItem[],
  filters: AdminMediaListRequest
): AdminMediaItem[] => {
  const from = parseDateBoundary(filters.from, false);
  const to = parseDateBoundary(filters.to, true);

  return items.filter((item) => {
    if (filters.collection && item.collection !== filters.collection) return false;
    if (filters.series && item.series !== filters.series) return false;
    // entry 精确到条目目录；同时接受 versionLabel，便于直接用 v1/v2 筛选。
    const matchesEntry = (value: string): boolean =>
      item.entryId === value || item.version === value || item.versionLabel === value;
    if (filters.entry && !matchesEntry(filters.entry)) return false;
    if (filters.version && !matchesEntry(filters.version)) return false;
    if (filters.directory && item.directory !== filters.directory) return false;
    if (filters.reference !== 'all' && item.referenceStatus !== filters.reference) return false;
    if (filters.type !== 'all' && item.kind !== filters.type) return false;
    if (from !== null && (item.mtimeMs === null || item.mtimeMs < from)) return false;
    if (to !== null && (item.mtimeMs === null || item.mtimeMs > to)) return false;
    return matchesQuery(item, filters.query);
  });
};

export const createEmptyCounts = (): MediaCounts => ({
  count: 0,
  imageCount: 0,
  fileCount: 0,
  orphanCount: 0
});

export const addToCounts = (counts: MediaCounts, item: AdminMediaItem): void => {
  counts.count += 1;
  if (item.kind === 'image') counts.imageCount += 1;
  else counts.fileCount += 1;
  if (item.referenceStatus === 'orphan') counts.orphanCount += 1;
};
