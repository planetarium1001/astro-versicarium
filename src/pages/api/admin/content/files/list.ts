import type { APIRoute } from 'astro';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ADMIN_JSON_HEADERS } from '../../../../../lib/admin-console/admin-api';
import { getMimeTypeFromFileName } from '../../../../../lib/admin-console/image-cloud-storage';

const JSON_HEADERS = ADMIN_JSON_HEADERS;
const NOT_FOUND = new Response('Not Found', { status: 404 });
const getProjectRoot = () =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

type FileItem = {
  path: string;
  value: string;
  owner: string;
  fileName: string;
  size: number;
  mimeType: string | null;
  referenceCount: number;
  referenced: boolean;
};

const readMarkdownSources = async (): Promise<string[]> => {
  const sources: string[] = [];
  const visit = async (directory: string) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.name.toLowerCase().endsWith('.md')) {
        sources.push(await readFile(fullPath, 'utf8'));
      }
    }
  };
  await visit(path.join(getProjectRoot(), 'content'));
  return sources;
};

const countFileReferences = (
  sources: readonly string[],
  relativePath: string,
  value: string,
  fileName: string
): number =>
  sources.reduce((count, source) => {
    let total = count;
    for (const pattern of [relativePath, value, `./${relativePath}`, fileName]) {
      if (!pattern) continue;
      total += source.split(pattern).length - 1;
    }
    return total;
  }, 0);

const listFiles = async (directory: string, files: FileItem[] = []): Promise<FileItem[]> => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'images' || entry.name === 'assets') continue;
      await listFiles(fullPath, files);
      continue;
    }
    if (entry.name === 'index.md' || entry.name.toLowerCase().endsWith('.md')) continue;

    const relativePath = path.relative(getProjectRoot(), fullPath).replace(/\\/g, '/');
    if (!relativePath.startsWith('content/')) continue;
    const owner = relativePath.split('/').slice(0, 3).join('/');
    const fileStat = await stat(fullPath);
    const value = `./${relativePath.split('/').slice(3).join('/')}`;
    const referenceCount = countFileReferences(await readMarkdownSources(), relativePath, value, entry.name);
    files.push({
      path: relativePath,
      value,
      owner,
      fileName: entry.name,
      size: fileStat.size,
      mimeType: getMimeTypeFromFileName(fullPath),
      referenceCount,
      referenced: referenceCount > 0
    });
  }
  return files;
};

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV && !process.env.VITEST) return NOT_FOUND.clone();

  const owner = (url.searchParams.get('owner') ?? '').trim().replace(/\/+$/, '');
  if (owner && !owner.startsWith('content/')) {
    return new Response(JSON.stringify({ ok: false, errors: ['owner 必须是 content/ 下的条目路径'] }, null, 2), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  const root = path.join(getProjectRoot(), 'content');
  const files = await listFiles(owner ? path.join(getProjectRoot(), ...owner.split('/')) : root);
  const filtered = owner
    ? files.filter((file) => file.owner === owner)
    : files;

  return new Response(JSON.stringify({ ok: true, result: { owner, items: filtered } }, null, 2), {
    headers: JSON_HEADERS
  });
};
