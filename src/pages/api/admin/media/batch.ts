import type { APIRoute } from 'astro';
import {
  ADMIN_JSON_HEADERS,
  createAdminWriteQueue,
  readAdminJsonRequestBody,
  validateAdminJsonWriteRequest
} from '../../../../lib/admin-console/admin-api';
import {
  AdminMediaBatchError,
  runAdminMediaBatch,
  type AdminMediaBatchAction,
  type AdminMediaBatchItemInput
} from '../../../../lib/admin-console/media-batch';

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });
const withLock = createAdminWriteQueue();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readItems = (value: unknown): AdminMediaBatchItemInput[] | null => {
  if (!Array.isArray(value)) return null;
  return value
    .filter(isRecord)
    .map((item) => ({
      path: typeof item.path === 'string' ? item.path : '',
      ...(typeof item.name === 'string' ? { name: item.name } : {}),
      ...(typeof item.to === 'string' ? { to: item.to } : {})
    }));
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const requestError = validateAdminJsonWriteRequest(request, url, 'Admin media batch');
  if (requestError) {
    return new Response(JSON.stringify({ ok: false, errors: [requestError.error] }, null, 2), {
      status: requestError.status,
      headers: ADMIN_JSON_HEADERS
    });
  }

  const bodyResult = await readAdminJsonRequestBody(request, {
    emptyBodyError: '请求体为空，请提交 action 与 items'
  });
  if (!bodyResult.ok) {
    return new Response(JSON.stringify({ ok: false, errors: [bodyResult.error] }, null, 2), {
      status: bodyResult.status,
      headers: ADMIN_JSON_HEADERS
    });
  }

  const body = isRecord(bodyResult.body) ? bodyResult.body : {};
  const action = typeof body.action === 'string' ? body.action as AdminMediaBatchAction : 'rename';
  const items = readItems(body.items);
  if (!items) {
    return new Response(JSON.stringify({ ok: false, errors: ['items 必须是数组'] }, null, 2), {
      status: 400,
      headers: ADMIN_JSON_HEADERS
    });
  }

  return withLock(async () => {
    try {
      const result = await runAdminMediaBatch({ action, items });
      return new Response(JSON.stringify({ ok: result.ok, result }, null, 2), {
        status: 200,
        headers: ADMIN_JSON_HEADERS
      });
    } catch (error) {
      if (error instanceof AdminMediaBatchError) {
        return new Response(JSON.stringify({ ok: false, errors: [error.message], code: error.code }, null, 2), {
          status: error.status,
          headers: ADMIN_JSON_HEADERS
        });
      }
      const message = error instanceof Error ? error.message : '批量操作失败';
      return new Response(JSON.stringify({ ok: false, errors: [message] }, null, 2), {
        status: 500,
        headers: ADMIN_JSON_HEADERS
      });
    }
  });
};
