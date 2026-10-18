import type { APIRoute } from 'astro';
import { ADMIN_JSON_HEADERS } from '../../../../lib/admin-console/admin-api';
import {
  getAdminMediaListRequest,
  listAdminMediaItems
} from '../../../../lib/admin-console/media-index';

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  try {
    const result = await listAdminMediaItems(getAdminMediaListRequest(url.searchParams));
    return new Response(JSON.stringify({ ok: true, result }, null, 2), {
      headers: ADMIN_JSON_HEADERS
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '媒体列表读取失败';
    return new Response(JSON.stringify({ ok: false, errors: [message] }, null, 2), {
      status: 500,
      headers: ADMIN_JSON_HEADERS
    });
  }
};
