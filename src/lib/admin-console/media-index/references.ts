import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../../site.config.mjs';
import { getProjectRoot } from '../../project-root';
import { toAdminContentRelativeProjectPath } from '../content-entry-source';
import { MARKDOWN_EXT_RE, type AdminMediaReferenceStatus } from './types';

const decodeReferencePath = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extractMarkdownReferences = (source: string): string[] => {
  const references: string[] = [];
  const seenIndexes = new Set<number>();
  const push = (value: string | undefined, matchIndex: number, matchText: string) => {
    const normalized = (value ?? '').trim().replace(/^<|>$/g, '');
    if (!normalized) return;
    const captureIndex = matchText.indexOf(normalized);
    const index = matchIndex + (captureIndex >= 0 ? captureIndex : 0);
    // 同一位置被 Markdown 链接正则和裸路径正则同时命中时只算一次。
    if (seenIndexes.has(index)) return;
    seenIndexes.add(index);
    references.push(normalized);
  };

  for (const match of source.matchAll(/!?\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    push(match[1], match.index ?? 0, match[0]);
  }
  for (const match of source.matchAll(/<[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
    push(match[1], match.index ?? 0, match[0]);
  }
  // frontmatter 里的 src: ./images/x.png 之类。
  for (const match of source.matchAll(/^\s*(?:-\s*)?(?:src|href|image|cover|icon|avatar|file|url):\s*["']?([^\s"'<>]+)/gim)) {
    push(match[1], match.index ?? 0, match[0]);
  }
  // 正文里裸露的相对路径（没有包在 Markdown 链接里的情况）。
  for (const match of source.matchAll(/(?:^|[\s("'=])((?:\.{1,2}\/|images\/|files\/|assets\/)[^\s"'`<>)]+)/g)) {
    push(match[1], match.index ?? 0, match[0]);
  }
  return references;
};

const resolveReferencePath = (
  reference: string,
  sourcePath: string
): string | null => {
  const raw = reference.split('#', 1)[0]!.split('?', 1)[0]!.trim();
  if (!raw || /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//')) return null;
  const pathname = decodeReferencePath(raw);

  if (pathname.startsWith('/content-assets/')) {
    return `${CONTENT_ROOT}/${pathname.slice('/content-assets/'.length).replace(/^\/+/, '')}`;
  }
  if (pathname.startsWith('/images/')) {
    return `public${pathname}`;
  }
  if (pathname.startsWith(`${CONTENT_ROOT}/`) || pathname.startsWith('public/')) {
    return pathname.replace(/\\/g, '/');
  }

  // 与 content-asset-paths.mjs 同口径：条目相对、images/、assets/ 三种回退。
  const sourceDirectory = path.dirname(sourcePath);
  const candidates = [path.resolve(sourceDirectory, pathname)];
  if (!pathname.startsWith('.')) {
    candidates.push(path.resolve(sourceDirectory, 'images', pathname));
    candidates.push(path.resolve(sourceDirectory, 'assets', pathname));
  }
  const absolutePath = candidates.find((candidate) => existsSync(candidate));
  if (!absolutePath) return null;
  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);
  if (absolutePath !== contentRoot && !absolutePath.startsWith(`${contentRoot}${path.sep}`)) return null;
  return toAdminContentRelativeProjectPath(absolutePath);
};

/** 统计每个资源被 content/ Markdown 引用的次数。 */
export const buildReferenceIndex = async (): Promise<Map<string, number>> => {
  const references = new Map<string, number>();
  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);
  const visit = async (directory: string): Promise<void> => {
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
        continue;
      }
      if (!entry.isFile() || !MARKDOWN_EXT_RE.test(entry.name)) continue;
      let source: string;
      try {
        source = await readFile(fullPath, 'utf8');
      } catch {
        continue;
      }
      for (const reference of extractMarkdownReferences(source)) {
        const resolved = resolveReferencePath(reference, fullPath);
        if (!resolved) continue;
        references.set(resolved, (references.get(resolved) ?? 0) + 1);
      }
    }
  };
  await visit(contentRoot);
  return references;
};

export const getReferenceStatus = (
  referenceCount: number,
  entryExists: boolean
): AdminMediaReferenceStatus => {
  if (referenceCount > 0) return 'referenced';
  return entryExists ? 'unreferenced' : 'orphan';
};
