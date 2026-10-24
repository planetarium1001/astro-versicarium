import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../../site.config.mjs';
import { ADMIN_CONTENT_COLLECTION_KEYS } from '../content-collections';
import { getMimeTypeFromFileName } from '../image-cloud-storage';
import { getProjectRoot } from '../../project-root';
import {
  toAdminContentAbsoluteProjectPath,
  toAdminContentRelativeProjectPath
} from '../content-entry-source';
import { findEntryForContentPath, findEntryForPublicPath } from './entries';
import { getReferenceStatus } from './references';
import {
  MARKDOWN_EXT_RE,
  SHARED_ENTRY_ID,
  SHARED_LABEL,
  UNASSIGNED_LABEL,
  UNASSIGNED_SERIES,
  UNASSIGNED_VERSION,
  isIgnoredFile,
  isImageFile,
  toPreviewSrc,
  type AdminMediaItem,
  type MediaEntryMeta
} from './types';

type MediaAssetRecord = Omit<
  AdminMediaItem,
  'referenceCount' | 'referenced' | 'referenceStatus'
>;

const walkFiles = async (directory: string): Promise<string[]> => {
  if (!existsSync(directory)) return [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    if (!entry.isFile() || isIgnoredFile(entry.name)) return [];
    return [fullPath];
  }));
  return nested.flat();
};

export const loadAssets = async (
  entries: readonly MediaEntryMeta[],
  referenceIndex: ReadonlyMap<string, number>
): Promise<AdminMediaItem[]> => {
  const assets: MediaAssetRecord[] = [];
  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);

  // content/<collection>/<entry>/...：图片和附件都收录，Markdown 主文件除外。
  for (const collection of ADMIN_CONTENT_COLLECTION_KEYS) {
    const collectionRoot = path.join(contentRoot, collection);
    for (const filePath of await walkFiles(collectionRoot)) {
      const relativePath = toAdminContentRelativeProjectPath(filePath);
      if (MARKDOWN_EXT_RE.test(relativePath)) continue;
      const relativeToCollection = relativePath.slice(`content/${collection}/`.length);
      // _shared 是 collection 级共享资源目录，不属于任何条目。
      const isShared = relativeToCollection.startsWith(`${SHARED_ENTRY_ID}/`);
      const entry = findEntryForContentPath(relativePath, entries);
      // 条目已删除但目录里还留着文件时也照样列出，标记为孤儿而不是静默丢弃。
      const relativeToEntry = entry
        ? relativePath.slice(entry.dirRel.length + 1)
        : relativeToCollection;
      const relativeToAssetRoot = isShared
        ? relativeToCollection.slice(SHARED_ENTRY_ID.length + 1)
        : relativeToEntry;
      const fileName = path.posix.basename(relativeToAssetRoot);
      const directory = path.posix.dirname(relativeToAssetRoot).replace(/^\.$/, '');
      assets.push({
        path: relativePath,
        origin: 'content',
        kind: isImageFile(fileName) ? 'image' : 'file',
        fileName,
        mimeType: getMimeTypeFromFileName(relativePath),
        size: 0,
        mtimeMs: null,
        collection: entry?.collection ?? collection,
        series: isShared ? '' : entry?.series ?? UNASSIGNED_SERIES,
        seriesLabel: isShared ? SHARED_LABEL : entry?.seriesLabel ?? UNASSIGNED_LABEL,
        hasSeries: isShared ? false : entry?.hasSeries ?? false,
        version: isShared ? SHARED_ENTRY_ID : entry?.version ?? UNASSIGNED_VERSION,
        versionLabel: isShared ? SHARED_LABEL : entry?.versionLabel ?? UNASSIGNED_LABEL,
        entryId: isShared ? SHARED_ENTRY_ID : entry?.entryId ?? '',
        entryLabel: isShared ? SHARED_LABEL : entry?.entryLabel ?? UNASSIGNED_LABEL,
        entryExists: isShared ? true : Boolean(entry),
        directory,
        previewSrc: isImageFile(fileName) ? toPreviewSrc(relativePath) : null
      });
    }
  }

  // public/images/<collection>/<entry>/...：兼容存量的条目图片目录。
  const publicImagesRoot = path.join(getProjectRoot(), 'public', 'images');
  for (const filePath of await walkFiles(publicImagesRoot)) {
    const relativePath = toAdminContentRelativeProjectPath(filePath);
    const resolved = findEntryForPublicPath(relativePath, entries);
    if (!resolved || !isImageFile(relativePath)) continue;
    const fileName = path.posix.basename(relativePath);
    const entry = resolved.entry;
    const isShared = resolved.entryId === SHARED_ENTRY_ID;
    assets.push({
      path: relativePath,
      origin: 'public',
      kind: 'image',
      fileName,
      mimeType: getMimeTypeFromFileName(relativePath),
      size: 0,
      mtimeMs: null,
      collection: resolved.collection,
      series: isShared ? '' : entry?.series ?? resolved.entryId ?? UNASSIGNED_SERIES,
      seriesLabel: isShared ? SHARED_LABEL : entry?.seriesLabel ?? resolved.entryId ?? UNASSIGNED_LABEL,
      hasSeries: isShared ? false : entry?.hasSeries ?? false,
      version: isShared ? SHARED_ENTRY_ID : entry?.version ?? resolved.entryId ?? UNASSIGNED_VERSION,
      versionLabel: isShared ? SHARED_LABEL : entry?.versionLabel ?? resolved.entryId ?? UNASSIGNED_LABEL,
      entryId: isShared ? SHARED_ENTRY_ID : resolved.entryId,
      entryLabel: isShared ? SHARED_LABEL : entry?.entryLabel ?? resolved.entryId ?? UNASSIGNED_LABEL,
      entryExists: isShared ? true : Boolean(entry),
      directory: resolved.directory,
      previewSrc: toPreviewSrc(relativePath)
    });
  }

  const withStats = await Promise.all(assets.map(async (asset) => {
    let size = 0;
    let mtimeMs: number | null = null;
    try {
      const fileStat = await stat(toAdminContentAbsoluteProjectPath(asset.path));
      size = fileStat.size;
      mtimeMs = fileStat.mtimeMs;
    } catch {
      // 扫描与 stat 之间文件可能被删除；保留条目但标记大小未知。
    }
    const referenceCount = referenceIndex.get(asset.path) ?? 0;
    return {
      ...asset,
      size,
      mtimeMs,
      referenceCount,
      referenced: referenceCount > 0,
      referenceStatus: getReferenceStatus(referenceCount, asset.entryExists)
    } satisfies AdminMediaItem;
  }));

  return withStats.sort((left, right) => {
    const collectionDiff = ADMIN_CONTENT_COLLECTION_KEYS.indexOf(left.collection)
      - ADMIN_CONTENT_COLLECTION_KEYS.indexOf(right.collection);
    if (collectionDiff !== 0) return collectionDiff;
    const seriesDiff = left.series.localeCompare(right.series, 'zh-CN');
    if (seriesDiff !== 0) return seriesDiff;
    const versionDiff = left.version.localeCompare(right.version, 'zh-CN');
    if (versionDiff !== 0) return versionDiff;
    const directoryDiff = left.directory.localeCompare(right.directory, 'zh-CN');
    if (directoryDiff !== 0) return directoryDiff;
    return left.fileName.localeCompare(right.fileName, 'zh-CN');
  });
};
