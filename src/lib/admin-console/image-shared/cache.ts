import { getProjectRoot } from '../../project-root';
import type { AdminImageScopeIndex } from '../image-browse';
import type {
  AdminImageAssetRecord,
  AdminImageContentOwner,
  AdminImageInspectionMeta
} from './types';

type AdminImageShortCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const ADMIN_IMAGE_SHORT_CACHE_TTL_MS = 3_000;
const ADMIN_IMAGE_SHORT_CACHE_MAX_ENTRIES = 32;

export const adminImageOwnerOptionsCache = new Map<string, AdminImageShortCacheEntry<AdminImageContentOwner[]>>();
export const adminImageOwnerOptionsPendingLoads = new Map<string, Promise<AdminImageContentOwner[]>>();
export const adminImageAssetListCache = new Map<string, AdminImageShortCacheEntry<AdminImageAssetRecord[]>>();
export const adminImageAssetListPendingLoads = new Map<string, Promise<AdminImageAssetRecord[]>>();
export const adminImageInspectionMetaCache = new Map<string, AdminImageShortCacheEntry<AdminImageInspectionMeta>>();
export const adminImageInspectionMetaPendingLoads = new Map<string, Promise<AdminImageInspectionMeta>>();
export const adminImageScopeIndexCache = new Map<string, AdminImageShortCacheEntry<AdminImageScopeIndex>>();
export const adminImageScopeIndexPendingLoads = new Map<string, Promise<AdminImageScopeIndex>>();

export const getAdminImageCacheKey = (...parts: string[]): string => `${getProjectRoot()}::${parts.join('::')}`;

const readAdminImageShortCache = <T>(
  cache: Map<string, AdminImageShortCacheEntry<T>>,
  key: string
): T | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const writeAdminImageShortCache = <T>(
  cache: Map<string, AdminImageShortCacheEntry<T>>,
  key: string,
  value: T
): T => {
  cache.set(key, {
    expiresAt: Date.now() + ADMIN_IMAGE_SHORT_CACHE_TTL_MS,
    value
  });
  while (cache.size > ADMIN_IMAGE_SHORT_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    cache.delete(oldestKey);
  }
  return value;
};

export const withAdminImageShortCache = async <T>(
  cache: Map<string, AdminImageShortCacheEntry<T>>,
  pendingLoads: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>
): Promise<T> => {
  const cached = readAdminImageShortCache(cache, key);
  if (cached !== null) return cached;

  const pending = pendingLoads.get(key);
  if (pending) return pending;

  const nextLoad = load()
    .then((value) => writeAdminImageShortCache(cache, key, value))
    .finally(() => {
      pendingLoads.delete(key);
    });
  pendingLoads.set(key, nextLoad);
  return nextLoad;
};

export const invalidateAdminImageCaches = (): void => {
  adminImageOwnerOptionsCache.clear();
  adminImageOwnerOptionsPendingLoads.clear();
  adminImageAssetListCache.clear();
  adminImageAssetListPendingLoads.clear();
  adminImageInspectionMetaCache.clear();
  adminImageInspectionMetaPendingLoads.clear();
  adminImageScopeIndexCache.clear();
  adminImageScopeIndexPendingLoads.clear();
};
