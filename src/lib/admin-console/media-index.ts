import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../site.config.mjs';
import {
  ADMIN_CONTENT_COLLECTION_KEYS,
  getAdminContentCollectionCapability,
  isAdminContentCollectionKey,
  type AdminContentCollectionKey
} from './content-collections';
import { readRawFrontmatter } from '../content-entry-files';
import { getMimeTypeFromFileName } from './image-cloud-storage';
import { IMAGE_LOCAL_EXT_RE } from './image-params';

/**
 * 媒体管理器索引：把 content/ 条目目录与 public/images/ 条目图片统一成
 * collection → series → version → 目录。图片和附件都来自磁盘扫描，引用状态来自
 * content/ 里的 Markdown 引用解析。
 */

export type AdminMediaKind = 'image' | 'file';
export type AdminMediaReferenceStatus = 'referenced' | 'unreferenced' | 'orphan';
export type AdminMediaReferenceFilter = AdminMediaReferenceStatus | 'all';
export type AdminMediaTypeFilter = AdminMediaKind | 'all';
export type AdminMediaOrigin = 'content' | 'public';

export type AdminMediaItem = {
  path: string;
  origin: AdminMediaOrigin;
  kind: AdminMediaKind;
  fileName: string;
  mimeType: string | null;
  size: number;
  mtimeMs: number | null;
  collection: AdminContentCollectionKey;
  series: string;
  seriesLabel: string;
  hasSeries: boolean;
  version: string;
  versionLabel: string;
  entryId: string;
  entryLabel: string;
  entryExists: boolean;
  directory: string;
  referenceCount: number;
  referenced: boolean;
  referenceStatus: AdminMediaReferenceStatus;
  previewSrc: string | null;
};

export type AdminMediaFilterOption = {
  value: string;
  label: string;
  count: number;
  collection?: AdminContentCollectionKey;
  series?: string;
  entryId?: string;
};

export type AdminMediaTreeNode = {
  id: string;
  kind: 'collection' | 'series' | 'version' | 'directory';
  label: string;
  count: number;
  imageCount: number;
  fileCount: number;
  orphanCount: number;
  collection: AdminContentCollectionKey;
  series: string;
  version: string;
  entryId: string;
  directory: string;
  children: AdminMediaTreeNode[];
};

export type AdminMediaBreadcrumb = {
  id: string;
  label: string;
  filters: Partial<AdminMediaListRequest>;
};

export type AdminMediaListRequest = {
  collection: string;
  series: string;
  version: string;
  entry: string;
  directory: string;
  reference: AdminMediaReferenceFilter;
  type: AdminMediaTypeFilter;
  from: string;
  to: string;
  query: string;
  page: number;
  limit: number;
};

export type AdminMediaListResult = {
  items: AdminMediaItem[];
  page: number;
  totalPages: number;
  totalCount: number;
  filters: AdminMediaListRequest;
  tree: AdminMediaTreeNode[];
  breadcrumb: AdminMediaBreadcrumb[];
  referenceOptions: AdminMediaFilterOption[];
  typeOptions: AdminMediaFilterOption[];
  options: {
    series: AdminMediaFilterOption[];
    versions: AdminMediaFilterOption[];
    directories: AdminMediaFilterOption[];
  };
};

type MediaEntryMeta = {
  collection: AdminContentCollectionKey;
  entryId: string;
  dirRel: string;
  series: string;
  seriesLabel: string;
  hasSeries: boolean;
  version: string;
  versionLabel: string;
  entryLabel: string;
  title: string;
  date: Date | null;
  exists: boolean;
};

type MediaAssetRecord = Omit<
  AdminMediaItem,
  'referenceCount' | 'referenced' | 'referenceStatus'
>;

type MediaCounts = Pick<AdminMediaTreeNode, 'count' | 'imageCount' | 'fileCount' | 'orphanCount'>;

const MARKDOWN_EXT_RE = /\.(?:md|mdx)$/i;
const ASSET_DIR_NAMES = new Set(['images', 'files', 'assets']);
const IGNORED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const UNASSIGNED_SERIES = '(未归类)';
const UNASSIGNED_VERSION = '(未归类)';
const UNASSIGNED_LABEL = '未归属条目';
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const toAbsolutePath = (relativePath: string): string =>
  path.join(getProjectRoot(), ...relativePath.split('/'));

const toRelativePath = (absolutePath: string): string =>
  path.relative(getProjectRoot(), absolutePath).replace(/\\/g, '/');

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const isImageFile = (fileName: string): boolean => IMAGE_LOCAL_EXT_RE.test(fileName);

const isIgnoredFile = (fileName: string): boolean =>
  IGNORED_FILE_NAMES.has(fileName)
  || fileName.startsWith('.')
  || /\.(?:tmp|bak)$/i.test(fileName);

const toPreviewSrc = (assetPath: string): string | null => {
  if (assetPath.startsWith('public/')) return `/${assetPath.slice('public/'.length)}`;
  if (assetPath.startsWith('content/')) {
    return `/@fs/${encodeURI(toAbsolutePath(assetPath))}`;
  }
  return null;
};

const readDateValue = (value: unknown): Date | null => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** 找出目录里的主 Markdown：index.md 优先，否则唯一的 .md。 */
const resolveMainMarkdown = async (directory: string): Promise<string | null> => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && MARKDOWN_EXT_RE.test(entry.name))
    .map((entry) => entry.name);
  if (markdownFiles.length === 0) return null;
  const indexFile = markdownFiles.find((name) => name.toLowerCase() === 'index.md');
  return path.join(directory, indexFile ?? markdownFiles[0]!);
};

const readEntryMeta = async (
  collection: AdminContentCollectionKey,
  entryId: string,
  directory: string
): Promise<MediaEntryMeta> => {
  const sourcePath = await resolveMainMarkdown(directory);
  let frontmatter: Record<string, unknown> = {};
  if (sourcePath) {
    try {
      frontmatter = readRawFrontmatter(await readFile(sourcePath, 'utf8'));
    } catch {
      // frontmatter 损坏时仍让条目出现在树里，只是退回目录名。
    }
  }

  const title = normalizeText(frontmatter.title);
  const slug = normalizeText(frontmatter.slug);
  const rawSeries = normalizeText(frontmatter.series);
  const hasSeries = rawSeries.length > 0;
  const series = rawSeries || slug || entryId;
  const versionLabel = normalizeText(frontmatter.versionLabel)
    || normalizeText(frontmatter.versionName)
    || entryId;

  return {
    collection,
    entryId,
    dirRel: toRelativePath(directory),
    series,
    seriesLabel: series,
    version: entryId,
    versionLabel,
    entryLabel: title || versionLabel,
    title: title || entryId,
    date: readDateValue(frontmatter.date),
    exists: true,
    hasSeries
  };
};

const collectEntryDirectories = async (
  collection: AdminContentCollectionKey,
  directory: string,
  relativeDirectory = '',
  output: Array<{ directory: string; entryId: string }> = []
): Promise<Array<{ directory: string; entryId: string }>> => {
  if (!existsSync(directory)) return output;

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return output;
  }

  const hasMarkdown = entries.some((entry) => entry.isFile() && MARKDOWN_EXT_RE.test(entry.name));
  if (hasMarkdown) {
    output.push({ directory, entryId: relativeDirectory || 'index' });
    return output;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || ASSET_DIR_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
    await collectEntryDirectories(
      collection,
      path.join(directory, entry.name),
      relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name,
      output
    );
  }
  return output;
};

const loadEntryMetas = async (): Promise<MediaEntryMeta[]> => {
  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);
  const metas = await Promise.all(
    ADMIN_CONTENT_COLLECTION_KEYS.map(async (collection) => {
      const entries = await collectEntryDirectories(
        collection,
        path.join(contentRoot, collection)
      );
      return Promise.all(
        entries.map((entry) => readEntryMeta(collection, entry.entryId, entry.directory))
      );
    })
  );
  return metas.flat();
};

const findEntryForContentPath = (
  assetPath: string,
  entries: readonly MediaEntryMeta[]
): MediaEntryMeta | null => {
  const matched = entries
    .filter((entry) => assetPath.startsWith(`${entry.dirRel}/`))
    .sort((left, right) => right.dirRel.length - left.dirRel.length);
  return matched[0] ?? null;
};

const findEntryForPublicPath = (
  assetPath: string,
  entries: readonly MediaEntryMeta[]
): { entry: MediaEntryMeta | null; collection: AdminContentCollectionKey; entryId: string; directory: string } | null => {
  if (!assetPath.startsWith('public/images/')) return null;
  const segments = assetPath.slice('public/images/'.length).split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const collection = segments[0]!;
  if (!isAdminContentCollectionKey(collection)) return null;
  const rest = segments.slice(1);
  const matched = entries
    .filter((entry) => entry.collection === collection
      && (rest.join('/') === entry.entryId || rest.join('/').startsWith(`${entry.entryId}/`)))
    .sort((left, right) => right.entryId.length - left.entryId.length)[0] ?? null;

  if (matched) {
    const relative = rest.join('/').slice(matched.entryId.length).replace(/^\/+/, '');
    return {
      entry: matched,
      collection,
      entryId: matched.entryId,
      directory: relative ? path.posix.dirname(relative).replace(/^\.$/, '') : ''
    };
  }

  const entryId = rest[0] ?? '';
  const relative = rest.slice(1).join('/');
  return {
    entry: null,
    collection,
    entryId,
    directory: relative ? path.posix.dirname(relative).replace(/^\.$/, '') : ''
  };
};

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
  return toRelativePath(absolutePath);
};

/** 统计每个资源被 content/ Markdown 引用的次数。 */
const buildReferenceIndex = async (): Promise<Map<string, number>> => {
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

const getReferenceStatus = (
  referenceCount: number,
  entryExists: boolean
): AdminMediaReferenceStatus => {
  if (referenceCount > 0) return 'referenced';
  return entryExists ? 'unreferenced' : 'orphan';
};

const walkFiles = async (directory: string): Promise<string[]> => {
  if (!existsSync(directory)) return [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    if (!entry.isFile() || isIgnoredFile(entry.name)) return [];
    return [fullPath];
  }));
  return nested.flat();
};

const loadAssets = async (
  entries: readonly MediaEntryMeta[],
  referenceIndex: ReadonlyMap<string, number>
): Promise<AdminMediaItem[]> => {
  const assets: MediaAssetRecord[] = [];
  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);

  // content/<collection>/<entry>/...：图片和附件都收录，Markdown 主文件除外。
  for (const collection of ADMIN_CONTENT_COLLECTION_KEYS) {
    const collectionRoot = path.join(contentRoot, collection);
    for (const filePath of await walkFiles(collectionRoot)) {
      const relativePath = toRelativePath(filePath);
      if (MARKDOWN_EXT_RE.test(relativePath)) continue;
      const entry = findEntryForContentPath(relativePath, entries);
      // 条目已删除但目录里还留着文件时也照样列出，标记为孤儿而不是静默丢弃。
      const relativeToEntry = entry
        ? relativePath.slice(entry.dirRel.length + 1)
        : relativePath.slice(`content/${collection}/`.length);
      const fileName = path.posix.basename(relativeToEntry);
      const directory = path.posix.dirname(relativeToEntry).replace(/^\.$/, '');
      assets.push({
        path: relativePath,
        origin: 'content',
        kind: isImageFile(fileName) ? 'image' : 'file',
        fileName,
        mimeType: getMimeTypeFromFileName(relativePath),
        size: 0,
        mtimeMs: null,
        collection: entry?.collection ?? collection,
        series: entry?.series ?? UNASSIGNED_SERIES,
        seriesLabel: entry?.seriesLabel ?? UNASSIGNED_LABEL,
        hasSeries: entry?.hasSeries ?? false,
        version: entry?.version ?? UNASSIGNED_VERSION,
        versionLabel: entry?.versionLabel ?? UNASSIGNED_LABEL,
        entryId: entry?.entryId ?? '',
        entryLabel: entry?.entryLabel ?? UNASSIGNED_LABEL,
        entryExists: Boolean(entry),
        directory,
        previewSrc: isImageFile(fileName) ? toPreviewSrc(relativePath) : null
      });
    }
  }

  // public/images/<collection>/<entry>/...：兼容存量的条目图片目录。
  const publicImagesRoot = path.join(getProjectRoot(), 'public', 'images');
  for (const filePath of await walkFiles(publicImagesRoot)) {
    const relativePath = toRelativePath(filePath);
    const resolved = findEntryForPublicPath(relativePath, entries);
    if (!resolved || !isImageFile(relativePath)) continue;
    const fileName = path.posix.basename(relativePath);
    const entry = resolved.entry;
    assets.push({
      path: relativePath,
      origin: 'public',
      kind: 'image',
      fileName,
      mimeType: getMimeTypeFromFileName(relativePath),
      size: 0,
      mtimeMs: null,
      collection: resolved.collection,
      series: entry?.series ?? resolved.entryId ?? UNASSIGNED_SERIES,
      seriesLabel: entry?.seriesLabel ?? resolved.entryId ?? UNASSIGNED_LABEL,
      hasSeries: entry?.hasSeries ?? false,
      version: entry?.version ?? resolved.entryId ?? UNASSIGNED_VERSION,
      versionLabel: entry?.versionLabel ?? resolved.entryId ?? UNASSIGNED_LABEL,
      entryId: resolved.entryId,
      entryLabel: entry?.entryLabel ?? resolved.entryId ?? UNASSIGNED_LABEL,
      entryExists: Boolean(entry),
      directory: resolved.directory,
      previewSrc: toPreviewSrc(relativePath)
    });
  }

  const withStats = await Promise.all(assets.map(async (asset) => {
    let size = 0;
    let mtimeMs: number | null = null;
    try {
      const fileStat = await stat(toAbsolutePath(asset.path));
      size = fileStat.size;
      mtimeMs = fileStat.mtimeMs;
    } catch {
      // 扫描与 stat 之间文件可能被删除；保留条目但标记大小未知。
    }
    const referenceCount = referenceIndex.get(asset.path) ?? 0;
    return {
      ...asset,
      size,
      mtimeMs,
      referenceCount,
      referenced: referenceCount > 0,
      referenceStatus: getReferenceStatus(referenceCount, asset.entryExists)
    } satisfies AdminMediaItem;
  }));

  return withStats.sort((left, right) => {
    const collectionDiff = ADMIN_CONTENT_COLLECTION_KEYS.indexOf(left.collection)
      - ADMIN_CONTENT_COLLECTION_KEYS.indexOf(right.collection);
    if (collectionDiff !== 0) return collectionDiff;
    const seriesDiff = left.series.localeCompare(right.series, 'zh-CN');
    if (seriesDiff !== 0) return seriesDiff;
    const versionDiff = left.version.localeCompare(right.version, 'zh-CN');
    if (versionDiff !== 0) return versionDiff;
    const directoryDiff = left.directory.localeCompare(right.directory, 'zh-CN');
    if (directoryDiff !== 0) return directoryDiff;
    return left.fileName.localeCompare(right.fileName, 'zh-CN');
  });
};

const matchesQuery = (item: AdminMediaItem, query: string): boolean => {
  if (!query) return true;
  const haystack = [
    item.path,
    item.fileName,
    item.series,
    item.seriesLabel,
    item.version,
    item.versionLabel,
    item.entryId,
    item.entryLabel,
    item.directory
  ].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const parseDateBoundary = (value: string, endOfDay: boolean): number | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return endOfDay ? parsed.getTime() + 24 * 60 * 60 * 1000 - 1 : parsed.getTime();
};

const filterMediaItems = (
  items: readonly AdminMediaItem[],
  filters: AdminMediaListRequest
): AdminMediaItem[] => {
  const from = parseDateBoundary(filters.from, false);
  const to = parseDateBoundary(filters.to, true);

  return items.filter((item) => {
    if (filters.collection && item.collection !== filters.collection) return false;
    if (filters.series && item.series !== filters.series) return false;
    // entry 精确到条目目录；同时接受 versionLabel，便于直接用 v1/v2 筛选。
    const matchesEntry = (value: string): boolean =>
      item.entryId === value || item.version === value || item.versionLabel === value;
    if (filters.entry && !matchesEntry(filters.entry)) return false;
    if (filters.version && !matchesEntry(filters.version)) return false;
    if (filters.directory && item.directory !== filters.directory) return false;
    if (filters.reference !== 'all' && item.referenceStatus !== filters.reference) return false;
    if (filters.type !== 'all' && item.kind !== filters.type) return false;
    if (from !== null && (item.mtimeMs === null || item.mtimeMs < from)) return false;
    if (to !== null && (item.mtimeMs === null || item.mtimeMs > to)) return false;
    return matchesQuery(item, filters.query);
  });
};

const createEmptyCounts = (): MediaCounts => ({
  count: 0,
  imageCount: 0,
  fileCount: 0,
  orphanCount: 0
});

const addToCounts = (counts: MediaCounts, item: AdminMediaItem): void => {
  counts.count += 1;
  if (item.kind === 'image') counts.imageCount += 1;
  else counts.fileCount += 1;
  if (item.referenceStatus === 'orphan') counts.orphanCount += 1;
};

const createTreeNode = (
  kind: AdminMediaTreeNode['kind'],
  label: string,
  filters: Pick<AdminMediaTreeNode, 'collection' | 'series' | 'version' | 'entryId' | 'directory'>
): AdminMediaTreeNode => ({
  id: `${filters.collection}:${filters.series}:${filters.version}:${kind}:${filters.directory}`,
  kind,
  label,
  ...createEmptyCounts(),
  ...filters,
  children: []
});

/** 树按 collection → series → version → 目录 逐层建立；count 只统计当前筛选池。 */
const buildMediaTree = (items: readonly AdminMediaItem[]): AdminMediaTreeNode[] => {
  const collectionNodes = new Map<string, AdminMediaTreeNode>();

  for (const item of items) {
    const collectionLabel = getAdminContentCollectionCapability(item.collection).label;
    let collectionNode = collectionNodes.get(item.collection);
    if (!collectionNode) {
      collectionNode = createTreeNode('collection', collectionLabel, {
        collection: item.collection,
        series: '',
        version: '',
        entryId: '',
        directory: ''
      });
      collectionNodes.set(item.collection, collectionNode);
    }
    addToCounts(collectionNode, item);

    const seriesKey = item.series || UNASSIGNED_SERIES;
    let seriesNode = collectionNode.children.find((child) => child.series === seriesKey);
    if (!seriesNode) {
      seriesNode = createTreeNode('series', item.seriesLabel || seriesKey, {
        collection: item.collection,
        series: seriesKey,
        version: '',
        entryId: '',
        directory: ''
      });
      collectionNode.children.push(seriesNode);
    }
    addToCounts(seriesNode, item);

    const versionKey = item.version || item.entryId || UNASSIGNED_VERSION;
    let versionNode = seriesNode.children.find((child) => child.version === versionKey);
    if (!versionNode) {
      versionNode = createTreeNode('version', item.versionLabel || versionKey, {
        collection: item.collection,
        series: seriesKey,
        version: versionKey,
        entryId: item.entryId,
        directory: ''
      });
      seriesNode.children.push(versionNode);
    }
    addToCounts(versionNode, item);

    const directoryKey = item.directory;
    let directoryNode = versionNode.children.find((child) => child.directory === directoryKey);
    if (!directoryNode) {
      directoryNode = createTreeNode('directory', directoryKey || '条目根目录', {
        collection: item.collection,
        series: seriesKey,
        version: versionKey,
        entryId: item.entryId,
        directory: directoryKey
      });
      versionNode.children.push(directoryNode);
    }
    addToCounts(directoryNode, item);
  }

  const sortNodes = (nodes: AdminMediaTreeNode[]): void => {
    nodes.sort((left, right) => {
      if (left.kind === 'collection' && right.kind === 'collection') {
        return ADMIN_CONTENT_COLLECTION_KEYS.indexOf(left.collection)
          - ADMIN_CONTENT_COLLECTION_KEYS.indexOf(right.collection);
      }
      if (left.kind === 'directory') {
        return (left.directory || '').localeCompare(right.directory || '', 'zh-CN');
      }
      return left.label.localeCompare(right.label, 'zh-CN');
    });
    for (const node of nodes) sortNodes(node.children);
  };
  const roots = Array.from(collectionNodes.values());
  sortNodes(roots);
  return roots;
};

const buildBreadcrumb = (
  tree: readonly AdminMediaTreeNode[],
  filters: AdminMediaListRequest
): AdminMediaBreadcrumb[] => {
  const breadcrumb: AdminMediaBreadcrumb[] = [
    { id: 'all', label: '全部媒体', filters: {} }
  ];
  if (!filters.collection) return breadcrumb;

  const collectionNode = tree.find((node) => node.collection === filters.collection);
  if (!collectionNode) return breadcrumb;
  breadcrumb.push({
    id: collectionNode.id,
    label: collectionNode.label,
    filters: { collection: filters.collection }
  });
  if (!filters.series) return breadcrumb;

  const seriesNode = collectionNode.children.find((node) => node.series === filters.series);
  if (!seriesNode) return breadcrumb;
  breadcrumb.push({
    id: seriesNode.id,
    label: seriesNode.label,
    filters: { collection: filters.collection, series: filters.series }
  });
  const entryId = filters.entry || filters.version;
  if (!entryId) return breadcrumb;

  const versionNode = seriesNode.children.find((node) => node.entryId === entryId);
  if (!versionNode) return breadcrumb;
  breadcrumb.push({
    id: versionNode.id,
    label: versionNode.label,
    filters: { collection: filters.collection, series: filters.series, entry: entryId }
  });
  if (!filters.directory) return breadcrumb;

  const directoryNode = versionNode.children.find((node) => node.directory === filters.directory);
  if (directoryNode) {
    breadcrumb.push({
      id: directoryNode.id,
      label: directoryNode.label,
      filters: {
        collection: filters.collection,
        series: filters.series,
        entry: entryId,
        directory: filters.directory
      }
    });
  }
  return breadcrumb;
};

const buildFilterOptions = (
  items: readonly AdminMediaItem[],
  key: 'reference' | 'type'
): AdminMediaFilterOption[] => {
  if (key === 'type') {
    return [
      { value: 'all', label: '全部类型', count: items.length },
      { value: 'image', label: '图片', count: items.filter((item) => item.kind === 'image').length },
      { value: 'file', label: '附件', count: items.filter((item) => item.kind === 'file').length }
    ];
  }
  return [
    { value: 'all', label: '全部引用状态', count: items.length },
    { value: 'referenced', label: '已引用', count: items.filter((item) => item.referenceStatus === 'referenced').length },
    { value: 'unreferenced', label: '未引用', count: items.filter((item) => item.referenceStatus === 'unreferenced').length },
    { value: 'orphan', label: '孤儿', count: items.filter((item) => item.referenceStatus === 'orphan').length }
  ];
};

const buildMediaFilterOptions = (
  items: readonly AdminMediaItem[]
): AdminMediaListResult['options'] => {
  const series = new Map<string, AdminMediaFilterOption>();
  const versions = new Map<string, AdminMediaFilterOption>();
  const directories = new Map<string, AdminMediaFilterOption>();

  for (const item of items) {
    if (item.entryExists) {
      if (item.hasSeries) {
        const seriesKey = `${item.collection}:${item.series}`;
        const seriesOption = series.get(seriesKey) ?? {
          value: item.series,
          label: item.seriesLabel || item.series,
          count: 0,
          collection: item.collection
        };
        seriesOption.count += 1;
        series.set(seriesKey, seriesOption);
      }

      const versionOption = versions.get(item.entryId) ?? {
        value: item.entryId,
        label: item.hasSeries ? (item.versionLabel || item.entryId) : item.entryLabel,
        count: 0,
        collection: item.collection,
        series: item.series,
        entryId: item.entryId
      };
      versionOption.count += 1;
      versions.set(item.entryId, versionOption);

      const directoryKey = `${item.entryId} ${item.directory}`;
      const directoryOption = directories.get(directoryKey) ?? {
        value: item.directory,
        label: item.directory || '条目根目录',
        count: 0,
        collection: item.collection,
        series: item.series,
        entryId: item.entryId
      };
      directoryOption.count += 1;
      directories.set(directoryKey, directoryOption);
    }
  }

  const sortOptions = (values: AdminMediaFilterOption[]): AdminMediaFilterOption[] =>
    values.sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));

  return {
    series: sortOptions(Array.from(series.values())),
    versions: sortOptions(Array.from(versions.values())),
    directories: sortOptions(Array.from(directories.values()))
  };
};

const normalizeRequest = (request: Partial<AdminMediaListRequest>): AdminMediaListRequest => {
  const reference = request.reference === 'referenced'
    || request.reference === 'unreferenced'
    || request.reference === 'orphan'
    ? request.reference
    : 'all';
  const type = request.type === 'image' || request.type === 'file' ? request.type : 'all';
  const limit = Number.isFinite(request.limit) && (request.limit ?? 0) > 0
    ? Math.min(Math.floor(request.limit as number), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const page = Number.isFinite(request.page) && (request.page ?? 0) > 0
    ? Math.floor(request.page as number)
    : 1;

  return {
    collection: (request.collection ?? '').trim(),
    series: (request.series ?? '').trim(),
    version: (request.version ?? '').trim(),
    entry: (request.entry ?? '').trim(),
    directory: (request.directory ?? '').trim().replace(/^\/+|\/+$/g, ''),
    reference,
    type,
    from: (request.from ?? '').trim(),
    to: (request.to ?? '').trim(),
    query: (request.query ?? '').trim(),
    page,
    limit
  };
};

export const listAdminMediaItems = async (
  request: Partial<AdminMediaListRequest> = {}
): Promise<AdminMediaListResult> => {
  const filters = normalizeRequest(request);
  const [entries, referenceIndex] = await Promise.all([
    loadEntryMetas(),
    buildReferenceIndex()
  ]);
  const allItems = await loadAssets(entries, referenceIndex);

  // 树和筛选项基于 q/reference/type/time，而 collection/series/version/dir 只用于列表下钻。
  const treePool = filterMediaItems(allItems, {
    ...filters,
    collection: '',
    series: '',
    version: '',
    entry: '',
    directory: ''
  });
  const tree = buildMediaTree(treePool);
  const filtered = filterMediaItems(allItems, filters);
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.limit));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const startIndex = (page - 1) * filters.limit;

  return {
    items: filtered.slice(startIndex, startIndex + filters.limit),
    page,
    totalPages,
    totalCount,
    filters,
    tree,
    breadcrumb: buildBreadcrumb(tree, filters),
    referenceOptions: buildFilterOptions(treePool, 'reference'),
    typeOptions: buildFilterOptions(treePool, 'type'),
    options: buildMediaFilterOptions(allItems)
  };
};

export const getAdminMediaListRequest = (searchParams: URLSearchParams): AdminMediaListRequest =>
  normalizeRequest({
    collection: searchParams.get('collection') ?? '',
    series: searchParams.get('series') ?? '',
    version: searchParams.get('version') ?? '',
    entry: searchParams.get('entry') ?? '',
    directory: searchParams.get('dir') ?? '',
    reference: (searchParams.get('ref') ?? '') as AdminMediaReferenceFilter,
    type: (searchParams.get('type') ?? '') as AdminMediaTypeFilter,
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    query: searchParams.get('q') ?? '',
    page: Number.parseInt(searchParams.get('page') ?? '1', 10),
    limit: Number.parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  });

export const getAdminMediaFilterLabels = (): Record<AdminMediaReferenceStatus, string> => ({
  referenced: '已引用',
  unreferenced: '未引用',
  orphan: '孤儿'
});
