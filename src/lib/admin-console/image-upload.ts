import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AdminContentEntryResolutionError,
  resolveAdminContentEntrySourcePath
} from './content-entry-source';
import {
  getProjectRoot,
  invalidateAdminImageCaches,
  readAdminLocalImageInspectionMeta
} from './image-shared';
import { getAdminImageFieldValue } from './image-params';
import {
  getMimeTypeFromFileName,
  isAdminImageCloudStorageEnabled,
  toSingleLayerSafeKeyPart,
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
 * 本地与云端落点统一为 `public/images/{collection}/{slug}/filename.ext`，
 * 其中 `{slug}` 是条目 entryId 且必须单层。
 */
const resolvePublicImageUploadDirectory = (
  collection: 'blog' | 'projects' | 'bits' | 'devlog',
  entryId: string
): string =>
  path.join(
    getProjectRoot(),
    'public',
    'images',
    collection,
    toSingleLayerSafeKeyPart(entryId)
  );

/** 正文图统一写绝对路径 `/images/...`（校验器同时支持相对路径与绝对路径）。 */
const toPublicImageAbsoluteSrc = (assetPath: string): string => {
  const relative = path.relative(path.join(getProjectRoot(), 'public'), assetPath).replace(/\\/g, '/');
  return `/${relative}`;
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
): Promise<{ assetPath: string; relativePath: string }> => {
  const assetPath = await writeUniqueImageFile(
    resolvePublicImageUploadDirectory(collection, entryId),
    safeFileName,
    buffer
  );
  return { assetPath, relativePath: toRelativeProjectPath(assetPath) };
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
  collection: 'blog' | 'projects' | 'devlog';
  entryId: string;
  file: File;
}): Promise<AdminImageUploadResult> => {
  assertUploadFile(file);

  // 条目必须存在（否则落到别人的目录里）。
  assertContentEntryCanReceiveImage(collection, entryId);
  const safeFileName = getSafeImageFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isAdminImageCloudStorageEnabled()) {
    return uploadAdminCloudImage({ collection, entryId, file, safeFileName, buffer });
  }

  const { assetPath, relativePath } = await writeLocalImageFile(collection, entryId, safeFileName, buffer);
  const meta = await readFreshImageInspectionMeta(relativePath);

  return {
    src: toPublicImageAbsoluteSrc(assetPath),
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
}): Promise<AdminImageUploadResult> => {
  assertUploadFile(file);

  assertContentEntryCanReceiveImage('bits', entryId);

  const safeFileName = getSafeImageFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isAdminImageCloudStorageEnabled()) {
    return uploadAdminCloudImage({ collection: 'bits', entryId, file, safeFileName, buffer });
  }

  const { assetPath, relativePath } = await writeLocalImageFile('bits', entryId, safeFileName, buffer);
  const src = getAdminImageFieldValue('bits.images', relativePath, 'public');
  if (!src) {
    throw new AdminImageUploadError('无法生成 bits.images 可保存的图片路径');
  }

  const meta = await readFreshImageInspectionMeta(relativePath);

  return {
    src,
    path: relativePath,
    fileName: path.basename(assetPath),
    width: meta.width,
    height: meta.height,
    size: meta.size,
    mimeType: meta.mimeType ?? (file.type.trim() || null)
  };
};
