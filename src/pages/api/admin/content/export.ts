import type { APIRoute } from 'astro';
import { ADMIN_JSON_HEADERS } from '../../../../lib/admin-console/admin-api';
import {
  ADMIN_CONTENT_COLLECTION_KEYS,
  getAdminContentCollectionCapability,
  isAdminContentCollectionKey,
  isAdminContentExportableCollectionKey
} from '../../../../lib/admin-console/content-collections';
import {
  AdminContentEntryResolutionError
} from '../../../../lib/admin-console/content-entry-source';
import {
  createAdminContentSourceDownloadHeaders,
  readAdminContentSourceDownload
} from '../../../../lib/admin-console/content-export';
import {
  AdminContentArchiveError,
  createAdminContentArchiveHeaders,
  readAdminContentEntryArchive
} from '../../../../lib/admin-console/content-archive';

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

const createJsonErrorResponse = (status: number, errors: readonly string[]): Response =>
  new Response(
    JSON.stringify({ ok: false, errors }, null, 2),
    {
      status,
      headers: ADMIN_JSON_HEADERS
    }
  );

const createEntryResolutionErrorResponse = (error: unknown): Response | null => {
  if (!(error instanceof AdminContentEntryResolutionError)) return null;

  return createJsonErrorResponse(
    error.code === 'source-not-found' ? 404 : 400,
    [error.message]
  );
};

const createArchiveErrorResponse = (error: unknown): Response | null => {
  if (!(error instanceof AdminContentArchiveError)) return null;
  return createJsonErrorResponse(error.status, [error.message]);
};

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const collection = url.searchParams.get('collection')?.trim() ?? '';
  const entryId = url.searchParams.get('entryId')?.trim() ?? '';
  // 旧行为默认导出 markdown；format=archive 才导出整个条目目录 zip。
  const format = url.searchParams.get('format')?.trim().toLowerCase() ?? '';
  const isArchive = format === 'archive';

  if (!collection) {
    return createJsonErrorResponse(400, ['查询参数缺少 collection']);
  }

  if (!isAdminContentCollectionKey(collection)) {
    return createJsonErrorResponse(
      400,
      [`不支持的 content collection：${collection}；仅支持 ${ADMIN_CONTENT_COLLECTION_KEYS.join(' / ')}`]
    );
  }

  if (!isAdminContentExportableCollectionKey(collection)) {
    return createJsonErrorResponse(
      400,
      [getAdminContentCollectionCapability(collection).readonlyReason ?? `当前 collection 暂不支持导出：${collection}`]
    );
  }

  if (!entryId) {
    return createJsonErrorResponse(400, ['查询参数缺少 entryId']);
  }

  try {
    if (isArchive) {
      const archive = await readAdminContentEntryArchive(collection, entryId);
      return new Response(archive.buffer as unknown as BodyInit, {
        headers: createAdminContentArchiveHeaders(archive.fileName)
      });
    }

    const download = await readAdminContentSourceDownload(collection, entryId);
    return new Response(download.sourceText, {
      headers: createAdminContentSourceDownloadHeaders(download.fileName, download.contentType)
    });
  } catch (error) {
    const archiveErrorResponse = createArchiveErrorResponse(error);
    if (archiveErrorResponse) return archiveErrorResponse;
    const errorResponse = createEntryResolutionErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
};
