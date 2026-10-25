import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getMimeTypeFromFileName } from '../image-cloud-storage';
import { AdminImageError } from '../image-params';
import { getProjectRoot } from '../../project-root';
import {
  adminImageInspectionMetaCache,
  adminImageInspectionMetaPendingLoads,
  getAdminImageCacheKey,
  withAdminImageShortCache
} from './cache';
import type {
  AdminImageInspectionMeta,
  AdminImageMetaResult,
  LocalImageTarget
} from './types';

export const toAbsoluteAssetPath = (assetPath: string): string => path.join(getProjectRoot(), ...assetPath.split('/'));

const readSvgSize = (buffer: Buffer): { width: number | null; height: number | null } => {
  const source = buffer.toString('utf8');
  const widthMatch = source.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
  const heightMatch = source.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
  const parseSvgNumber = (value?: string): number | null => {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const width = parseSvgNumber(widthMatch?.[1]);
  const height = parseSvgNumber(heightMatch?.[1]);
  if (width && height) return { width, height };

  const viewBoxMatch = source.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
  return {
    width: parseSvgNumber(viewBoxMatch?.[1]),
    height: parseSvgNumber(viewBoxMatch?.[2])
  };
};

const readPngSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const readGifSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 10 || (buffer.toString('ascii', 0, 6) !== 'GIF87a' && buffer.toString('ascii', 0, 6) !== 'GIF89a')) {
    return null;
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
};

const readJpegSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (typeof marker !== 'number') {
      break;
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;

    const isSofMarker =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSofMarker) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
};

const readWebpSize = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    const signatureOffset = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (signatureOffset !== -1 && signatureOffset + 7 < buffer.length) {
      return {
        width: buffer.readUInt16LE(signatureOffset + 3) & 0x3fff,
        height: buffer.readUInt16LE(signatureOffset + 5) & 0x3fff
      };
    }
  }

  if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return null;
};

export const readAdminLocalImageInspectionMeta = async (assetPath: string): Promise<AdminImageInspectionMeta> => {
  const absolutePath = toAbsoluteAssetPath(assetPath);
  if (!existsSync(absolutePath)) {
    throw new AdminImageError(`图片文件不存在：${assetPath}`, 404);
  }

  const cacheKey = getAdminImageCacheKey('inspection-meta', assetPath);
  return withAdminImageShortCache(
    adminImageInspectionMetaCache,
    adminImageInspectionMetaPendingLoads,
    cacheKey,
    async () => {
      const [buffer, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
      const extension = path.extname(assetPath).toLowerCase();
      const sizeReaders = extension === '.svg'
        ? [readSvgSize]
        : [readPngSize, readGifSize, readJpegSize, readWebpSize];
      let width: number | null = null;
      let height: number | null = null;

      for (const reader of sizeReaders) {
        const result = reader(buffer);
        if (result) {
          width = result.width;
          height = result.height;
          break;
        }
      }

      return {
        width,
        height,
        size: fileStat.size,
        mimeType: getMimeTypeFromFileName(assetPath)
      };
    }
  );
};

export const readLocalImageMeta = async (target: LocalImageTarget): Promise<AdminImageMetaResult> => {
  const inspectionMeta = await readAdminLocalImageInspectionMeta(target.path);

  return {
    kind: 'local',
    path: target.path,
    value: target.value,
    origin: target.origin,
    width: inspectionMeta.width,
    height: inspectionMeta.height,
    size: inspectionMeta.size,
    mimeType: inspectionMeta.mimeType,
    previewSrc: target.previewSrc
  };
};
