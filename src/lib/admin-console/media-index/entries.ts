import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../../site.config.mjs';
import {
  ADMIN_CONTENT_COLLECTION_KEYS,
  isAdminContentCollectionKey,
  type AdminContentCollectionKey
} from '../content-collections';
import { readRawFrontmatter } from '../../content-entry-files';
import { getProjectRoot } from '../../project-root';
import { toAdminContentRelativeProjectPath } from '../content-entry-source';
import { ASSET_DIR_NAMES, MARKDOWN_EXT_RE, normalizeText, type MediaEntryMeta } from './types';

const readDateValue = (value: unknown): Date | null => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** 找出目录里的主 Markdown：index.md 优先，否则唯一的 .md。 */
const resolveMainMarkdown = async (directory: string): Promise<string | null> => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && MARKDOWN_EXT_RE.test(entry.name))
    .map((entry) => entry.name);
  if (markdownFiles.length === 0) return null;
  const indexFile = markdownFiles.find((name) => name.toLowerCase() === 'index.md');
  return path.join(directory, indexFile ?? markdownFiles[0]!);
};

const readEntryMeta = async (
  collection: AdminContentCollectionKey,
  entryId: string,
  directory: string
): Promise<MediaEntryMeta> => {
  const sourcePath = await resolveMainMarkdown(directory);
  let frontmatter: Record<string, unknown> = {};
  if (sourcePath) {
    try {
      frontmatter = readRawFrontmatter(await readFile(sourcePath, 'utf8'));
    } catch {
      // frontmatter 损坏时仍让条目出现在树里，只是退回目录名。
    }
  }

  const title = normalizeText(frontmatter.title);
  const slug = normalizeText(frontmatter.slug);
  const rawSeries = normalizeText(frontmatter.series);
  const hasSeries = rawSeries.length > 0;
  const series = rawSeries || slug || entryId;
  const versionLabel = normalizeText(frontmatter.versionLabel)
    || normalizeText(frontmatter.versionName)
    || entryId;

  return {
    collection,
    entryId,
    dirRel: toAdminContentRelativeProjectPath(directory),
    series,
    seriesLabel: series,
    version: entryId,
    versionLabel,
    entryLabel: title || versionLabel,
    title: title || entryId,
    date: readDateValue(frontmatter.date),
    exists: true,
    hasSeries
  };
};

const collectEntryDirectories = async (
  collection: AdminContentCollectionKey,
  directory: string,
  relativeDirectory = '',
  output: Array<{ directory: string; entryId: string }> = []
): Promise<Array<{ directory: string; entryId: string }>> => {
  if (!existsSync(directory)) return output;

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return output;
  }

  const hasMarkdown = entries.some((entry) => entry.isFile() && MARKDOWN_EXT_RE.test(entry.name));
  if (hasMarkdown) {
    output.push({ directory, entryId: relativeDirectory || 'index' });
    return output;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || ASSET_DIR_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
    await collectEntryDirectories(
      collection,
      path.join(directory, entry.name),
      relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name,
      output
    );
  }
  return output;
};

export const loadEntryMetas = async (): Promise<MediaEntryMeta[]> => {
  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);
  const metas = await Promise.all(
    ADMIN_CONTENT_COLLECTION_KEYS.map(async (collection) => {
      const entries = await collectEntryDirectories(
        collection,
        path.join(contentRoot, collection)
      );
      return Promise.all(
        entries.map((entry) => readEntryMeta(collection, entry.entryId, entry.directory))
      );
    })
  );
  return metas.flat();
};

export const findEntryForContentPath = (
  assetPath: string,
  entries: readonly MediaEntryMeta[]
): MediaEntryMeta | null => {
  const matched = entries
    .filter((entry) => assetPath.startsWith(`${entry.dirRel}/`))
    .sort((left, right) => right.dirRel.length - left.dirRel.length);
  return matched[0] ?? null;
};

export const findEntryForPublicPath = (
  assetPath: string,
  entries: readonly MediaEntryMeta[]
): { entry: MediaEntryMeta | null; collection: AdminContentCollectionKey; entryId: string; directory: string } | null => {
  if (!assetPath.startsWith('public/images/')) return null;
  const segments = assetPath.slice('public/images/'.length).split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const collection = segments[0]!;
  if (!isAdminContentCollectionKey(collection)) return null;
  const rest = segments.slice(1);
  const matched = entries
    .filter((entry) => entry.collection === collection
      && (rest.join('/') === entry.entryId || rest.join('/').startsWith(`${entry.entryId}/`)))
    .sort((left, right) => right.entryId.length - left.entryId.length)[0] ?? null;

  if (matched) {
    const relative = rest.join('/').slice(matched.entryId.length).replace(/^\/+/, '');
    return {
      entry: matched,
      collection,
      entryId: matched.entryId,
      directory: relative ? path.posix.dirname(relative).replace(/^\.$/, '') : ''
    };
  }

  const entryId = rest[0] ?? '';
  const relative = rest.slice(1).join('/');
  return {
    entry: null,
    collection,
    entryId,
    directory: relative ? path.posix.dirname(relative).replace(/^\.$/, '') : ''
  };
};
