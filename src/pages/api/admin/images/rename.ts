import type { APIRoute } from 'astro';
import { AdminImageRenameError, renameAdminImage } from '../../../../lib/admin-console/image-rename';

/**
 * 图片重命名。仅开发环境可用：生产构建下返回 404，避免静态站点暴露写接口。
 * Body `{ from: 'images/blog/<slug>/old.webp', to: 'new.webp' }`，返回
 * `{ ok: true, result: { from, to, fileName, rewritten: [{ file, count }] } }`。
 * 目标已存在时返回 409 且不做改动；改名成功后同步改写内容里的引用（见 image-rename.ts）。
 */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
} as const;

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

// 静态构建按 GET 预渲染每个路由；补上与其它接口一致的 404 壳，
// 避免 router 告警与 4KB HTML 404 fallback。POST 的 DEV/TEST 守卫不变。
export const GET: APIRoute = async () => DEV_ONLY_NOT_FOUND_RESPONSE.clone();

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, errors: ['请求体必须是 JSON'] }, null, 2),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const body = (payload ?? {}) as { from?: unknown; to?: unknown };
  const from = typeof body.from === 'string' ? body.from : '';
  const to = typeof body.to === 'string' ? body.to : '';

  try {
    const result = await renameAdminImage({ from, to });
    return new Response(JSON.stringify({ ok: true, result }, null, 2), {
      headers: JSON_HEADERS
    });
  } catch (error) {
    if (error instanceof AdminImageRenameError) {
      return new Response(
        JSON.stringify({ ok: false, errors: [error.message], code: error.code }, null, 2),
        { status: error.status, headers: JSON_HEADERS }
      );
    }
    const message = error instanceof Error ? error.message : '图片重命名失败';
    return new Response(JSON.stringify({ ok: false, errors: [message] }, null, 2), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
};
