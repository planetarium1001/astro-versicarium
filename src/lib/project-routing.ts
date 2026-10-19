import { BLOG_PUBLIC_SLUG_RE, flattenEntryIdToSlug } from '../utils/slug-rules';

/**
 * projects 的纯路由模型：不依赖 astro:content，可被项目页、归档、后台与测试复用。
 * 同一项目的多个版本文档共享一个非日期形式的 `slug`；没有可用 slug 的条目按单版本处理，
 * 锚点直接使用 entry.id 压平后的 `YYYY-MM-DD-title`，不生成额外别名。
 */

export type ProjectLegacyVersion = {
  label: string;
  name?: string | undefined;
  /** 内容 schema 里 legacy `versions[].date` 是 unknown；路由只消费 dateText。 */
  date?: unknown;
  dateText?: string | undefined;
  summary?: string | undefined;
  order?: number | undefined;
};

export type ProjectEntryData = {
  title: string;
  subtitle?: string | undefined;
  description?: string | undefined;
  slug?: string | undefined;
  date: Date;
  dateText?: string | undefined;
  versionLabel?: string | undefined;
  versionName?: string | undefined;
  versionSummary?: string | undefined;
  versionOrder?: number | undefined;
  versions?: readonly ProjectLegacyVersion[] | undefined;
};

export type ProjectEntryLike = {
  id: string;
  data: ProjectEntryData;
};

export type ProjectVersionItem<TEntry extends ProjectEntryLike = ProjectEntryLike> = {
  entry: TEntry;
  entryId: string;
  title: string;
  /** 最新版为稳定 slug（或 dated id），历史版为 entry.id 压平后的 dated id。 */
  anchor: string;
  /** `/projects/#<anchor>`；legacy 元数据版本没有可打开的弹窗，为空串。 */
  href: string;
  versionLabel: string;
  versionName: string;
  versionSummary: string | null;
  date: string;
  isLatest: boolean;
  isCurrent: boolean;
  /** false = 仅 `versions[]` 元数据历史，不生成弹窗。 */
  hasDocument: boolean;
};

export type ProjectGroup<TEntry extends ProjectEntryLike = ProjectEntryLike> = {
  key: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  versions: ProjectVersionItem<TEntry>[];
  latest: ProjectVersionItem<TEntry>;
  latestAnchor: string;
};

export type ProjectAnchorAlias = {
  entryId: string;
  anchor: string;
};

export type ProjectAnchorResolution<TEntry extends ProjectEntryLike = ProjectEntryLike> = {
  group: ProjectGroup<TEntry>;
  version: ProjectVersionItem<TEntry>;
};

export type ProjectDevlogLike = {
  id: string;
  data: {
    title?: string | undefined;
    project?: string | undefined;
    projectSlug?: string | undefined;
    date?: Date | undefined;
    dateText?: string | undefined;
  };
};

export type ProjectDevlogUpdate = {
  /** devlog 条目的公开锚点，与 /devlog/ 页面一致。 */
  id: string;
  entryId: string;
  title: string;
  date: Date | null;
  dateText: string;
  href: string;
};

export type ProjectResolver = {
  groups: readonly ProjectGroup[];
  /** 按项目稳定 slug、任一版本 entry.id 或版本锚点解析。 */
  resolveProjectKey: (key: string) => ProjectGroup | null;
  /** devlog 关联解析：projectSlug 优先，未命中时按项目显示名做唯一匹配。 */
  resolveProjectForDevlog: (devlog: ProjectDevlogLike) => ProjectGroup | null;
};

export type BuildProjectGroupsOptions = {
  /** 构建期告警出口，默认 console.warn；测试可注入以断言。 */
  warn?: (message: string) => void;
};

export type BuildProjectResolverOptions = {
  warn?: (message: string) => void;
};

export class ProjectRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectRoutingError';
  }
}

const DATE_FORM_PROJECT_SLUG_RE = /^\d{4}-\d{2}-\d{2}-/;

/** slug 形如 `YYYY-MM-DD-title` 时视为日期形式，不作为项目稳定键。 */
export const isDateFormProjectSlug = (slug: string): boolean =>
  DATE_FORM_PROJECT_SLUG_RE.test(slug.trim());

/** 版本文档自身的 dated 锚点：`entry.id` 压平成单段。 */
export const getProjectDatedAnchor = (entry: Pick<ProjectEntryLike, 'id'>): string =>
  flattenEntryIdToSlug(entry.id);

/**
 * 可用于分组的稳定 slug：必须非空且不是日期形式。
 * 目录名与 slug 相同（例如 `content/projects/<slug>/`）时仍是有效稳定键；
 * 只有 slug 本身写成 `YYYY-MM-DD-title` 才按单版本处理。
 */
export const getProjectStableSlug = (entry: ProjectEntryLike): string | null => {
  const slug = entry.data.slug?.trim();
  if (!slug) return null;
  if (isDateFormProjectSlug(slug)) return null;
  return slug;
};

/** 最新版锚点：稳定 slug 优先，否则回退到 dated id（与 slug 相同时天然只有一个）。 */
export const getProjectLatestAnchor = (entry: ProjectEntryLike): string =>
  getProjectStableSlug(entry) ?? getProjectDatedAnchor(entry);

export const getProjectGroupKey = (entry: ProjectEntryLike): string => {
  const slug = getProjectStableSlug(entry);
  return slug ? `slug:${slug}` : `single:${entry.id}`;
};

/** 保持与现有 `/projects/#<anchor>` 未编码风格一致，兼容 CJK。 */
export const getProjectHref = (anchor: string): string => `/projects/#${anchor}`;

const compareProjectEntries = (left: ProjectEntryLike, right: ProjectEntryLike): number => {
  const dateOrder = right.data.date.valueOf() - left.data.date.valueOf();
  if (dateOrder !== 0) return dateOrder;

  const versionOrder = (right.data.versionOrder ?? 0) - (left.data.versionOrder ?? 0);
  if (versionOrder !== 0) return versionOrder;

  return left.id.localeCompare(right.id, 'en');
};

/** date DESC → versionOrder DESC → entryId ASC。 */
export const sortProjectVersions = <TEntry extends ProjectEntryLike>(
  entries: readonly TEntry[]
): TEntry[] => entries.slice().sort(compareProjectEntries);

const assertValidProjectSlug = (slug: string, entryIds: readonly string[]): void => {
  if (BLOG_PUBLIC_SLUG_RE.test(slug)) return;
  throw new ProjectRoutingError(
    [
      'Invalid project slug detected.',
      `  Slug:        ${slug}`,
      `  Entries:     ${entryIds.join(', ')}`,
      '  Reason:      project frontmatter.slug must be lowercase kebab-case（允许 CJK）。',
      '  How to fix:  update frontmatter.slug on every version document of this project.'
    ].join('\n')
  );
};

const warnDuplicateVersionOrder = (
  documents: readonly ProjectEntryLike[],
  warn: (message: string) => void
): void => {
  if (documents.length < 2) return;

  const idsByOrder = new Map<number, string[]>();
  for (const entry of documents) {
    const order = entry.data.versionOrder;
    if (order === undefined) continue;
    const ids = idsByOrder.get(order) ?? [];
    ids.push(entry.id);
    idsByOrder.set(order, ids);
  }

  for (const [order, entryIds] of idsByOrder) {
    if (entryIds.length < 2) continue;
    warn(
      [
        '[astro-whono] duplicate project versionOrder detected.',
        `  versionOrder: ${order}`,
        `  Entries:      ${entryIds.join(', ')}`,
        '  How to fix:  give each version document a unique versionOrder for stable ordering.'
      ].join('\n')
    );
  }
};

const buildDocumentVersionItems = <TEntry extends ProjectEntryLike>(
  documents: readonly TEntry[],
  latest: TEntry,
  latestAnchor: string
): ProjectVersionItem<TEntry>[] =>
  documents.map((entry) => {
    const isLatest = entry.id === latest.id;
    const anchor = isLatest ? latestAnchor : getProjectDatedAnchor(entry);
    return {
      entry,
      entryId: entry.id,
      title: entry.data.title,
      anchor,
      href: getProjectHref(anchor),
      versionLabel: entry.data.versionLabel?.trim() || '',
      versionName: entry.data.versionName?.trim() || entry.data.title,
      versionSummary: entry.data.versionSummary?.trim() || entry.data.description?.trim() || null,
      date: entry.data.dateText ?? '',
      isLatest,
      isCurrent: false,
      hasDocument: true
    };
  });

/**
 * 合并旧的内联 `versions[]`：只作为历史元数据展示，锚点为空、不可点击。
 * 去重键为 `label|dateText`，与已有版本文档同键时以文档为准。
 */
const buildLegacyVersionItems = <TEntry extends ProjectEntryLike>(
  documents: readonly TEntry[],
  latest: TEntry,
  documentItems: readonly ProjectVersionItem<TEntry>[]
): ProjectVersionItem<TEntry>[] => {
  const documentKeys = new Set(documentItems.map((item) => `${item.versionLabel}|${item.date}`));
  const legacyKeys = new Set<string>();
  const legacyVersions: Array<{
    label: string;
    name: string | null;
    dateText: string;
    summary: string | null;
    order: number;
  }> = [];

  for (const entry of documents) {
    for (const version of entry.data.versions ?? []) {
      const label = version.label.trim();
      if (!label) continue;
      const dateText = version.dateText?.trim() ?? '';
      const key = `${label}|${dateText}`;
      if (documentKeys.has(key) || legacyKeys.has(key)) continue;
      legacyKeys.add(key);
      legacyVersions.push({
        label,
        name: version.name?.trim() || null,
        dateText,
        summary: version.summary?.trim() || null,
        order: version.order ?? 0
      });
    }
  }

  legacyVersions.sort(
    (left, right) =>
      right.dateText.localeCompare(left.dateText, 'en') ||
      right.order - left.order ||
      left.label.localeCompare(right.label, 'en')
  );

  return legacyVersions.map((version) => ({
    entry: latest,
    entryId: '',
    title: latest.data.title,
    anchor: '',
    href: '',
    versionLabel: version.label,
    versionName: version.name ?? latest.data.title,
    versionSummary: version.summary,
    date: version.dateText,
    isLatest: false,
    isCurrent: false,
    hasDocument: false
  }));
};

const assertNoProjectAnchorConflicts = (groups: readonly ProjectGroup[]): void => {
  const owners = new Map<string, ProjectAnchorResolution>();

  for (const group of groups) {
    for (const version of group.versions) {
      if (!version.hasDocument || !version.anchor) continue;
      const existing = owners.get(version.anchor);
      if (existing) {
        throw new ProjectRoutingError(
          [
            'Project anchor conflict detected.',
            `  Anchor:      ${version.anchor}`,
            `  Versions:    ${existing.version.entryId}, ${version.entryId}`,
            `  Projects:    ${existing.group.title}, ${group.title}`,
            '  Reason:      /projects/ resolves #<anchor> to exactly one project version.',
            '  How to fix:  use a unique non-date frontmatter.slug for each project,',
            '                or rename the entry folder so its flattened id differs.'
          ].join('\n')
        );
      }
      owners.set(version.anchor, { group, version });
    }
  }
};

export const buildProjectGroups = <TEntry extends ProjectEntryLike>(
  entries: readonly TEntry[],
  options: BuildProjectGroupsOptions = {}
): ProjectGroup<TEntry>[] => {
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const entriesByKey = new Map<string, TEntry[]>();

  for (const entry of entries) {
    const key = getProjectGroupKey(entry);
    const bucket = entriesByKey.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      entriesByKey.set(key, [entry]);
    }
  }

  const groups = Array.from(entriesByKey.values()).map((groupEntries) => {
    const documents = sortProjectVersions(groupEntries);
    const latest = documents[0]!;
    const stableSlug = getProjectStableSlug(latest);

    if (stableSlug) {
      assertValidProjectSlug(stableSlug, documents.map((entry) => entry.id));
    }

    warnDuplicateVersionOrder(documents, warn);

    const latestAnchor = stableSlug ?? getProjectDatedAnchor(latest);
    const documentItems = buildDocumentVersionItems(documents, latest, latestAnchor);
    const versions = [...documentItems, ...buildLegacyVersionItems(documents, latest, documentItems)];

    return {
      key: stableSlug ?? latest.id,
      slug: stableSlug,
      title: latest.data.title,
      subtitle: latest.data.subtitle?.trim() || null,
      versions,
      latest: documentItems[0]!,
      latestAnchor
    } satisfies ProjectGroup<TEntry>;
  });

  groups.sort((left, right) => compareProjectEntries(left.latest.entry, right.latest.entry));
  assertNoProjectAnchorConflicts(groups);
  return groups;
};

/** 深链解析：先精确匹配版本锚点，再回退到旧 entry.id，最后匹配最新版 slug。 */
export const resolveProjectAnchor = <TEntry extends ProjectEntryLike>(
  groups: readonly ProjectGroup<TEntry>[],
  anchor: string
): ProjectAnchorResolution<TEntry> | null => {
  const target = anchor.trim();
  if (!target) return null;

  for (const group of groups) {
    const version = group.versions.find((item) => item.hasDocument && item.anchor === target);
    if (version) return { group, version };
  }

  for (const group of groups) {
    const version = group.versions.find((item) => item.hasDocument && item.entryId === target);
    if (version) return { group, version };
  }

  for (const group of groups) {
    if (group.latestAnchor === target) {
      return { group, version: group.latest };
    }
  }

  return null;
};

/**
 * 旧 `/projects/#<entry.id>` 深链别名：只登记与锚点不同的 entry.id，
 * 无 slug / 日期形式 slug 的单版本项目不产生别名。
 */
export const getProjectAnchorAliases = <TEntry extends ProjectEntryLike>(
  group: ProjectGroup<TEntry>
): ProjectAnchorAlias[] =>
  group.versions
    .filter(
      (version) =>
        version.hasDocument && version.anchor.length > 0 && version.entryId !== version.anchor
    )
    .map((version) => ({ entryId: version.entryId, anchor: version.anchor }));

/**
 * 解析器覆盖：稳定 slug、任一版本文档的 entry.id、版本锚点。
 * 未命中的非空 `projectSlug` 只告警一次；显示名回退仅在唯一匹配时生效。
 */
export const buildProjectResolver = <TEntry extends ProjectEntryLike>(
  groups: readonly ProjectGroup<TEntry>[],
  options: BuildProjectResolverOptions = {}
): ProjectResolver => {
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const byAnchor = new Map<string, ProjectGroup<TEntry>>();
  const byEntryId = new Map<string, ProjectGroup<TEntry>>();
  const byTitle = new Map<string, ProjectGroup<TEntry>[]>();

  for (const group of groups) {
    for (const version of group.versions) {
      if (!version.hasDocument) continue;
      byAnchor.set(version.anchor, group);
      byEntryId.set(version.entryId, group);
    }

    const title = group.title.trim();
    if (!title) continue;
    const candidates = byTitle.get(title);
    if (candidates) {
      candidates.push(group);
    } else {
      byTitle.set(title, [group]);
    }
  }

  const resolveProjectKey = (key: string): ProjectGroup<TEntry> | null => {
    const value = key.trim();
    if (!value) return null;
    return byAnchor.get(value) ?? byEntryId.get(value) ?? null;
  };

  const warnedProjectSlugs = new Set<string>();

  const resolveProjectForDevlog = (devlog: ProjectDevlogLike): ProjectGroup<TEntry> | null => {
    const projectSlug = devlog.data.projectSlug?.trim() ?? '';
    if (projectSlug) {
      const resolved = resolveProjectKey(projectSlug);
      if (resolved) return resolved;
      if (!warnedProjectSlugs.has(projectSlug)) {
        warnedProjectSlugs.add(projectSlug);
        warn(
          [
            `[astro-whono] devlog "${devlog.id}" projectSlug "${projectSlug}" does not match any project.`,
            '  projectSlug should be the project stable frontmatter.slug, or a legacy projects entry id.',
            '  How to fix:  add/fix frontmatter.slug on the project versions, update the devlog projectSlug, or clear it so the display name fallback applies.'
          ].join('\n')
        );
      }
    }

    const project = devlog.data.project?.trim() ?? '';
    if (!project) return null;
    const candidates = byTitle.get(project) ?? [];
    return candidates.length === 1 ? candidates[0]! : null;
  };

  return { groups, resolveProjectKey, resolveProjectForDevlog };
};

/** 按解析后的项目分组聚合 devlog，日期倒序、同日期按 id 升序；未解析的不进入任何组。 */
export const collectProjectDevlogUpdates = (
  resolver: ProjectResolver,
  devlogs: readonly ProjectDevlogLike[]
): Map<string, ProjectDevlogUpdate[]> => {
  const updatesByGroupKey = new Map<string, ProjectDevlogUpdate[]>();

  for (const devlog of devlogs) {
    const group = resolver.resolveProjectForDevlog(devlog);
    if (!group) continue;

    const id = flattenEntryIdToSlug(devlog.id);
    const updates = updatesByGroupKey.get(group.key) ?? [];
    updates.push({
      id,
      entryId: devlog.id,
      title: devlog.data.title?.trim() || devlog.id,
      date: devlog.data.date ?? null,
      dateText: devlog.data.dateText?.trim() ?? '',
      href: `/devlog/#${id}`
    });
    updatesByGroupKey.set(group.key, updates);
  }

  for (const updates of updatesByGroupKey.values()) {
    updates.sort((left, right) => {
      const leftTime = left.date?.valueOf() ?? 0;
      const rightTime = right.date?.valueOf() ?? 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      return left.id.localeCompare(right.id, 'en');
    });
  }

  return updatesByGroupKey;
};
