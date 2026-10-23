import {
  BLOG_PUBLIC_SLUG_RE,
  RESERVED_BLOG_SLUGS,
  flattenEntryIdToSlug
} from '../utils/slug-rules';

/** 博客 series / version 的纯路由模型：不依赖 astro:content，可被后台与脚本复用。 */

export type BlogRoutingEntryData = {
  title: string;
  date: Date;
  dateText?: string | undefined;
  draft?: boolean | undefined;
  description?: string | undefined;
  series?: string | undefined;
  slug?: string | undefined;
  versionLabel?: string | undefined;
  versionName?: string | undefined;
  versionSummary?: string | undefined;
  versionOrder?: number | undefined;
  publishedAt?: Date | undefined;
  publishedAtText?: string | undefined;
};

export type BlogRoutingEntry = {
  id: string;
  data: BlogRoutingEntryData;
};

export type BlogRouteKind = 'latest-stable' | 'latest-dated' | 'latest-alias' | 'version';

export type BlogVersionItem<TEntry extends BlogRoutingEntry = BlogRoutingEntry> = {
  entry: TEntry;
  entryId: string;
  title: string;
  versionLabel: string;
  versionName: string;
  versionSummary: string | null;
  date: string;
  href: string;
  isLatest: boolean;
  isCurrent: boolean;
};

export type BlogSeriesGroup<TEntry extends BlogRoutingEntry = BlogRoutingEntry> = {
  series: string | null;
  seriesKey: string;
  versions: TEntry[];
  latest: TEntry;
  stableSlug: string | null;
  stablePath: string | null;
  latestDatedPath: string;
  canonicalPath: string;
};

export type BlogRouteInfo<TEntry extends BlogRoutingEntry = BlogRoutingEntry> = {
  entry: TEntry;
  group: BlogSeriesGroup<TEntry>;
  kind: BlogRouteKind;
  path: string;
  slugParam: string;
  canonicalPath: string;
  noindex: boolean;
  isAlias: boolean;
  isLatest: boolean;
  versions: BlogVersionItem<TEntry>[];
  latestHref: string;
};

export type BlogRoutingResult<TEntry extends BlogRoutingEntry = BlogRoutingEntry> = {
  groups: BlogSeriesGroup<TEntry>[];
  routes: BlogRouteInfo<TEntry>[];
  latestEntries: TEntry[];
  routeByPath: Map<string, BlogRouteInfo<TEntry>>;
};

export class BlogRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlogRoutingError';
  }
}

export const getEntryIdSlug = (entry: Pick<BlogRoutingEntry, 'id'>): string =>
  flattenEntryIdToSlug(entry.id);

export const getEntryDatedPath = (entry: Pick<BlogRoutingEntry, 'id'>): string =>
  `/blog/${getEntryIdSlug(entry)}/`;

export const getStablePath = (slug: string): string => `/blog/${slug}/`;

export const getSeriesKey = (entry: Pick<BlogRoutingEntry, 'id' | 'data'>): string => {
  const series = entry.data.series?.trim();
  return series ? `series:${series}` : `single:${entry.id}`;
};

const compareVersions = (left: BlogRoutingEntry, right: BlogRoutingEntry): number => {
  const dateOrder = right.data.date.valueOf() - left.data.date.valueOf();
  if (dateOrder !== 0) return dateOrder;

  const versionOrder =
    (right.data.versionOrder ?? 0) - (left.data.versionOrder ?? 0);
  if (versionOrder !== 0) return versionOrder;

  return left.id.localeCompare(right.id, 'en');
};

export const sortBlogVersions = <TEntry extends BlogRoutingEntry>(
  entries: readonly TEntry[]
): TEntry[] => entries.slice().sort(compareVersions);

const assertValidStableSlug = (slug: string, entryId: string): void => {
  if (!BLOG_PUBLIC_SLUG_RE.test(slug)) {
    throw new BlogRoutingError(
      [
        'Invalid public blog slug detected.',
        `  Entry:       ${entryId}`,
        `  Public slug: ${slug}`,
        '  Reason:      final public slug must be lowercase kebab-case.',
        '  How to fix:  provide a valid frontmatter.slug, or rename files/folders to kebab-case.'
      ].join('\n')
    );
  }

  if (RESERVED_BLOG_SLUGS.has(slug)) {
    throw new BlogRoutingError(
      [
        'blog route slug conflict detected.',
        `  Entry:       ${entryId}`,
        `  Public slug: ${slug}`,
        `  Reason:      "${slug}" is reserved for sibling static routes under /archive/ and /blog/.`,
        '  How to fix:  change frontmatter.slug, or rename the file/path so the final public slug is no longer reserved.'
      ].join('\n')
    );
  }
};

export const buildBlogGroups = <TEntry extends BlogRoutingEntry>(
  entries: readonly TEntry[]
): BlogSeriesGroup<TEntry>[] => {
  const groups = new Map<string, TEntry[]>();

  for (const entry of entries) {
    const key = getSeriesKey(entry);
    const current = groups.get(key);
    if (current) {
      current.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return Array.from(groups.entries())
    .map(([seriesKey, groupEntries]) => {
      const versions = sortBlogVersions(groupEntries);
      const latest = versions[0]!;
      const series = latest.data.series?.trim() || null;

      const nonEmptySlugs = new Set(
        versions
          .map((entry) => entry.data.slug?.trim())
          .filter((slug): slug is string => Boolean(slug))
      );

      if (nonEmptySlugs.size > 1) {
        throw new BlogRoutingError(
          [
            'Series versions must share one public slug.',
            `  Series:      ${series ?? seriesKey}`,
            `  Slugs:       ${Array.from(nonEmptySlugs).join(', ')}`,
            `  Entries:     ${versions.map((entry) => entry.id).join(', ')}`,
            '  How to fix:  use the same frontmatter.slug on every version, or remove the conflicting slug.'
          ].join('\n')
        );
      }

      const sharedSlug = Array.from(nonEmptySlugs)[0] ?? null;
      if (sharedSlug && !latest.data.slug?.trim()) {
        throw new BlogRoutingError(
          [
            'Latest series version is missing the series slug.',
            `  Series:      ${series ?? seriesKey}`,
            `  Latest:      ${latest.id}`,
            `  Expected:    ${sharedSlug}`,
            '  How to fix:  add the same frontmatter.slug to the latest version.'
          ].join('\n')
        );
      }

      const stableSlug = latest.data.slug?.trim() || null;
      if (stableSlug) assertValidStableSlug(stableSlug, latest.id);

      const stablePath = stableSlug ? getStablePath(stableSlug) : null;
      const latestDatedPath = getEntryDatedPath(latest);

      return {
        series,
        seriesKey,
        versions,
        latest,
        stableSlug,
        stablePath,
        latestDatedPath,
        canonicalPath: stablePath ?? latestDatedPath
      } satisfies BlogSeriesGroup<TEntry>;
    })
    .sort((left, right) => compareVersions(left.latest, right.latest));
};

const buildVersions = <TEntry extends BlogRoutingEntry>(
  group: BlogSeriesGroup<TEntry>
): BlogVersionItem<TEntry>[] =>
  group.versions.map((entry) => {
    const isLatest = entry.id === group.latest.id;
    const href = isLatest ? group.canonicalPath : getEntryDatedPath(entry);
    return {
      entry,
      entryId: entry.id,
      title: entry.data.title,
      versionLabel: entry.data.versionLabel?.trim() || '',
      versionName: entry.data.versionName?.trim() || entry.data.title,
      versionSummary: entry.data.versionSummary?.trim() || entry.data.description?.trim() || null,
      date: entry.data.dateText ?? '',
      href,
      isLatest,
      isCurrent: false
    };
  });

export const buildBlogRouting = <TEntry extends BlogRoutingEntry>(
  entries: readonly TEntry[]
): BlogRoutingResult<TEntry> => {
  const groups = buildBlogGroups(entries);
  const routes: BlogRouteInfo<TEntry>[] = [];

  for (const group of groups) {
    const versions = buildVersions(group);

    if (group.stablePath) {
      routes.push({
        entry: group.latest,
        group,
        kind: 'latest-stable',
        path: group.stablePath,
        slugParam: group.stableSlug!,
        canonicalPath: group.stablePath,
        noindex: false,
        isAlias: false,
        isLatest: true,
        versions,
        latestHref: group.canonicalPath
      });

      if (group.series && group.stablePath !== group.latestDatedPath) {
        routes.push({
          entry: group.latest,
          group,
          kind: 'latest-alias',
          path: group.latestDatedPath,
          slugParam: getEntryIdSlug(group.latest),
          canonicalPath: group.stablePath,
          noindex: false,
          isAlias: true,
          isLatest: true,
          versions,
          latestHref: group.canonicalPath
        });
      }
    } else {
      routes.push({
        entry: group.latest,
        group,
        kind: 'latest-dated',
        path: group.latestDatedPath,
        slugParam: getEntryIdSlug(group.latest),
        canonicalPath: group.latestDatedPath,
        noindex: false,
        isAlias: false,
        isLatest: true,
        versions,
        latestHref: group.canonicalPath
      });
    }

    for (const entry of group.versions) {
      if (entry.id === group.latest.id) continue;
      const path = getEntryDatedPath(entry);
      routes.push({
        entry,
        group,
        kind: 'version',
        path,
        slugParam: getEntryIdSlug(entry),
        canonicalPath: group.canonicalPath,
        noindex: true,
        isAlias: false,
        isLatest: false,
        versions,
        latestHref: group.canonicalPath
      });
    }
  }

  const routeByPath = new Map<string, BlogRouteInfo<TEntry>>();
  const pathOwners = new Map<string, string>();

  for (const route of routes) {
    const existingOwner = pathOwners.get(route.path);
    if (existingOwner) {
      throw new BlogRoutingError(
        [
          'Duplicate blog route detected.',
          `  Path:        ${route.path}`,
          `  Entries:     ${existingOwner}, ${route.entry.id}`,
          '  How to fix:  change one frontmatter.slug so the final public route is unique.'
        ].join('\n')
      );
    }
    pathOwners.set(route.path, route.entry.id);
    routeByPath.set(route.path, route);
  }

  return {
    groups,
    routes,
    latestEntries: groups.map((group) => group.latest),
    routeByPath
  };
};

export const getLatestBlogEntries = <TEntry extends BlogRoutingEntry>(
  entries: readonly TEntry[]
): TEntry[] => buildBlogGroups(entries).map((group) => group.latest);

export const getBlogEntryHrefMap = <TEntry extends BlogRoutingEntry>(
  routing: BlogRoutingResult<TEntry>
): Map<string, string> => {
  const hrefByEntryId = new Map<string, string>();
  for (const group of routing.groups) {
    for (const entry of group.versions) {
      hrefByEntryId.set(
        entry.id,
        entry.id === group.latest.id ? group.canonicalPath : getEntryDatedPath(entry)
      );
    }
  }
  return hrefByEntryId;
};

export const getBlogVersionInfo = <TEntry extends BlogRoutingEntry>(
  routing: BlogRoutingResult<TEntry>,
  entry: TEntry
): { isLatest: boolean; versionLabel: string; latestHref: string; series: string | null } => {
  const group = routing.groups.find((candidate) =>
    candidate.versions.some((version) => version.id === entry.id)
  );
  if (!group) {
    return {
      isLatest: true,
      versionLabel: entry.data.versionLabel?.trim() || '',
      latestHref: getEntryDatedPath(entry),
      series: null
    };
  }
  return {
    isLatest: group.latest.id === entry.id,
    versionLabel: entry.data.versionLabel?.trim() || '',
    latestHref: group.canonicalPath,
    series: group.series
  };
};

const withDatePrefix = (slug: string, dateText: string): string =>
  slug.startsWith(`${dateText}-`) ? slug : `${dateText}-${slug}`;

/** 生成候选：date-slug → -1 → -2；已占用集合由调用方提供。 */
export const suggestAvailableBlogSlug = ({
  slug,
  dateText,
  usedSlugs
}: {
  slug: string;
  dateText: string;
  usedSlugs: ReadonlySet<string>;
}): string => {
  const base = withDatePrefix(slug, dateText);
  if (!usedSlugs.has(base)) return base;

  for (let index = 1; index <= 9999; index += 1) {
    const candidate = `${base}-${index}`;
    if (!usedSlugs.has(candidate)) return candidate;
  }

  throw new BlogRoutingError(`无法为 slug "${slug}" 生成可用候选`);
};
