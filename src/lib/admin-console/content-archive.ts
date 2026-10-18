import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import { CONTENT_ROOT } from '../../../site.config.mjs';
import {
  isAdminContentCollectionKey,
  type AdminContentCollectionKey
} from './content-collections';
import {
  resolveAdminContentEntrySourcePath,
  toAdminContentRelativeProjectPath
} from './content-entry-source';
import { getAdminContentEntryEditHref } from './content-routes';

/**
 * 整个条目目录的 zip 导出/导入。
 * 导入只接受 `content/<collection>/<entry>/...`，拒绝 `..`、绝对路径与覆盖已有目录。
 */

export type AdminContentArchiveDownload = {
  collection: AdminContentCollectionKey;
  entryId: string;
  fileName: string;
  buffer: Uint8Array;
  fileCount: number;
};

export type AdminContentArchiveImportResult = {
  collection: AdminContentCollectionKey;
  entryId: string;
  editHref: string;
  relativePath: string;
  fileCount: number;
};

export class AdminContentArchiveError extends Error {
  readonly status: number;

  readonly code: string;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'AdminContentArchiveError';
    this.code = code;
    this.status = status;
  }
}

const IGNORED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const toAbsolutePath = (relativePath: string): string =>
  path.join(getProjectRoot(), ...relativePath.split('/'));

const toAsciiFileName = (value: string): string => {
  const normalized = value.replace(/["\\]/g, '_').replace(/[^\x20-\x7E]/g, '_').trim();
  return normalized || 'entry.zip';
};

const encodeHeaderFileName = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

export const createAdminContentArchiveHeaders = (fileName: string): HeadersInit => ({
  'content-type': 'application/zip',
  'cache-control': 'no-store',
  'content-disposition': `attachment; filename="${toAsciiFileName(fileName)}"; filename*=UTF-8''${encodeHeaderFileName(fileName)}`
});

const walkEntryFiles = async (directory: string): Promise<string[]> => {
  const files: string[] = [];
  const visit = async (current: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_FILE_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };
  await visit(directory);
  return files.sort();
};

export const readAdminContentEntryArchive = async (
  collection: AdminContentCollectionKey,
  entryId: string
): Promise<AdminContentArchiveDownload> => {
  const sourcePath = resolveAdminContentEntrySourcePath(collection, entryId);
  const entryDirectory = path.dirname(sourcePath);
  const entryRelativePath = toAdminContentRelativeProjectPath(entryDirectory);
  if (!entryRelativePath.startsWith(`${CONTENT_ROOT}/`)) {
    throw new AdminContentArchiveError('invalid-entry', 400, `条目目录不在 ${CONTENT_ROOT}/ 下：${entryRelativePath}`);
  }

  const files = await walkEntryFiles(entryDirectory);
  const zipEntries: Record<string, Uint8Array> = {};
  for (const filePath of files) {
    const relativePath = toAdminContentRelativeProjectPath(filePath);
    zipEntries[relativePath] = await readFile(filePath);
  }

  return {
    collection,
    entryId,
    fileName: `${path.posix.basename(entryRelativePath)}.zip`,
    buffer: zipSync(zipEntries, { level: 6 }),
    fileCount: files.length
  };
};

type ParsedArchiveEntry = {
  archivePath: string;
  relativePath: string;
  content: Uint8Array;
};

const parseArchivePath = (
  rawPath: string
): { collection: AdminContentCollectionKey; segments: string[] } => {
  const normalized = rawPath.replace(/\\/g, '/');
  if (
    !normalized
    || normalized.startsWith('/')
    || /^[A-Za-z]:/.test(normalized)
    || normalized.includes('\u0000')
  ) {
    throw new AdminContentArchiveError('invalid-archive-path', 400, `压缩包包含非法路径：${rawPath}`);
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new AdminContentArchiveError('invalid-archive-path', 400, `压缩包路径不能包含 ../：${rawPath}`);
  }
  if (segments.length < 4 || segments[0] !== CONTENT_ROOT) {
    throw new AdminContentArchiveError(
      'invalid-archive-path',
      400,
      `压缩包只允许 ${CONTENT_ROOT}/<collection>/<entry>/... 路径：${rawPath}`
    );
  }

  const collection = segments[1]!;
  if (!isAdminContentCollectionKey(collection)) {
    throw new AdminContentArchiveError('invalid-collection', 400, `压缩包包含不支持的 collection：${collection}`);
  }
  const entrySegments = segments.slice(2);
  if (entrySegments.length < 2) {
    throw new AdminContentArchiveError('invalid-archive-path', 400, `压缩包缺少条目文件路径：${rawPath}`);
  }

  return { collection, segments: entrySegments };
};

const parseArchive = (buffer: Uint8Array): {
  collection: AdminContentCollectionKey;
  entryId: string;
  files: ParsedArchiveEntry[];
} => {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(buffer);
  } catch {
    throw new AdminContentArchiveError('invalid-archive', 400, '导入文件不是合法的 zip 压缩包');
  }

  const fileEntries = Object.entries(archive).filter(([archivePath]) => !archivePath.endsWith('/'));
  if (fileEntries.length === 0) {
    throw new AdminContentArchiveError('empty-archive', 400, '压缩包为空，没有可导入的文件');
  }

  const parsedFiles = fileEntries.map(([archivePath, content]) => ({
    archivePath,
    content,
    ...parseArchivePath(archivePath)
  }));
  const collection = parsedFiles[0]!.collection;
  if (parsedFiles.some((file) => file.collection !== collection)) {
    throw new AdminContentArchiveError('multiple-entries', 400, '一次只能导入一个 collection 的条目');
  }

  // 条目根目录优先由 Markdown 主文件所在目录推导，兼容 series/version 多级条目。
  const markdownDirectories = Array.from(new Set(
    parsedFiles
      .filter((file) => /\.(?:md|mdx)$/i.test(file.segments.at(-1) ?? ''))
      .map((file) => path.posix.dirname(file.segments.join('/')))
  )).filter((directory) => directory && directory !== '.');
  if (markdownDirectories.length > 1) {
    throw new AdminContentArchiveError(
      'multiple-entries',
      400,
      '一次只能导入一个条目目录，压缩包内包含多个条目'
    );
  }
  const entryId = markdownDirectories[0] ?? parsedFiles[0]!.segments[0]!;
  if (!entryId) {
    throw new AdminContentArchiveError('invalid-archive-path', 400, '压缩包缺少条目目录');
  }

  const files: ParsedArchiveEntry[] = parsedFiles.map((file) => {
    const fullRelativePath = file.segments.join('/');
    if (!fullRelativePath.startsWith(`${entryId}/`)) {
      throw new AdminContentArchiveError(
        'multiple-entries',
        400,
        '一次只能导入一个条目目录，压缩包内包含多个条目'
      );
    }
    return {
      archivePath: file.archivePath,
      relativePath: fullRelativePath.slice(entryId.length + 1),
      content: file.content
    };
  });

  return { collection, entryId, files };
};

export const importAdminContentEntryArchive = async (
  file: File
): Promise<AdminContentArchiveImportResult> => {
  if (!(file instanceof File) || file.size <= 0) {
    throw new AdminContentArchiveError('missing-file', 400, '请选择要导入的 zip 文件');
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new AdminContentArchiveError('archive-too-large', 413, '导入压缩包超过 50MB');
  }

  const parsed = parseArchive(new Uint8Array(await file.arrayBuffer()));
  const entryDirectoryRelative = `${CONTENT_ROOT}/${parsed.collection}/${parsed.entryId}`;
  const entryDirectoryAbsolute = toAbsolutePath(entryDirectoryRelative);
  if (existsSync(entryDirectoryAbsolute)) {
    throw new AdminContentArchiveError(
      'entry-exists',
      409,
      `目标条目目录已存在，导入不会覆盖：${entryDirectoryRelative}`
    );
  }

  const collectionDirectory = toAbsolutePath(`${CONTENT_ROOT}/${parsed.collection}`);
  await mkdir(collectionDirectory, { recursive: true });
  const stagingPath = path.join(collectionDirectory, `.import-${randomUUID()}`);

  try {
    for (const entry of parsed.files) {
      const targetPath = path.join(stagingPath, ...entry.relativePath.split('/'));
      const relativeToStaging = path.relative(stagingPath, targetPath);
      if (
        !relativeToStaging
        || relativeToStaging.startsWith('..')
        || path.isAbsolute(relativeToStaging)
      ) {
        throw new AdminContentArchiveError(
          'invalid-archive-path',
          400,
          `压缩包路径越界：${entry.archivePath}`
        );
      }
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, entry.content, { flag: 'wx' });
    }

    await mkdir(path.dirname(entryDirectoryAbsolute), { recursive: true });
    await rename(stagingPath, entryDirectoryAbsolute);
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true }).catch(() => {});
    if (error instanceof AdminContentArchiveError) throw error;
    throw new AdminContentArchiveError(
      'import-failed',
      500,
      `导入失败：${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    collection: parsed.collection,
    entryId: parsed.entryId,
    editHref: getAdminContentEntryEditHref(parsed.collection, parsed.entryId),
    relativePath: entryDirectoryRelative,
    fileCount: parsed.files.length
  };
};
