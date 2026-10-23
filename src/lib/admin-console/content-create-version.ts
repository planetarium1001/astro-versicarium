import { access, cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../site.config.mjs';
import { parseContentDateInput } from '../../utils/date-only';
import { buildContentEntryId } from '../../utils/slug-rules';
import { getSiteTimezone } from '../../utils/site-timezone';
import { getAdminContentEntryEditHref } from './content-routes';
import {
  readAdminSourceFrontmatterRecord,
  toAdminContentRelativeProjectPath
} from './content-entry-source';
import { resolveCollectionEntryFiles } from '../content-entry-files';
import { patchMarkdownFrontmatter } from '../frontmatter';
import { normalizeOptionalText } from './content-entry-utils';
import { getProjectRoot } from '../project-root';

export type AdminCreateVersionInput = {
  entryId: string;
  date?: string | undefined;
  versionLabel?: string | undefined;
};

export type AdminCreateVersionResult = {
  collection: 'blog';
  entryId: string;
  relativePath: string;
  editHref: string;
  versionOrder: number;
};

const getBlogRoot = (): string => path.join(getProjectRoot(), CONTENT_ROOT, 'blog');

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

type BlogSource = {
  entryId: string;
  filePath: string;
  directory: string;
  title: string;
  series: string | null;
  slug: string | null;
  date: Date;
  dateText: string;
  versionOrder: number;
};

const loadBlogSources = async (): Promise<BlogSource[]> => {
  const files = await resolveCollectionEntryFiles(getProjectRoot(), getBlogRoot());
  const sources: BlogSource[] = [];

  for (const file of files) {
    const frontmatter = await readAdminSourceFrontmatterRecord(file.filePath);
    const parsedDate = parseContentDateInput(frontmatter.date);
    if (!parsedDate) continue;
    const entryId = file.entryId;
    sources.push({
      entryId,
      filePath: file.filePath,
      directory: path.dirname(file.filePath),
      title: normalizeOptionalText(frontmatter.title) || entryId,
      series: normalizeOptionalText(frontmatter.series) || null,
      slug: normalizeOptionalText(frontmatter.slug) || null,
      date: parsedDate.date,
      dateText: parsedDate.dateText,
      versionOrder: typeof frontmatter.versionOrder === 'number' ? frontmatter.versionOrder : 0
    });
  }

  return sources;
};

const compareSources = (left: BlogSource, right: BlogSource): number => {
  const dateOrder = right.date.valueOf() - left.date.valueOf();
  if (dateOrder !== 0) return dateOrder;
  const order = right.versionOrder - left.versionOrder;
  if (order !== 0) return order;
  return left.entryId.localeCompare(right.entryId, 'en');
};

export const createAdminBlogVersion = async (
  input: AdminCreateVersionInput
): Promise<AdminCreateVersionResult> => {
  const sourceEntryId = input.entryId.trim();
  if (!sourceEntryId) throw new Error('entryId 不能为空');

  const sources = await loadBlogSources();
  const source = sources.find((candidate) => candidate.entryId === sourceEntryId);
  if (!source) throw new Error(`找不到博客条目：${sourceEntryId}`);

  const series = source.series ?? source.slug ?? source.entryId;
  const seriesSources = sources
    .filter((candidate) => (candidate.series ?? candidate.slug ?? candidate.entryId) === series)
    .sort(compareSources);
  const latest = seriesSources[0] ?? source;
  const maxVersionOrder = Math.max(...seriesSources.map((candidate) => candidate.versionOrder), 0);

  const timeZone = getSiteTimezone();
  const dateInput = input.date?.trim();
  const dateResult = dateInput
    ? parseContentDateInput(dateInput)
    : parseContentDateInput(new Date());
  if (!dateResult) throw new Error('新版本日期格式无效');
  const date = dateResult.date;
  const dateText = dateResult.dateText;

  let entryId = buildContentEntryId(date, latest.title, timeZone);
  let directory = path.join(getBlogRoot(), entryId);
  for (let index = 1; await pathExists(directory); index += 1) {
    entryId = `${buildContentEntryId(date, latest.title, timeZone)}-${index}`;
    directory = path.join(getBlogRoot(), entryId);
  }

  await cp(latest.directory, directory, { recursive: true });

  const mainPath = path.join(directory, path.basename(latest.filePath));
  const sourceText = await readFile(mainPath, 'utf8');
  const nextVersionOrder = maxVersionOrder + 1;
  const nextText = patchMarkdownFrontmatter(sourceText, [
    { path: ['series'], action: 'set', value: series },
    { path: ['slug'], action: 'set', value: latest.slug ?? series },
    { path: ['date'], action: 'set', value: dateText },
    { path: ['versionLabel'], action: 'set', value: input.versionLabel?.trim() || `v${nextVersionOrder}` },
    { path: ['versionName'], action: 'set', value: latest.title },
    { path: ['versionOrder'], action: 'set', value: nextVersionOrder },
    { path: ['draft'], action: 'set', value: true },
    { path: ['publishedAt'], action: 'delete' },
    { path: ['updatedAt'], action: 'delete' }
  ]);
  await writeFile(mainPath, nextText, 'utf8');

  return {
    collection: 'blog',
    entryId,
    relativePath: toAdminContentRelativeProjectPath(mainPath),
    editHref: getAdminContentEntryEditHref('blog', entryId),
    versionOrder: nextVersionOrder
  };
};
