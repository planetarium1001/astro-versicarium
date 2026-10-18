import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  createAdminWriteQueue,
  validateAdminFormDataWriteRequest
} from '../../../../../lib/admin-console/admin-api';
import {
  AdminImageUploadError,
  uploadAdminContentFile
} from '../../../../../lib/admin-console/image-upload';
import {
  isAdminContentImageUploadCollectionKey
} from '../../../../../lib/admin-console/content-collections';

const JSON_HEADERS = ADMIN_JSON_HEADERS;
const NOT_FOUND = new Response('Not Found', { status: 404 });
const withLock = createAdminWriteQueue();

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload, null, 2), { status, headers: JSON_HEADERS });

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) return NOT_FOUND.clone();

  const requestError = validateAdminFormDataWriteRequest(request, url, 'Admin Content files upload');
  if (requestError) return json(requestError.status, { ok: false, errors: [requestError.error] });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { ok: false, errors: ['上传请求不是合法 multipart/form-data'] });
  }

  const collection = String(formData.get('collection') ?? '').trim();
  const entryId = String(formData.get('entryId') ?? '').trim();
  const file = formData.get('file');
  if (!isAdminContentImageUploadCollectionKey(collection)) {
    return json(400, { ok: false, errors: ['当前 collection 不支持附件上传'] });
  }
  if (!entryId) return json(400, { ok: false, errors: ['上传请求缺少 entryId'] });
  if (!(file instanceof File)) return json(400, { ok: false, errors: ['上传请求缺少 file 文件'] });

  return withLock(async () => {
    try {
      const result = await uploadAdminContentFile({ collection, entryId, file });
      return json(200, { ok: true, result });
    } catch (error) {
      if (error instanceof AdminImageUploadError) {
        return json(error.status, { ok: false, errors: [error.message] });
      }
      return json(500, { ok: false, errors: [error instanceof Error ? error.message : String(error)] });
    }
  });
};
