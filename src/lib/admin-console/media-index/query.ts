import { loadAssets } from './assets';
import { loadEntryMetas } from './entries';
import { filterMediaItems } from './filter';
import { buildReferenceIndex } from './references';
import {
  buildBreadcrumb,
  buildFilterOptions,
  buildMediaFilterOptions,
  buildMediaTree
} from './tree';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type AdminMediaListRequest,
  type AdminMediaListResult,
  type AdminMediaReferenceFilter,
  type AdminMediaTypeFilter
} from './types';

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
