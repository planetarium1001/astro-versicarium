export function formatISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatISODateUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export type DatePartsInTimeZone = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getDatePartsInTimeZone(date: Date, timeZone: string): DatePartsInTimeZone {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second'))
  };
}

export function formatISODateInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDateTimeInTimeZone(
  date: Date,
  timeZone: string,
  options: { seconds?: boolean } = {}
): string {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const dateText = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const timeText = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  return options.seconds
    ? `${dateText} ${timeText}:${String(parts.second).padStart(2, '0')}`
    : `${dateText} ${timeText}`;
}

export function createWithBase(base: string) {
  const baseNormalized = base.endsWith('/') ? base : `${base}/`;
  const baseWithoutSlash = baseNormalized.replace(/\/+$/, '');
  return (path: string) => {
    if (!path || path === '/') return baseNormalized;
    if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:')) return path;
    // 幂等：内容集合 image() 返回的 ImageMetadata.src 已带部署 base，
    // 不再重复拼前缀（与 markdown-pipeline 的 withDeploymentBase 同语义）。
    if (baseWithoutSlash && (path === baseWithoutSlash || path.startsWith(baseNormalized))) return path;
    const clean = path.startsWith('/') ? path.slice(1) : path;
    return `${baseNormalized}${clean}`;
  };
}

export function toSafeHttpUrl(value: string, base?: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = base ? new URL(trimmed, base) : new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

const HERO_IMAGE_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const BITS_AVATAR_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const hasInvalidLocalImagePathSegment = (value: string): boolean =>
  /(^|\/)\.\.(?:\/|$)/.test(value) || value.includes('?') || value.includes('#');

const toCanonicalHeroAssetPath = (value: string): string | null => {
  if (value.startsWith('@/assets/')) {
    return `src/assets/${value.slice('@/assets/'.length)}`;
  }

  if (value.startsWith('assets/')) {
    return `src/assets/${value.slice('assets/'.length)}`;
  }

  return value.startsWith('src/assets/') ? value : null;
};

export function normalizeHeroImageSrc(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const safeRemoteUrl = toSafeHttpUrl(trimmed);
  if (safeRemoteUrl.startsWith('https://')) return safeRemoteUrl;

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('//') || hasInvalidLocalImagePathSegment(normalized)) {
    return undefined;
  }

  if (normalized.startsWith('/')) {
    return normalized !== '/' && HERO_IMAGE_LOCAL_EXT_RE.test(normalized) ? normalized : undefined;
  }

  if (normalized.startsWith('public/')) {
    const publicPath = `/${normalized.slice('public/'.length)}`;
    return publicPath !== '/' && HERO_IMAGE_LOCAL_EXT_RE.test(publicPath) ? publicPath : undefined;
  }

  const assetPath = toCanonicalHeroAssetPath(normalized);
  return assetPath && HERO_IMAGE_LOCAL_EXT_RE.test(assetPath) ? assetPath : undefined;
}

export function getHeroImageLocalFilePath(value: string): string | null {
  if (value.startsWith('src/assets/')) return value;
  if (value.startsWith('/')) return `public${value}`;
  return null;
}

export function normalizeBitsAvatarPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return '';

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.startsWith('public/') ||
    /^[A-Za-z]+:\/\//.test(normalized) ||
    hasInvalidLocalImagePathSegment(normalized)
  ) {
    return undefined;
  }

  return BITS_AVATAR_LOCAL_EXT_RE.test(normalized) ? normalized : undefined;
}

export function getBitsAvatarLocalFilePath(value: string): string | null {
  if (!value) return null;
  return `public/${value}`;
}

export type SiteFaviconSlot = 'svg' | 'png' | 'appleTouchIcon';
export type SiteFaviconUploadSlot = Exclude<SiteFaviconSlot, 'svg'>;

const SITE_FAVICON_EXT_RE_BY_SLOT: Record<SiteFaviconSlot, RegExp> = {
  svg: /\.svg$/i,
  png: /\.png$/i,
  appleTouchIcon: /\.png$/i
};

export function normalizeSiteFaviconPath(slot: SiteFaviconSlot, value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('//') || /^[A-Za-z]+:/.test(normalized) || hasInvalidLocalImagePathSegment(normalized)) {
    return undefined;
  }

  const publicPath = normalized.startsWith('public/')
    ? `/${normalized.slice('public/'.length)}`
    : normalized.startsWith('/')
      ? normalized
      : undefined;
  if (!publicPath || publicPath === '/') return undefined;

  return SITE_FAVICON_EXT_RE_BY_SLOT[slot].test(publicPath) ? publicPath : undefined;
}

export function getSiteFaviconLocalFilePath(value: string): string {
  return `public${value}`;
}

const SITE_FILING_ICON_EXT_RE = /\.(?:png|jpe?g|webp|svg|gif)$/i;

/** 公安备案图标：允许 https 外链（平台提供的图标地址）或 public 下的相对图片路径 */
export function normalizeSiteFilingIconPath(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' ? parsed.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('//') || /^[A-Za-z]+:/.test(normalized)) return undefined;
  if (hasInvalidLocalImagePathSegment(normalized)) return undefined;

  const publicPath = normalized.startsWith('public/')
    ? `/${normalized.slice('public/'.length)}`
    : normalized.startsWith('/')
      ? normalized
      : `/${normalized}`;
  if (publicPath === '/') return undefined;

  return SITE_FILING_ICON_EXT_RE.test(publicPath) ? publicPath : undefined;
}

export function getSiteFilingIconLocalFilePath(value: string): string {
  return `public${value}`;
}

export function getSiteFaviconSizesFromPath(value: string): string | null {
  const baseName = value.split('/').pop() ?? '';
  const match = baseName.match(/(?:^|[^0-9])(\d{2,4})x(\d{2,4})(?:[^0-9]|$)/);
  return match ? `${match[1]}x${match[2]}` : null;
}

export function tokenizeSearchQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .split(/\s+/)
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function buildSearchHaystack(
  parts: ReadonlyArray<string | readonly string[] | null | undefined>
): string {
  const normalizedParts: string[] = [];

  for (const part of parts) {
    if (Array.isArray(part)) {
      for (const value of part) {
        const normalized = typeof value === 'string' ? value.trim() : '';
        if (normalized) normalizedParts.push(normalized);
      }
      continue;
    }

    const normalized = typeof part === 'string' ? part.trim() : '';
    if (normalized) normalizedParts.push(normalized);
  }

  return normalizedParts.join(' ').toLowerCase();
}

type JsonIndexLoaderOptions<T> = {
  url: string;
  shouldBypassCache?: boolean;
  onPending?: () => void;
  onResolved?: (data: T[]) => void;
  onRejected?: () => void;
};

export function createJsonIndexLoader<T>(options: JsonIndexLoaderOptions<T>) {
  let indexPromise: Promise<T[] | null> | null = null;
  let indexCache: T[] | null = null;
  let indexFailed = false;

  const load = async (): Promise<T[] | null> => {
    if (!options.url) return null;
    if (indexCache) return indexCache;
    if (indexFailed) return null;

    if (!indexPromise) {
      options.onPending?.();
      indexPromise = fetch(options.url, {
        cache: options.shouldBypassCache ? 'no-store' : 'default'
      })
        .then((response) => {
          if (!response.ok) throw new Error('index fetch failed');
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error('index data invalid');
          indexCache = data as T[];
          options.onResolved?.(indexCache);
          return indexCache;
        })
        .catch(() => {
          indexFailed = true;
          options.onRejected?.();
          return null;
        });
    }

    return indexPromise;
  };

  return {
    load,
    getCached: () => indexCache,
    hasFailed: () => indexFailed
  };
}

export function createDebouncedAsyncRunner(
  run: () => void | Promise<void>,
  defaultDelay = 0
) {
  let timer: number | null = null;

  const cancel = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const schedule = (delay = defaultDelay) => {
    cancel();
    timer = window.setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  };

  return {
    schedule,
    cancel
  };
}

export function formatDateTime(d: Date): string {
  const yyyyMmDd = formatISODate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyyMmDd} ${hh}:${mm}`;
}

export function joinPageSubtitleText(...parts: Array<string | null | undefined>): string | null {
  const normalized = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return normalized.length ? normalized.join(' · ') : null;
}
