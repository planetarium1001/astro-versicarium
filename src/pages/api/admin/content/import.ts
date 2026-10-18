import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  createAdminWriteQueue,
  validateAdminFormDataWriteRequest
} from '../../../../lib/admin-console/admin-api';
import {
  AdminContentArchiveError,
  importAdminContentEntryArchive
} from '../../../../lib/admin-console/content-archive';

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });
const withLock = createAdminWriteQueue();

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload, null, 2), { status, headers: ADMIN_JSON_HEADERS });

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const requestError = validateAdminFormDataWriteRequest(request, url, 'Admin content import');
  if (requestError) return json(requestError.status, { ok: false, errors: [requestError.error] });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { ok: false, errors: ['导入请求不是合法 multipart/form-data'] });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return json(400, { ok: false, errors: ['导入请求缺少 file 文件'] });
  }

  return withLock(async () => {
    try {
      const result = await importAdminContentEntryArchive(file);
      return json(200, { ok: true, result });
    } catch (error) {
      if (error instanceof AdminContentArchiveError) {
        return json(error.status, { ok: false, errors: [error.message], code: error.code });
      }
      return json(500, { ok: false, errors: [error instanceof Error ? error.message : String(error)] });
    }
  });
};
