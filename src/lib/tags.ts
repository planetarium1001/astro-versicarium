type TagContainer = {
  id?: string;
  data?: {
    tags?: string[] | null | undefined;
  } | null;
};

export type TagSummary = {
  key: string;
  label: string;
  count: number;
};

type TagScope = 'archive';

/** 归档页一级胶囊的作用域。 */
type ArchiveScopeId = 'all' | 'blog' | 'projects' | 'devlog';

const SPACE_RE = /\s+/g;
const TAG_KEY_RE = /[\s/\\?#%]+/g;
const TRIM_DASH_RE = /^-+|-+$/g;
const NON_ROUTABLE_TAG_KEY_RE = /[\s/\\?#%]/;
const TAG_LABEL_COLLATOR = new Intl.Collator('zh-CN', {
  sensitivity: 'variant',
  numeric: true
});

const compareTagLabel = (a: string, b: string) => TAG_LABEL_COLLATOR.compare(a, b);

const pickPreferredTagLabel = (current: string, candidate: string) =>
  compareTagLabel(candidate, current) < 0 ? candidate : current;

export function normalizeTagLabel(raw: string): string {
  return raw.normalize('NFKC').replace(SPACE_RE, ' ').trim();
}

export function toTagKey(label: string): string {
  return normalizeTagLabel(label).toLowerCase().replace(TAG_KEY_RE, '-').replace(TRIM_DASH_RE, '');
}

export function isRoutableTagKey(key: string): boolean {
  return key.length > 0 && key !== '.' && key !== '..' && !NON_ROUTABLE_TAG_KEY_RE.test(key);
}

const assertRoutableTagKey = (entryId: string | undefined, label: string, key: string): void => {
  if (isRoutableTagKey(key)) return;

  throw new Error(
    [
      'Invalid archive tag key detected.',
      `  Entry:       ${entryId ?? '(unknown entry)'}`,
      `  Tag label:   ${JSON.stringify(label)}`,
      `  Route key:   ${key ? JSON.stringify(key) : '(empty)'}`,
      '  Reason:      archive tag keys must normalize to one routable segment and cannot be "." or "..".',
      '  How to fix:  rename the tag so it does not collapse to an empty / reserved / non-routable route segment.'
    ].join('\n')
  );
};

export function getTagKeys(tags: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(tags) || tags.length === 0) return [];

  const keys: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const normalized = normalizeTagLabel(raw);
    if (!normalized) continue;

    const key = toTagKey(normalized);
    if (!isRoutableTagKey(key) || seen.has(key)) continue;

    keys.push(key);
    seen.add(key);
  }
  return keys;
}

export function collectTagSummary<T extends TagContainer>(entries: readonly T[]): TagSummary[] {
  const map = new Map<string, TagSummary>();

  for (const entry of entries) {
    const tags = Array.isArray(entry.data?.tags) ? entry.data?.tags : [];
    const entryLabels = new Map<string, string>();

    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const label = normalizeTagLabel(raw);
      if (!label) continue;

      const key = toTagKey(label);
      assertRoutableTagKey(entry.id, label, key);
      const entryLabel = entryLabels.get(key);
      entryLabels.set(key, entryLabel ? pickPreferredTagLabel(entryLabel, label) : label);
    }

    for (const [key, label] of entryLabels) {
      const current = map.get(key);
      if (current) {
        current.count += 1;
        current.label = pickPreferredTagLabel(current.label, label);
        continue;
      }

      map.set(key, {
        key,
        label,
        count: 1
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return compareTagLabel(a.label, b.label);
  });
}

/**
 * 归档页的 tag dialog 作用域跟随一级胶囊：用自定义取标签函数收集某一集合的标签摘要，
 * 避免为 devlog 造一个假的标签字段。`_scope` 当前不参与计算。
 */
export function collectTagScopedSummary<T extends { id?: string }>(
  _scope: ArchiveScopeId,
  entries: readonly T[],
  getTags: (entry: T) => readonly string[] | null | undefined
): TagSummary[] {
  const containers: TagContainer[] = entries.map((entry) => ({
    ...(entry.id === undefined ? {} : { id: entry.id }),
    data: { tags: [...(getTags(entry) ?? [])] }
  }));
  return collectTagSummary(containers);
}

const hasTagKey = (tags: readonly string[] | null | undefined, key: string): boolean => {
  if (!isRoutableTagKey(key)) return false;
  return getTagKeys(tags).includes(key);
};

export function filterEntriesByTag<T extends TagContainer>(entries: readonly T[], key: string): T[] {
  if (!isRoutableTagKey(key)) return [];
  return entries.filter((entry) => hasTagKey(entry.data?.tags, key));
}

export function findTagSummary(tagSummaries: readonly TagSummary[], rawKey: string): TagSummary | null {
  const key = toTagKey(rawKey);
  if (!isRoutableTagKey(key)) return null;
  return tagSummaries.find((tagSummary) => tagSummary.key === key) ?? null;
}

/** 静态标签页已删除，筛选完全在客户端完成，因此不生成标签路由，只回到列表页入口。 */
export function getTagPath(scope: TagScope, _rawKey?: string, _page = 1): string {
  return `/${scope}/`;
}
