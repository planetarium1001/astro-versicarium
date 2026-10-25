import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../../site.config.mjs';
import type { AdminImageOrigin } from '../image-contract';
import { IMAGE_LOCAL_EXT_RE } from '../image-params';
import { getProjectRoot } from '../../project-root';
import {
  adminImageAssetListCache,
  adminImageAssetListPendingLoads,
  adminImageOwnerOptionsCache,
  adminImageOwnerOptionsPendingLoads,
  getAdminImageCacheKey,
  withAdminImageShortCache
} from './cache';
import {
  ADMIN_IMAGE_SCAN_ROOTS,
  CONTENT_COLLECTION_LABELS,
  MARKDOWN_EXT_RE,
  OWNER_PATH_SEPARATORS,
  RELATIVE_CONTENT_ASSET_RE,
  type AdminImageAssetRecord,
  type AdminImageContentOwner,
  type ContentCollectionKey
} from './types';

const isImageFile = (name: string): boolean => IMAGE_LOCAL_EXT_RE.test(name);

const walkImageFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walkImageFiles(fullPath);
      }
      return entry.isFile() && isImageFile(entry.name) ? [fullPath] : [];
    })
  );
  return nested.flat();
};

const walkMarkdownFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walkMarkdownFiles(fullPath);
      }
      return entry.isFile() && MARKDOWN_EXT_RE.test(entry.name) ? [fullPath] : [];
    })
  );
  return nested.flat();
};

const stripQuotes = (value: string): string => value.replace(/^['"]|['"]$/g, '').trim();

const humanizeEntryId = (value: string): string =>
  value
    .split(/[/-]+/)
    .filter(Boolean)
    .join(' ')
    .trim();

const extractContentTitle = (source: string): string | null => {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const frontmatterSource = match[1] ?? '';

  const titleLine = frontmatterSource
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith('title:'));

  if (!titleLine) return null;
  const [, rawTitle = ''] = titleLine.split(/:(.+)/, 2);
  const normalized = stripQuotes(rawTitle);
  return normalized || null;
};

const normalizeRelativeContentAssetRef = (value: string): string | null => {
  const normalized = stripQuotes((value.split(/[?#]/, 1)[0] ?? '').trim());
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || /^[A-Za-z]+:\/\//.test(normalized)
    || !normalized.startsWith('.')
  ) {
    return null;
  }

  return normalized;
};

const extractContentAssetAliases = (source: string, ownerValue: string): string[] => {
  const aliases = new Set<string>([ownerValue]);
  const ownerDirectory = path.posix.dirname(ownerValue);

  for (const match of source.matchAll(RELATIVE_CONTENT_ASSET_RE)) {
    const relativeRef = normalizeRelativeContentAssetRef(match[1] ?? match[2] ?? '');
    if (!relativeRef) continue;

    const resolvedPath = path.posix.normalize(path.posix.join(ownerDirectory, relativeRef));
    if (!resolvedPath.startsWith('content/')) continue;

    aliases.add(resolvedPath);
    const resolvedDirectory = path.posix.dirname(resolvedPath);
    if (resolvedDirectory && resolvedDirectory !== ownerDirectory) {
      aliases.add(resolvedDirectory);
    }
  }

  return Array.from(aliases);
};

export const loadContentOwnerOptions = async (): Promise<AdminImageContentOwner[]> => {
  const projectRoot = getProjectRoot();
  const contentRoot = path.join(projectRoot, CONTENT_ROOT);
  if (!existsSync(contentRoot)) return [];
  const cacheKey = getAdminImageCacheKey('content-owners');

  return withAdminImageShortCache(
    adminImageOwnerOptionsCache,
    adminImageOwnerOptionsPendingLoads,
    cacheKey,
    async () => {
      const markdownFiles = await walkMarkdownFiles(contentRoot);
      const owners = await Promise.all(
        markdownFiles.map(async (filePath) => {
          const relativeFilePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
          const relativeWithoutExt = relativeFilePath.replace(MARKDOWN_EXT_RE, '');
          const segments = relativeWithoutExt.split('/');
          const collection = segments[1] as ContentCollectionKey | undefined;
          if (!collection || !(collection in CONTENT_COLLECTION_LABELS)) return null;

          const entryId = segments.slice(2).join('/');
          if (!entryId) return null;

          const source = await readFile(filePath, 'utf8');
          const title = extractContentTitle(source);
          const fallbackId = entryId.endsWith('/index') ? entryId.slice(0, -'/index'.length) : entryId;
          const normalizedTitle = title || humanizeEntryId(fallbackId || entryId) || entryId;
          const ownerValue = relativeWithoutExt.endsWith('/index')
            ? relativeWithoutExt.slice(0, -'/index'.length)
            : relativeWithoutExt;

          return {
            value: ownerValue,
            label: `${CONTENT_COLLECTION_LABELS[collection]} · ${normalizedTitle}`,
            aliases: extractContentAssetAliases(source, ownerValue)
          } satisfies AdminImageContentOwner;
        })
      );

      return owners.filter((owner): owner is AdminImageContentOwner => owner !== null);
    }
  );
};

const resolveAssetOwner = (
  assetPath: string,
  owners: readonly AdminImageContentOwner[]
): AdminImageContentOwner | null => {
  const matched = owners
    .map((owner) => {
      const matchingAlias = owner.aliases
        .filter((alias) =>
          assetPath === alias
          || OWNER_PATH_SEPARATORS.some((separator) => assetPath.startsWith(`${alias}${separator}`))
          || (alias.endsWith('/index') && assetPath.startsWith(`${alias.slice(0, -'/index'.length)}/`))
        )
        .sort((left, right) => right.length - left.length)[0];

      return matchingAlias
        ? {
            owner,
            aliasLength: matchingAlias.length
          }
        : null;
    })
    .filter((entry): entry is { owner: AdminImageContentOwner; aliasLength: number } => entry !== null)
    .sort((left, right) => right.aliasLength - left.aliasLength);

  return matched[0]?.owner ?? null;
};

/**
 * 从 public 路径反推 collection + slug。
 * `public/images/` 满足「一级目录 === collection 名」的不变量，反推可靠；
 * `public/images/pages/**` 是站点级插画，没有 collection/slug，返回 null。
 */
const resolvePublicImageContentRef = (
  assetPath: string
): { collection: ContentCollectionKey; slug: string } | null => {
  if (!assetPath.startsWith('public/images/')) return null;
  const segments = assetPath.slice('public/images/'.length).split('/').filter(Boolean);
  if (segments.length < 3) return null;
  const [collection, slug] = segments;
  if (!collection || !slug) return null;
  if (collection === 'pages' || collection === 'site') return null;
  if (!(collection in CONTENT_COLLECTION_LABELS)) return null;
  return { collection: collection as ContentCollectionKey, slug };
};

/** 反推出的展示标签，例如 `博客 · 2026-04-26-theme-console-配置指南`。 */
const getPublicImageContentLabel = (
  assetPath: string
): string | null => {
  const ref = resolvePublicImageContentRef(assetPath);
  if (!ref) return null;
  return `${CONTENT_COLLECTION_LABELS[ref.collection]} · ${ref.slug}`;
};

const resolveImageScanTargets = (
  directory: string
): Array<{ origin: AdminImageOrigin; rootPath: string }> => {
  const projectRoot = getProjectRoot();
  if (!directory) {
    return ADMIN_IMAGE_SCAN_ROOTS.map((root) => ({
      origin: root.origin,
      rootPath: path.join(projectRoot, ...root.pathSegments)
    }));
  }

  const matchedRoot = ADMIN_IMAGE_SCAN_ROOTS.find(
    (root) => directory === root.prefix || directory.startsWith(`${root.prefix}/`)
  );
  if (!matchedRoot) return [];

  return [
    {
      origin: matchedRoot.origin,
      rootPath: path.join(projectRoot, ...directory.split('/'))
    }
  ];
};

export const getOriginSortRank = (assetPath: string): number => {
  if (assetPath.startsWith('https://')) return ADMIN_IMAGE_SCAN_ROOTS.length;
  const index = ADMIN_IMAGE_SCAN_ROOTS.findIndex((root) => assetPath.startsWith(`${root.prefix}/`));
  return index === -1 ? ADMIN_IMAGE_SCAN_ROOTS.length : index;
};

export const listAdminImageAssets = async (
  directory: string,
  contentOwners?: readonly AdminImageContentOwner[]
): Promise<AdminImageAssetRecord[]> => {
  const projectRoot = getProjectRoot();
  const cacheKey = getAdminImageCacheKey('asset-list', directory || 'all');

  return withAdminImageShortCache(
    adminImageAssetListCache,
    adminImageAssetListPendingLoads,
    cacheKey,
    async () => {
      const roots = resolveImageScanTargets(directory);
      const resolvedContentOwners = roots.some((root) => root.origin === 'content')
        ? (contentOwners?.length ? [...contentOwners] : await loadContentOwnerOptions())
        : [];

      const entries = await Promise.all(
        roots.map(async ({ origin, rootPath }) => {
          if (!existsSync(rootPath)) return [] as AdminImageAssetRecord[];
          const files = await walkImageFiles(rootPath);
          return files.map((filePath) => {
            const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
            const matchedOwner = origin === 'content'
              ? resolveAssetOwner(relativePath, resolvedContentOwners)
              : origin === 'public'
                ? (() => {
                    const ref = resolvePublicImageContentRef(relativePath);
                    if (!ref) return null;
                    return {
                      value: `public:${ref.collection}:${ref.slug}`,
                      label: getPublicImageContentLabel(relativePath) ?? ref.slug
                    };
                  })()
                : null;

            return {
              path: relativePath,
              origin,
              fileName: path.basename(filePath),
              owner: matchedOwner?.value ?? null,
              ownerLabel: matchedOwner?.label ?? null
            } satisfies AdminImageAssetRecord;
          });
        })
      );

      return entries.flat();
    }
  );
};
