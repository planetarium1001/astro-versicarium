import { slug as githubSlug } from 'github-slugger';

/**
 * 博客公开 URL 的 slug 规则。`content.config.ts`（schema 校验）与 `content.ts`（构建期断言）
 * 共用本模块，使「什么是合法公开 slug」只有一处定义。
 */

/**
 * 合法的公开 slug：小写 kebab-case，允许 CJK。未显式设置 `frontmatter.slug` 时公开 slug
 * 由 entryId 派生，若只允许 `[a-z0-9]`，保留中文标题的条目会在构建期抛错；
 * ASCII 部分仍要求小写（`\p{Ll}`），所以 `AbC` 不合法。
 */
export const BLOG_PUBLIC_SLUG_RE = /^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u;

/**
 * 与 `/blog/` 下同级静态路由冲突的 slug。
 * 博客 slug 始终为单段（schema 与 `[slug]` 路由共同保证），因此只需精确匹配。
 */
export const RESERVED_BLOG_SLUGS: ReadonlySet<string> = new Set([
  'page',
  'rss.xml'
]);

/** 把可能多段的 `entry.id`（如 `2024/my-post`）压成适合 `[slug]` 路由的单段 slug。 */
export const flattenEntryIdToSlug = (entryId: string): string =>
  entryId.replaceAll('/', '-');

/**
 * Astro glob loader 会按路径段做 GitHub-style slug 化得到默认公开 entry id。
 * Admin Content 的源文件 entryId 保留真实文件名，因此写入校验需要显式派生公开 id。
 */
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

/** slug 部分的最大长度，超出则截断并追加短哈希（见 `slugifyEntryTitle`）。 */
export const MAX_ENTRY_ID_SLUG_LENGTH = 120;

/** slug 为空时的兜底（标题可能是纯符号 / emoji）。 */
export const FALLBACK_ENTRY_ID_SLUG = 'untitled';

/**
 * Windows 保留设备名，作为文件名主干会失败。
 * `YYYY-MM-DD-title` 带日期前缀实际不会命中，保留判断是为了兜住
 * `slugifyEntryTitle('nul')` 这类直接调用（迁移脚本 / 其它集合）。
 */
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

/**
 * 无依赖的稳定短哈希（djb2）。不能用 `node:crypto`：本模块也会被后台客户端（Svelte）import。
 * 哈希只用于超长标题截断后的可读后缀，不需要抗碰撞。
 */
export const stableShortHash = (input: string, length = 6): string => {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash * 33) ^ input.charCodeAt(index)) >>> 0;
  }
  // 必须取 base36 的末位而不是首位：32 位值的 base36 最多 7 位，取首位等于只保留高位、
  // 丢掉末位差异，于是 'a'×160 与 'a'×159+'b' 会算出同一个短哈希。
  return hash.toString(36).padStart(length, '0').slice(-length);
};

/**
 * 标题 → entryId 的 slug 部分。用 Unicode 属性转义 `\p{L}\p{N}` 而不是 `[a-z0-9]`，
 * 否则中文标题会被整段丢弃。处理顺序：NFKC 归一 → 去首尾空白 → 小写 →
 * 空白/下划线转 `-` → 其余非字母数字连字符转 `-` → 折叠连续 `-` → 去首尾 `-`。
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

  // 超长：截断到上限并追加短哈希，保证不同长标题不会撞成同一个 id
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
 * `YYYY-MM-DD-title`：内容 entryId 的唯一构造入口（创建流程与命名迁移共用）。
 * 日期取 UTC 分量，用本地分量在东八区之外会整体偏移一天；
 * slug 为空 → `untitled`，超长 → 截断 + 短哈希，命中 Windows 保留名 → 追加 `-entry`。
 */
export const buildContentEntryId = (date: Date, title: string): string => {
  const slug = slugifyEntryTitle(title) || FALLBACK_ENTRY_ID_SLUG;
  const entryId = `${formatUtcDatePart(date)}-${slug}`;
  return isWindowsReservedFileBaseName(entryId) ? `${entryId}-entry` : entryId;
};
