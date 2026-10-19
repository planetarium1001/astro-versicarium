import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { ADMIN_JSON_HEADERS } from '../../../../lib/admin-console/admin-api';
import { CONTENT_ROOT } from '../../../../../site.config.mjs';

const DEV_ONLY_NOT_FOUND_RESPONSE = new Response('Not Found', { status: 404 });
const MAX_PREVIEW_BYTES = 256 * 1024;

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.mdx',
  '.json',
  '.yml',
  '.yaml',
  '.csv',
  '.tsv',
  '.log',
  '.toml',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.sh'
]);

const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const json = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: ADMIN_JSON_HEADERS
  });

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) {
    return DEV_ONLY_NOT_FOUND_RESPONSE.clone();
  }

  const relativePath = (url.searchParams.get('path') ?? '').trim();
  if (!relativePath) {
    return json({ ok: false, errors: ['缺少 path 参数'] }, 400);
  }

  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    normalized.includes('\0')
    || normalized.split('/').includes('..')
    || !normalized.startsWith(`${CONTENT_ROOT}/`)
  ) {
    return json({ ok: false, errors: ['只允许读取内容目录下的文本文件'] }, 400);
  }

  const extension = path.extname(normalized).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) {
    return json({ ok: false, errors: ['该文件类型不支持文本预览'] }, 415);
  }

  const contentRoot = path.resolve(getProjectRoot(), CONTENT_ROOT);
  const absolutePath = path.resolve(getProjectRoot(), normalized);
  if (absolutePath !== contentRoot && !absolutePath.startsWith(`${contentRoot}${path.sep}`)) {
    return json({ ok: false, errors: ['路径越界'] }, 400);
  }

  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) {
      return json({ ok: false, errors: ['目标不是文件'] }, 400);
    }

    const buffer = await readFile(absolutePath);
    const truncated = buffer.byteLength > MAX_PREVIEW_BYTES;
    const text = buffer.subarray(0, MAX_PREVIEW_BYTES).toString('utf8');

    return json({
      ok: true,
      result: {
        path: normalized,
        text,
        truncated,
        size: info.size,
        mtimeMs: info.mtimeMs
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '文本读取失败';
    return json({ ok: false, errors: [message] }, 404);
  }
};
