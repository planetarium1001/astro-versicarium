import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest
} from '../../../../lib/admin-console/admin-api';
import { createAdminBlogVersion } from '../../../../lib/admin-console/content-create-version';
import { withAdminContentWriteLock } from '../../../../lib/admin-console/content-write-lock';
import { isRecord } from '../../../../lib/is-record';

const JSON_HEADERS = ADMIN_JSON_HEADERS;
const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

// 静态构建按 GET 预渲染每个路由；补上与其它接口一致的 404 壳，
// 避免 router 告警与 4KB HTML 404 fallback。POST 的 DEV/TEST 守卫不变。
export const GET: APIRoute = async () => DEV_ONLY_NOT_FOUND_RESPONSE.clone();

const errorResponse = (status: number, message: string): Response =>
  new Response(JSON.stringify({ ok: false, errors: [message] }, null, 2), {
    status,
    headers: JSON_HEADERS
  });

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const requestError = validateAdminJsonWriteRequest(request, url, 'Content Console create version', '新建版本');
  if (requestError) return errorResponse(requestError.status, requestError.error);

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '请求体为空，请确认已发送 JSON 字符串'
  });
  if (!bodyResult.ok) return errorResponse(bodyResult.status, bodyResult.error);
  if (!isRecord(bodyResult.body)) return errorResponse(400, '请求体必须是 JSON 对象');

  const entryId = typeof bodyResult.body.entryId === 'string' ? bodyResult.body.entryId.trim() : '';
  const date = typeof bodyResult.body.date === 'string' ? bodyResult.body.date : undefined;
  const versionLabel = typeof bodyResult.body.versionLabel === 'string'
    ? bodyResult.body.versionLabel
    : undefined;
  if (!entryId) return errorResponse(400, '请求体缺少 entryId');

  return withAdminContentWriteLock(async () => {
    try {
      const result = await createAdminBlogVersion({ entryId, date, versionLabel });
      return new Response(JSON.stringify({ ok: true, result }, null, 2), {
        headers: JSON_HEADERS
      });
    } catch (error) {
      return errorResponse(400, error instanceof Error ? error.message : String(error));
    }
  });
};
