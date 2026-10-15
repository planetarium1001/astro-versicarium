import { slug as githubSlug } from 'github-slugger';

/** 博客公开 URL 的 slug 规则，由 `content.config.ts` 与 `content.ts` 共用。 */

/** 合法的公开 slug：小写 kebab-case，允许 CJK；ASCII 部分必须小写。 */
export const BLOG_PUBLIC_SLUG_RE = /^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u;

/** 与 `/blog/` 下同级静态路由冲突的 slug。博客 slug 始终为单段，只需精确匹配。 */
export const RESERVED_BLOG_SLUGS: ReadonlySet<string> = new Set([
  'page',
  'rss.xml'
]);

/** 把可能多段的 `entry.id` 压成适合 `[slug]` 路由的单段 slug。 */
export const flattenEntryIdToSlug = (entryId: string): string =>
  entryId.replaceAll('/', '-');

/** Astro glob loader 按路径段做 GitHub-style slug 化得到默认公开 entry id。 */
export const contentSourceEntryIdToPublicEntryId = (entryId: string): string => {
  const normalized = entryId.trim().replace(/\\/g, '/').replace(/\/+$/g, '');
  if (!normalized) return '';

  return normalized
    .split('/')
    .map((segment) => githubSlug(segment))
    .join('/')
    .replace(/\/index$/i, '');
};

// 内容 entryId 命名规范：`YYYY-MM-DD-title`

/** slug 部分的最大长度，超出则截断并追加短哈希。 */
export const MAX_ENTRY_ID_SLUG_LENGTH = 120;

/** slug 为空时的兜底（标题可能是纯符号 / emoji）。 */
export const FALLBACK_ENTRY_ID_SLUG = 'untitled';

/** Windows 保留设备名，作为文件名主干会失败。 */
const WINDOWS_RESERVED_BASE_NAMES: ReadonlySet<string> = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)
]);

export const isWindowsReservedFileBaseName = (value: string): boolean =>
  WINDOWS_RESERVED_BASE_NAMES.has(value.trim().toLowerCase());

/** 无依赖的稳定短哈希（djb2）；本模块也会被 Svelte 客户端 import，不能用 `node:crypto`。 */
export const stableShortHash = (input: string, length = 6): string => {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash * 33) ^ input.charCodeAt(index)) >>> 0;
  }
  // 必须取 base36 的末位：32 位值的 base36 最多 7 位，取首位只保留高位，
  // 末位不同的输入会算出同一个短哈希。
  return hash.toString(36).padStart(length, '0').slice(-length);
};

/**
 * 标题 → entryId 的 slug 部分。用 Unicode 属性转义 `\p{L}\p{N}` 而不是 `[a-z0-9]`，否则
 * 中文标题会被整段丢弃。处理顺序：NFKC 归一 → 去首尾空白 → 小写 → 空白/下划线转 `-` →
 * 其余非字母数字连字符转 `-` → 折叠连续 `-` → 去首尾 `-`。
 */
export const slugifyEntryTitle = (input: string): string => {
  const slug = (input ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= MAX_ENTRY_ID_SLUG_LENGTH) return slug;

  const head = slug.slice(0, MAX_ENTRY_ID_SLUG_LENGTH).replace(/-+$/g, '');
  return `${head}-${stableShortHash(slug)}`;
};

const formatUtcDatePart = (date: Date): string => {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * `YYYY-MM-DD-title`：内容 entryId 的唯一构造入口。日期取 UTC 分量。
 * slug 为空 → `untitled`，超长 → 截断 + 短哈希，命中 Windows 保留名 → 追加 `-entry`。
 */
export const buildContentEntryId = (date: Date, title: string): string => {
  const slug = slugifyEntryTitle(title) || FALLBACK_ENTRY_ID_SLUG;
  const entryId = `${formatUtcDatePart(date)}-${slug}`;
  return isWindowsReservedFileBaseName(entryId) ? `${entryId}-entry` : entryId;
};
