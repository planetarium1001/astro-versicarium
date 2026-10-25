import path from 'node:path';
import { CONTENT_ROOT } from '../../../../site.config.mjs';
import {
  getBitsAvatarLocalFilePath,
  getHeroImageLocalFilePath,
  normalizeBitsAvatarPath,
  normalizeHeroImageSrc,
  toSafeHttpUrl
} from '../../../utils/format';
import {
  buildAdminImageScopeItems,
  matchesAdminImageQuery,
  normalizeAdminImageBrowseGroup,
  normalizeAdminImageBrowseSubgroup,
  resolveAdminImageBrowsePage
} from '../image-browse';
import type { AdminImageOrigin } from '../image-contract';
import {
  ADMIN_IMAGE_LOCAL_PATH_MESSAGE,
  AdminImageError,
  IMAGE_LOCAL_EXT_RE,
  getAdminImageFieldAllowedOrigins,
  getAdminImageFieldValue,
  normalizeAdminImageOwnerValue,
  normalizeAdminLocalImageSource,
  type AdminImageFieldContext,
  type AdminImageListRequest,
  type AdminImageMetaInput
} from '../image-params';
import {
  listAdminImageBrowseAssets,
  loadAdminImageScopeIndex,
  resolveBrowseMeta,
  sortImageAssets,
  withoutCloudBrowseGroupOption
} from './browse';
import { readAdminLocalImageInspectionMeta, readLocalImageMeta, toAbsoluteAssetPath } from './probe';
import { listAdminImageAssets, loadContentOwnerOptions } from './scan';
import type {
  AdminImageAssetBrowseMeta,
  AdminImageAssetRecord,
  AdminImageListItem,
  AdminImageListResult,
  AdminImageMetaResult,
  LocalImageTarget
} from './types';

const toDevFsPreviewSrc = (assetPath: string): string =>
  `/@fs/${encodeURI(toAbsoluteAssetPath(assetPath).replace(/\\/g, '/'))}`;

const getPreviewSrcFromPath = (assetPath: string): string | null => {
  const safeRemoteUrl = toSafeHttpUrl(assetPath);
  if (safeRemoteUrl.startsWith('https://')) return safeRemoteUrl;
  if (assetPath.startsWith('public/')) return `/${assetPath.slice('public/'.length)}`;
  if (assetPath.startsWith('src/assets/') || assetPath.startsWith('content/')) {
    return toDevFsPreviewSrc(assetPath);
  }
  return null;
};

type FieldImageTarget =
  | { kind: 'local'; target: LocalImageTarget }
  | { kind: 'remote'; url: string };

const toAdminImageListItem = async (
  item: AdminImageAssetRecord & { value: string },
  browseMeta: AdminImageAssetBrowseMeta = resolveBrowseMeta(item)
): Promise<AdminImageListItem> => {
  if (item.origin === 'cloud') {
    const previewSrc = item.cloudMeta?.url ?? item.value;
    return {
      path: item.path,
      value: item.value,
      origin: item.origin,
      fileName: item.fileName,
      owner: item.owner,
      ownerLabel: item.ownerLabel,
      browseGroup: browseMeta.browseGroup,
      browseGroupLabel: browseMeta.browseGroupLabel,
      browseSubgroup: browseMeta.browseSubgroup,
      browseSubgroupLabel: browseMeta.browseSubgroupLabel,
      preferredValue: browseMeta.preferredValue,
      width: null,
      height: null,
      size: item.cloudMeta?.size ?? null,
      mimeType: item.cloudMeta?.mimeType ?? null,
      previewSrc
    } satisfies AdminImageListItem;
  }

  const meta = await readAdminLocalImageInspectionMeta(item.path);

  return {
    path: item.path,
    value: item.value,
    origin: item.origin,
    fileName: item.fileName,
    owner: item.owner,
    ownerLabel: item.ownerLabel,
    browseGroup: browseMeta.browseGroup,
    browseGroupLabel: browseMeta.browseGroupLabel,
    browseSubgroup: browseMeta.browseSubgroup,
    browseSubgroupLabel: browseMeta.browseSubgroupLabel,
    preferredValue: browseMeta.preferredValue,
    width: meta.width,
    height: meta.height,
    size: meta.size,
    mimeType: meta.mimeType,
    previewSrc: getPreviewSrcFromPath(item.path)
  } satisfies AdminImageListItem;
};

const resolveFieldImageTarget = (field: AdminImageFieldContext, rawValue: string): FieldImageTarget => {
  const value = rawValue.trim();
  if (!value) {
    throw new AdminImageError('图片值为空，无法读取元数据');
  }

  if (field === 'bits.images') {
    const safeRemoteUrl = toSafeHttpUrl(value);
    if (safeRemoteUrl.startsWith('https://')) return { kind: 'remote', url: safeRemoteUrl };

    const normalized = normalizeAdminLocalImageSource(value);
    if (!normalized) {
      throw new AdminImageError('bits.images 只允许 public/** 下的相对图片路径或 https:// 远程 URL');
    }

    return {
      kind: 'local',
      target: {
        path: `public/${normalized}`,
        value: normalized,
        origin: 'public',
        previewSrc: `/${normalized}`
      }
    };
  }

  if (field === 'page.bits.defaultAuthor.avatar') {
    const normalized = normalizeBitsAvatarPath(value);
    if (normalized === undefined || !normalized) {
      throw new AdminImageError('Bits 默认头像只允许相对图片路径（例如 author/avatar.webp）');
    }

    return {
      kind: 'local',
      target: {
        path: getBitsAvatarLocalFilePath(normalized) ?? `public/${normalized}`,
        value: normalized,
        origin: 'public',
        previewSrc: `/${normalized}`
      }
    };
  }

  const normalized = normalizeHeroImageSrc(value);
  if (!normalized) {
    throw new AdminImageError('Hero 图片只允许 src/assets/**、public 路径或 https:// 远程 URL');
  }

  if (normalized.startsWith('https://')) return { kind: 'remote', url: normalized };

  const localPath = getHeroImageLocalFilePath(normalized);
  if (!localPath) {
    throw new AdminImageError('Hero 图片地址不支持当前本地路径格式');
  }

  return {
    kind: 'local',
    target: {
      path: localPath,
      value: normalized,
      origin: localPath.startsWith('public/') ? 'public' : 'src/assets',
      previewSrc: getPreviewSrcFromPath(localPath)
    }
  };
};

const resolveLocalTargetFromPath = (assetPath: string): LocalImageTarget => {
  const normalizedPath = assetPath.trim().replace(/\\/g, '/');
  if (
    !normalizedPath
    || normalizedPath.startsWith('/')
    || normalizedPath.startsWith('//')
    || /^[A-Za-z]+:\/\//.test(normalizedPath)
    || /(^|\/)\.\.(?:\/|$)/.test(normalizedPath)
    || normalizedPath.includes('?')
    || normalizedPath.includes('#')
    || !IMAGE_LOCAL_EXT_RE.test(normalizedPath)
  ) {
    throw new AdminImageError(ADMIN_IMAGE_LOCAL_PATH_MESSAGE);
  }

  const canonicalPath = path.posix.normalize(normalizedPath);

  if (canonicalPath.startsWith('public/')) {
    return {
      path: canonicalPath,
      value: canonicalPath.slice('public/'.length),
      origin: 'public',
      previewSrc: getPreviewSrcFromPath(canonicalPath)
    };
  }

  if (canonicalPath.startsWith('src/assets/')) {
    return {
      path: canonicalPath,
      value: canonicalPath,
      origin: 'src/assets',
      previewSrc: getPreviewSrcFromPath(canonicalPath)
    };
  }

  if (canonicalPath.startsWith('content/')) {
    return {
      path: canonicalPath,
      value: canonicalPath,
      origin: 'content',
      previewSrc: getPreviewSrcFromPath(canonicalPath)
    };
  }

  throw new AdminImageError(ADMIN_IMAGE_LOCAL_PATH_MESSAGE);
};

export const getAdminImageMeta = async (input: AdminImageMetaInput): Promise<AdminImageMetaResult> => {
  const rawPath = 'path' in input && typeof input.path === 'string' ? input.path.trim() : '';
  if (rawPath) {
    const safeRemoteUrl = toSafeHttpUrl(rawPath);
    if (safeRemoteUrl.startsWith('https://')) {
      return {
        kind: 'remote',
        path: null,
        value: safeRemoteUrl,
        origin: 'cloud',
        width: null,
        height: null,
        size: null,
        mimeType: null,
        previewSrc: safeRemoteUrl
      };
    }

    return readLocalImageMeta(resolveLocalTargetFromPath(rawPath));
  }

  const rawValue = 'value' in input && typeof input.value === 'string' ? input.value.trim() : '';
  if (!('field' in input) || !input.field) {
    throw new AdminImageError('缺少 field 或 path，无法读取图片元数据');
  }

  if (!rawValue) {
    throw new AdminImageError('缺少图片值，无法读取元数据');
  }

  const fieldTarget = resolveFieldImageTarget(input.field, rawValue);
  if (fieldTarget.kind === 'remote') {
    return {
      kind: 'remote',
      path: null,
      value: fieldTarget.url,
      origin: null,
      width: null,
      height: null,
      size: null,
      mimeType: null,
      previewSrc: fieldTarget.url
    };
  }

  return readLocalImageMeta(fieldTarget.target);
};

export const listAdminImageItems = async ({
  field = null,
  directory = '',
  owner = '',
  origin = '',
  scope = '',
  group = '',
  subgroup = '',
  query = '',
  page = 1,
  limit = 20
}: Partial<AdminImageListRequest> = {}): Promise<AdminImageListResult> => {
  const requestedDirectory = directory;
  const normalizedQuery = query.trim();
  const normalizedOrigin = getAdminImageFieldAllowedOrigins(field).includes(origin as AdminImageOrigin)
    ? origin
    : '';
  const normalizedScope = !field && scope === 'recent' ? scope : '';
  const normalizedGroup = normalizeAdminImageBrowseGroup(group);
  const normalizedSubgroup = normalizeAdminImageBrowseSubgroup(subgroup);
  const safeLimit = Math.max(1, Math.min(limit, 60));
  const isScopeMode = normalizedScope === 'recent';
  const isBrowseMode = !field && normalizedGroup.length > 0;

  if (isScopeMode) {
    const browseAssets = await listAdminImageBrowseAssets();
    const scopePool = buildAdminImageScopeItems(
      normalizedScope,
      browseAssets,
      await loadAdminImageScopeIndex(browseAssets)
    ).filter((item) => matchesAdminImageQuery(item, normalizedQuery));
    const totalPages = Math.max(1, Math.ceil(scopePool.length / safeLimit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (safePage - 1) * safeLimit;
    const pageItems = scopePool.slice(startIndex, startIndex + safeLimit);
    const items = await Promise.all(pageItems.map((item) => toAdminImageListItem(item, item)));

    return {
      field: null,
      directory: '',
      owner: '',
      ownerOptions: [],
      scope: normalizedScope,
      group: '',
      subgroup: '',
      groupOptions: [],
      subgroupOptions: [],
      page: safePage,
      limit: safeLimit,
      totalCount: scopePool.length,
      totalPages,
      items
    };
  }

  if (isBrowseMode) {
    const browsePage = resolveAdminImageBrowsePage({
      items: await listAdminImageBrowseAssets(),
      group: normalizedGroup,
      subgroup: normalizedSubgroup,
      query: normalizedQuery,
      page,
      limit: safeLimit
    });
    const items = await Promise.all(browsePage.items.map((item) => toAdminImageListItem(item, item)));

    return {
      field: null,
      directory: '',
      owner: '',
      ownerOptions: [],
      scope: '',
      group: browsePage.activeGroup,
      subgroup: browsePage.activeGroup && browsePage.activeGroup !== 'all' ? browsePage.activeSubgroup : '',
      groupOptions: withoutCloudBrowseGroupOption(browsePage.groupOptions),
      subgroupOptions: browsePage.subgroupOptions,
      page: browsePage.page,
      limit: safeLimit,
      totalCount: browsePage.totalCount,
      totalPages: browsePage.totalPages,
      items
    };
  }

  const contentOwners = directory === CONTENT_ROOT ? await loadContentOwnerOptions() : [];
  const assets = await listAdminImageAssets(directory, contentOwners);
  const mappedAssets = assets
    .map((asset) => {
      const value = getAdminImageFieldValue(field, asset.path, asset.origin, asset.owner);
      if (!value) return null;
      return { ...asset, value };
    })
    .filter((asset): asset is AdminImageAssetRecord & { value: string } => asset !== null);
  const queryMatchedAssets = mappedAssets
    .filter((asset) => matchesAdminImageQuery(asset, normalizedQuery))
    .sort((left, right) => sortImageAssets(field, left, right));
  const ownerCountMap = queryMatchedAssets.reduce((counts, asset) => {
    if (!asset.owner) return counts;
    counts.set(asset.owner, (counts.get(asset.owner) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const ownerOptions = directory === CONTENT_ROOT
    ? contentOwners
        .map((contentOwner) => ({
          value: contentOwner.value,
          label: contentOwner.label,
          count: ownerCountMap.get(contentOwner.value) ?? 0
        }))
        .filter((option) => option.count > 0)
    : [];
  const normalizedOwner = directory === CONTENT_ROOT
    ? (() => {
        const candidate = normalizeAdminImageOwnerValue(owner);
        return ownerOptions.some((option) => option.value === candidate) ? candidate : '';
      })()
    : '';
  const filtered = queryMatchedAssets.filter((asset) =>
    (!normalizedOwner || asset.owner === normalizedOwner)
    && (!normalizedOrigin || asset.origin === normalizedOrigin)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeLimit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * safeLimit;
  const pageItems = filtered.slice(startIndex, startIndex + safeLimit);
  const items = await Promise.all(pageItems.map((item) => toAdminImageListItem(item)));

  return {
    field,
    // 回显调用方请求的目录（可能是已知前缀的子目录，如 public/images/bits）。
    directory: requestedDirectory,
    owner: normalizedOwner,
    ownerOptions,
    scope: '',
    group: '',
    subgroup: '',
    groupOptions: [],
    subgroupOptions: [],
    page: safePage,
    limit: safeLimit,
    totalCount: filtered.length,
    totalPages,
    items
  };
};
