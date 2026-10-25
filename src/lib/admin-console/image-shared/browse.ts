import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { AdminImageBrowseFilterOption, AdminImageScopeIndex } from '../image-browse';
import { ADMIN_IMAGE_BROWSE_GROUP_LABELS } from '../image-contract';
import { listAdminCloudStorageImages } from '../image-cloud-storage';
import {
  getAdminImageCompatibleFieldValues,
  getAdminImageFieldSortRank,
  type AdminImageFieldContext
} from '../image-params';
import {
  adminImageScopeIndexCache,
  adminImageScopeIndexPendingLoads,
  getAdminImageCacheKey,
  withAdminImageShortCache
} from './cache';
import { toAbsoluteAssetPath } from './probe';
import { getOriginSortRank, listAdminImageAssets } from './scan';
import {
  ADMIN_IMAGE_ASSET_SUBGROUP_LABELS,
  ADMIN_IMAGE_PAGE_ALLOWLIST,
  SYSTEM_ASSET_FILE_PATTERNS,
  type AdminImageAssetBrowseMeta,
  type AdminImageAssetRecord,
  type AdminImageBrowseAsset
} from './types';

export const sortImageAssets = (field: AdminImageFieldContext | null, left: AdminImageAssetRecord, right: AdminImageAssetRecord): number => {
  const rankDiff = field
    ? getAdminImageFieldSortRank(field, left.path) - getAdminImageFieldSortRank(field, right.path)
    : getOriginSortRank(left.path) - getOriginSortRank(right.path);
  if (rankDiff !== 0) return rankDiff;
  return left.path.localeCompare(right.path);
};

const getCompatibleFieldValues = (record: AdminImageAssetRecord): string[] =>
  record.origin === 'cloud'
    ? [record.cloudMeta?.url ?? record.path].filter((value) => value.length > 0)
    : getAdminImageCompatibleFieldValues(record.path, record.origin, record.owner);

const getPreferredFieldValue = (record: AdminImageAssetRecord): string | null => {
  const compatibleValues = getCompatibleFieldValues(record);
  const [preferredValue] = compatibleValues;
  return compatibleValues.length === 1 ? preferredValue ?? null : null;
};

const isSystemAssetPath = (assetPath: string): boolean => {
  // Theme Console 站点图标托管目录整体按系统资产处理，不进入浏览与字段选择列表。
  if (assetPath.startsWith('public/images/site/')) return true;
  if (path.posix.dirname(assetPath) !== 'public') return false;
  const fileName = path.posix.basename(assetPath);
  return SYSTEM_ASSET_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
};

/** 从路径里取出第一段作为子分组（projects/devlog 用 entryId 当子分组）。 */
const getEntryIdBrowseSubgroup = (assetPath: string, prefixes: readonly string[]): string => {
  const prefix = prefixes.find((candidate) => assetPath.startsWith(candidate));
  if (!prefix) return '';
  return (assetPath.slice(prefix.length).split('/', 1)[0] ?? '').trim();
};

const getBitsBrowseSubgroup = (assetPath: string): { browseSubgroup: string; browseSubgroupLabel: string | null } => {
  // bits 落点是 public/images/bits/<slug>/
  const relativePath = assetPath.startsWith('public/images/bits/')
    ? assetPath.slice('public/images/bits/'.length)
    : assetPath.startsWith('content/bits/')
      ? assetPath.slice('content/bits/'.length)
      : '';
  const firstSegment = relativePath.split('/', 1)[0] ?? '';
  if (/^(?:19|20)\d{2}$/.test(firstSegment)) {
    return {
      browseSubgroup: firstSegment,
      browseSubgroupLabel: firstSegment
    };
  }

  return {
    browseSubgroup: '',
    browseSubgroupLabel: null
  };
};

export const resolveBrowseMeta = (record: AdminImageAssetRecord): AdminImageAssetBrowseMeta => {
  const preferredValue = getPreferredFieldValue(record);
  if (record.origin === 'cloud') {
    return {
      browseGroup: 'cloud',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.cloud,
      browseSubgroup: '',
      browseSubgroupLabel: null,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (isSystemAssetPath(record.path)) {
    return {
      browseGroup: 'uncategorized',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.uncategorized,
      browseSubgroup: '',
      browseSubgroupLabel: null,
      preferredValue,
      hiddenFromBrowse: true
    };
  }

  if (record.path.startsWith('content/blog/') || record.path.startsWith('public/images/blog/')) {
    return {
      browseGroup: 'blog',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.blog,
      // 子分组统一用 entryId：owner 形如 `public:blog:<slug>`，与 projects/devlog 的裸 slug 不一致
      browseSubgroup: getEntryIdBrowseSubgroup(record.path, [
        'content/blog/',
        'public/images/blog/'
      ]),
      browseSubgroupLabel: record.ownerLabel,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('content/projects/') || record.path.startsWith('public/images/projects/')) {
    return {
      browseGroup: 'projects',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.projects,
      browseSubgroup: getEntryIdBrowseSubgroup(record.path, ['content/projects/', 'public/images/projects/']),
      browseSubgroupLabel: null,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('content/devlog/') || record.path.startsWith('public/images/devlog/')) {
    return {
      browseGroup: 'devlog',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.devlog,
      browseSubgroup: getEntryIdBrowseSubgroup(record.path, ['content/devlog/', 'public/images/devlog/']),
      browseSubgroupLabel: null,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('content/bits/') || record.path.startsWith('public/images/bits/')) {
    const bitsSubgroup = getBitsBrowseSubgroup(record.path);
    return {
      browseGroup: 'bits',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.bits,
      browseSubgroup: bitsSubgroup.browseSubgroup,
      browseSubgroupLabel: bitsSubgroup.browseSubgroupLabel,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('public/author/')) {
    return {
      browseGroup: 'assets',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.assets,
      browseSubgroup: 'avatar',
      browseSubgroupLabel: ADMIN_IMAGE_ASSET_SUBGROUP_LABELS.avatar,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  if (record.path.startsWith('src/assets/')) {
    return {
      browseGroup: 'assets',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.assets,
      browseSubgroup: 'other',
      browseSubgroupLabel: ADMIN_IMAGE_ASSET_SUBGROUP_LABELS.other,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  const matchedPage = ADMIN_IMAGE_PAGE_ALLOWLIST.find((item) => record.path.startsWith(item.prefix));
  if (matchedPage) {
    return {
      browseGroup: 'pages',
      browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.pages,
      browseSubgroup: matchedPage.subgroup,
      browseSubgroupLabel: matchedPage.label,
      preferredValue,
      hiddenFromBrowse: false
    };
  }

  return {
    browseGroup: 'uncategorized',
    browseGroupLabel: ADMIN_IMAGE_BROWSE_GROUP_LABELS.uncategorized,
    browseSubgroup: '',
    browseSubgroupLabel: null,
    preferredValue,
    hiddenFromBrowse: false
  };
};

const toAdminImageBrowseAsset = (asset: AdminImageAssetRecord): AdminImageBrowseAsset | null => {
  const browseMeta = resolveBrowseMeta(asset);
  if (browseMeta.hiddenFromBrowse) return null;
  return {
    ...asset,
    value: asset.path,
    ...browseMeta
  } satisfies AdminImageBrowseAsset;
};

export const listAdminImageBrowseAssets = async (): Promise<AdminImageBrowseAsset[]> => {
  const localAssets = await listAdminImageAssets('');
  const cloudAssets = (await listAdminCloudStorageImages())
    .map((item) => ({
      path: item.url,
      origin: 'cloud' as const,
      fileName: item.fileName,
      owner: null,
      ownerLabel: null,
      cloudMeta: {
        url: item.url,
        size: item.size,
        mimeType: item.mimeType,
        lastModified: item.lastModified
      }
    } satisfies AdminImageAssetRecord));
  const assets = [...localAssets, ...cloudAssets];
  return assets
    .map(toAdminImageBrowseAsset)
    .filter((asset): asset is AdminImageBrowseAsset => asset !== null)
    .sort((left, right) => sortImageAssets(null, left, right));
};

export const withoutCloudBrowseGroupOption = (
  options: readonly AdminImageBrowseFilterOption[]
): AdminImageBrowseFilterOption[] => options.filter((option) => option.value !== 'cloud');

const createAdminImageScopeIndex = async (
  browseAssets: readonly AdminImageBrowseAsset[]
): Promise<AdminImageScopeIndex> => {
  const recent = (
    await Promise.all(
      browseAssets.map(async (asset) => {
        if (asset.origin === 'cloud') {
          const lastModifiedTime = asset.cloudMeta?.lastModified
            ? Date.parse(asset.cloudMeta.lastModified)
            : Number.NaN;
          return Number.isFinite(lastModifiedTime)
            ? {
                path: asset.path,
                mtimeMs: lastModifiedTime
              }
            : null;
        }

        try {
          const fileStat = await stat(toAbsoluteAssetPath(asset.path));
          return {
            path: asset.path,
            mtimeMs: fileStat.mtimeMs
          };
        } catch {
          return null;
        }
      })
    )
  )
    .filter((entry): entry is { path: string; mtimeMs: number } => entry !== null)
    .sort((left, right) => {
      const timeDiff = right.mtimeMs - left.mtimeMs;
      return timeDiff !== 0 ? timeDiff : left.path.localeCompare(right.path);
    })
    .map((entry) => entry.path);

  return {
    recent
  } satisfies AdminImageScopeIndex;
};

export const loadAdminImageScopeIndex = async (
  browseAssets?: readonly AdminImageBrowseAsset[]
): Promise<AdminImageScopeIndex> => {
  const cacheKey = getAdminImageCacheKey('scope-index');

  return withAdminImageShortCache(
    adminImageScopeIndexCache,
    adminImageScopeIndexPendingLoads,
    cacheKey,
    async () => {
      return createAdminImageScopeIndex(browseAssets ?? await listAdminImageBrowseAssets());
    }
  );
};

export const listAdminImageScopeIndex = async (): Promise<AdminImageScopeIndex> =>
  loadAdminImageScopeIndex();
