import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../site.config.mjs';
import {
  AdminContentEntryResolutionError,
  resolveAdminContentEntrySourcePath
} from './content-entry-source';
import {
  getProjectRoot,
  invalidateAdminImageCaches,
  readAdminLocalImageInspectionMeta
} from './image-shared';
import {
  getMimeTypeFromFileName,
  isAdminImageCloudStorageEnabled,
  uploadAdminImageToCloudStorage
} from './image-cloud-storage';
import { AdminImageUploadError } from './image-upload-error';

type AdminImageUploadResult = {
  src: string;
  path: string;
  fileName: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
};

export { AdminImageUploadError } from './image-upload-error';

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const ADMIN_IMAGE_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;
const SHARED_ENTRY_ID = '_shared';

const normalizeSharedUploadEntryId = (entryId: string): string =>
  entryId.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

/**
 * `_shared` 是 collection 级共享资源目录，没有 Markdown 主文件；
 * 只作为上传落点，不参与条目解析。
 */
const isSharedUploadEntryId = (entryId: string): boolean =>
  normalizeSharedUploadEntryId(entryId) === SHARED_ENTRY_ID;

const assertInsideContentRoot = (contentRoot: string, target: string): void => {
  const relative = path.relative(contentRoot, target);
  const escapesRoot = relative === '..' || relative.startsWith(`..${path.sep}`);
  if (!relative || escapesRoot || path.isAbsolute(relative)) {
    throw new AdminImageUploadError('共享资源目录不在 content 目录内', 400);
  }
};

const resolveSharedUploadDirectory = (
  collection: 'blog' | 'projects' | 'bits' | 'devlog',
  entryId: string,
  assetDirectory: 'images' | 'files'
): { directory: string; entryDirectory: string } | null => {
  if (!isSharedUploadEntryId(entryId)) return null;

  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);
  const entryDirectory = path.join(contentRoot, collection, SHARED_ENTRY_ID);
  const directory = path.join(entryDirectory, assetDirectory);
  assertInsideContentRoot(contentRoot, directory);
  return { directory, entryDirectory };
};

const toRelativeProjectPath = (filePath: string): string =>
  path.relative(getProjectRoot(), filePath).replace(/\\/g, '/');

const normalizeFileBaseName = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || 'image';
};

const getSafeImageFileName = (fileName: string): string => {
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    throw new AdminImageUploadError('仅支持 avif / gif / jpg / jpeg / png / svg / webp 图片');
  }

  const baseName = normalizeFileBaseName(path.basename(fileName, path.extname(fileName)));
  return `${baseName}${extension}`;
};

const assertUploadFile = (file: File): void => {
  if (file.size <= 0) {
    throw new AdminImageUploadError('图片文件为空，请重新选择');
  }

  if (file.size > ADMIN_IMAGE_UPLOAD_MAX_BYTES) {
    throw new AdminImageUploadError('图片超过 12MB，请压缩后再上传', 413);
  }

  const type = file.type.trim().toLowerCase();
  if (type && !type.startsWith('image/') && type !== 'application/octet-stream') {
    throw new AdminImageUploadError('请选择图片文件');
  }
};

/**
 * 条目资源落点：`content/{collection}/{entryId}/{images|files}/filename.ext`。
 * entryId 可能包含多段，实际目录以条目主文件所在目录为准。
 */
const resolveEntryAssetUploadDirectory = (
  collection: 'blog' | 'projects' | 'bits' | 'devlog',
  entryId: string,
  assetDirectory: 'images' | 'files'
): { directory: string; entryDirectory: string } => {
  const shared = resolveSharedUploadDirectory(collection, entryId, assetDirectory);
  if (shared) return shared;

  const sourcePath = assertContentEntryCanReceiveImage(collection, entryId);
  const entryDirectory = path.dirname(sourcePath);
  return {
    directory: path.join(entryDirectory, assetDirectory),
    entryDirectory
  };
};

const toEntryRelativeAssetSrc = (assetPath: string, entryDirectory: string): string => {
  const relative = path.relative(entryDirectory, assetPath).replace(/\\/g, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
};

const createCandidateFileName = (safeFileName: string, index: number): string => {
  if (index <= 1) return safeFileName;
  const extension = path.extname(safeFileName);
  const baseName = safeFileName.slice(0, -extension.length);
  return `${baseName}-${index}${extension}`;
};

const writeUniqueImageFile = async (
  directory: string,
  safeFileName: string,
  buffer: Buffer
): Promise<string> => {
  await mkdir(directory, { recursive: true });

  for (let index = 1; index <= 999; index += 1) {
    const candidatePath = path.join(directory, createCandidateFileName(safeFileName, index));
    if (existsSync(candidatePath)) continue;

    try {
      await writeFile(candidatePath, buffer, { flag: 'wx' });
      return candidatePath;
    } catch (error) {
      if (isRecord(error) && error.code === 'EEXIST') continue;
      throw error;
    }
  }

  throw new AdminImageUploadError('无法生成可用文件名，请重命名图片后再上传', 409);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** 落盘到该条目的 public 目录，返回绝对路径与仓库相对路径。 */
const writeLocalImageFile = async (
  collection: 'blog' | 'projects' | 'bits' | 'devlog',
  entryId: string,
  safeFileName: string,
  buffer: Buffer
): Promise<{ assetPath: string; relativePath: string; entryDirectory: string }> => {
  const { directory, entryDirectory } = resolveEntryAssetUploadDirectory(collection, entryId, 'images');
  const assetPath = await writeUniqueImageFile(directory, safeFileName, buffer);
  return { assetPath, relativePath: toRelativeProjectPath(assetPath), entryDirectory };
};

/** 读取新写入图片的尺寸/大小信息；读写前后都要失效缓存，避免读到旧扫描结果。 */
const readFreshImageInspectionMeta = async (relativePath: string) => {
  invalidateAdminImageCaches();
  const meta = await readAdminLocalImageInspectionMeta(relativePath);
  invalidateAdminImageCaches();
  return meta;
};

const assertContentEntryCanReceiveImage = (
  collection: 'blog' | 'projects' | 'bits' | 'devlog',
  entryId: string
): string => {
  try {
    return resolveAdminContentEntrySourcePath(collection, entryId);
  } catch (error) {
    if (error instanceof AdminContentEntryResolutionError) {
      throw new AdminImageUploadError(error.message, error.code === 'source-not-found' ? 404 : 400);
    }
    throw error;
  }
};

const uploadAdminCloudImage = async ({
  collection,
  entryId,
  file,
  safeFileName,
  buffer
}: {
  collection: 'blog' | 'projects' | 'bits' | 'devlog';
  entryId: string;
  file: File;
  safeFileName: string;
  buffer: Buffer;
}): Promise<AdminImageUploadResult> => {
  const mimeType = file.type.trim() || getMimeTypeFromFileName(safeFileName);
  const cloudResult = await uploadAdminImageToCloudStorage({
    collection,
    entryId,
    fileName: safeFileName,
    buffer,
    mimeType
  });

  invalidateAdminImageCaches();

  return {
    src: cloudResult.url,
    path: cloudResult.key,
    fileName: path.basename(cloudResult.key),
    width: null,
    height: null,
    size: file.size,
    mimeType
  };
};

const uploadAdminMarkdownBodyImage = async ({
  collection,
  entryId,
  file
}: {
  collection: 'blog' | 'projects' | 'bits' | 'devlog';
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> => {
  assertUploadFile(file);

  // 条目必须存在（否则落到别人的目录里）；_shared 是上传专用目录，不要求 Markdown。
  if (!isSharedUploadEntryId(entryId)) {
    assertContentEntryCanReceiveImage(collection, entryId);
  }
  const safeFileName = getSafeImageFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isAdminImageCloudStorageEnabled()) {
    return uploadAdminCloudImage({ collection, entryId, file, safeFileName, buffer });
  }

  const { assetPath, relativePath, entryDirectory } = await writeLocalImageFile(collection, entryId, safeFileName, buffer);
  const meta = await readFreshImageInspectionMeta(relativePath);

  return {
    src: toEntryRelativeAssetSrc(assetPath, entryDirectory),
    path: relativePath,
    fileName: path.basename(assetPath),
    width: meta.width,
    height: meta.height,
    size: meta.size,
    mimeType: meta.mimeType ?? (file.type.trim() || null)
  };
};

export const uploadAdminBlogImage = async ({
  entryId,
  file
}: {
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> =>
  uploadAdminMarkdownBodyImage({ collection: 'blog', entryId, file });

export const uploadAdminProjectsImage = async ({
  entryId,
  file
}: {
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> =>
  uploadAdminMarkdownBodyImage({ collection: 'projects', entryId, file });

export const uploadAdminDevlogImage = async ({
  entryId,
  file
}: {
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> =>
  uploadAdminMarkdownBodyImage({ collection: 'devlog', entryId, file });

export const uploadAdminBitsImage = async ({
  entryId,
  file
}: {
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> =>
  uploadAdminMarkdownBodyImage({ collection: 'bits', entryId, file });

const SUPPORTED_FILE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const getSafeFileName = (fileName: string): string => {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = normalizeFileBaseName(path.basename(fileName, path.extname(fileName)));
  return `${baseName}${extension}`;
};

export const uploadAdminContentFile = async ({
  collection,
  entryId,
  file
}: {
  collection: 'blog' | 'projects' | 'bits' | 'devlog';
  entryId: string;
  file: File;
}): Promise<{ src: string; path: string; fileName: string; size: number; mimeType: string | null }> => {
  if (file.size <= 0) throw new AdminImageUploadError('文件为空，请重新选择');
  if (file.size > SUPPORTED_FILE_UPLOAD_MAX_BYTES) {
    throw new AdminImageUploadError('文件超过 50MB，请压缩后再上传', 413);
  }

  const safeFileName = getSafeFileName(file.name);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { directory, entryDirectory } = resolveEntryAssetUploadDirectory(collection, entryId, 'files');
  const assetPath = await writeUniqueImageFile(directory, safeFileName, buffer);
  const relativePath = toRelativeProjectPath(assetPath);

  return {
    src: toEntryRelativeAssetSrc(assetPath, entryDirectory),
    path: relativePath,
    fileName: path.basename(assetPath),
    size: buffer.length,
    mimeType: file.type.trim() || getMimeTypeFromFileName(assetPath)
  };
};
