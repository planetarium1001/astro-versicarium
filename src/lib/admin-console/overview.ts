import {
  getBitSlug,
  getBitsDerivedText,
  getSortedBits,
  type BitsEntry
} from '../bits';
import { getPublished as getPublishedCollection } from '../content';
import { buildPublishedBitsHrefMap, type BitPublicOrderItem } from '../bits-public-routing';
import {
  getBlogDerivedText,
  getBlogSlug,
  getSortedblogs,
  isVisibleBlogEntry,
  type BlogEntry
} from '../content';
import { collectTagSummary, getTagPath } from '../tags';
import { compareByNullableDateDesc } from './content-shared';
import { formatDateTime, formatISODate, formatISODateUtc } from '../../utils/format';
import { cleanMarkdownToText } from '../../utils/excerpt';
import packageJson from '../../../package.json';

type AdminOverviewCollectionKey = 'blog' | 'projects' | 'bits' | 'devlog';

type AdminOverviewDataOptions = {
  includeMaintainer: boolean;
  includeDraftInRecent: boolean;
  isDev?: boolean;
  now?: Date;
  env?: Record<string, string | undefined>;
};

type AdminOverviewSourceOptions = Pick<AdminOverviewDataOptions, 'includeMaintainer'>;

type AdminOverviewSource = {
  public: AdminOverviewPublicSource;
  maintainer: AdminOverviewMaintainerSource | null;
};

/** projects / devlog 只需要「标题 + 日期 + 锚点」，用最小结构承载，避免耦合完整集合类型。 */
type AdminOverviewListEntry = {
  id: string;
  data: {
    title: string;
    date: Date;
    draft?: boolean;
  };
  /** 可选正文，供字数统计使用；未加载正文时缺省。 */
  bodyText?: string;
};

export type AdminOverviewPublicSource = {
  blogs: BlogEntry[];
  archiveblogs: BlogEntry[];
  projects: AdminOverviewListEntry[];
  bits: BitsEntry[];
  devlogs: AdminOverviewListEntry[];
  bitsHrefById: Map<string, string>;
};

export type AdminOverviewMaintainerSource = {
  blogs: BlogEntry[];
  projects: AdminOverviewListEntry[];
  bits: BitsEntry[];
  devlogs: AdminOverviewListEntry[];
};

type AdminOverviewStats = {
  publishedCount: number;
  tagCount: number;
  wordCount: number;
  lastUpdate: {
    date: Date;
    dateLabel: string;
  } | null;
};

type AdminOverviewCollectionShare = {
  key: AdminOverviewCollectionKey;
  label: string;
  detail: string;
  count: number;
  percentage: number;
  percentageLabel: string;
};

type AdminOverviewTagSummary = {
  key: string;
  label: string;
  count: number;
  href: string;
};

type AdminOverviewActivityDay = {
  date: string;
  dateLabel: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

type AdminOverviewRecentPublication = {
  collection: AdminOverviewCollectionKey;
  collectionLabel: string;
  title: string;
  href: string | null;
  isDraft: boolean;
  date: Date | null;
  dateLabel: string;
  shortDateLabel: string;
};

type AdminOverviewSystemStatusItemKey =
  | 'runtime'
  | 'hostTarget'
  | 'engine'
  | 'lastBuild';

type AdminOverviewSystemStatusItem = {
  key: AdminOverviewSystemStatusItemKey;
  label: string;
  value: string;
  dateTime?: string;
};

type AdminOverviewSystemStatus = {
  statusLabel: string;
  items: AdminOverviewSystemStatusItem[];
  activity: AdminOverviewActivityDay[];
};

type AdminOverviewPublicSummary = {
  stats: AdminOverviewStats;
  collections: AdminOverviewCollectionShare[];
  topTags: AdminOverviewTagSummary[];
  writingActivity: AdminOverviewActivityDay[];
  recentPublications: AdminOverviewRecentPublication[];
};

type AdminOverviewPublicSummaryOptions = Pick<AdminOverviewDataOptions, 'now'>;

type AdminOverviewCollectionDraftSummary = {
  key: AdminOverviewCollectionKey;
  label: string;
  draftCount: number;
  totalCount: number;
};

type AdminOverviewMaintainerSummary = {
  draftCount: number;
  collectionDrafts: AdminOverviewCollectionDraftSummary[];
  recentDraftCount: number;
  recentPublications: AdminOverviewRecentPublication[];
};

export type AdminOverviewData = AdminOverviewPublicSummary & {
  systemStatus: AdminOverviewSystemStatus;
  maintainerSummary: AdminOverviewMaintainerSummary | null;
};

type RecentSource = {
  blogs: BlogEntry[];
  projects: AdminOverviewListEntry[];
  bits: BitsEntry[];
  devlogs: AdminOverviewListEntry[];
  bitsHrefById: ReadonlyMap<string, string>;
};

const COLLECTION_LABELS: Record<AdminOverviewCollectionKey, string> = {
  blog: '博客',
  projects: '项目',
  bits: '动态',
  devlog: '更新'
};

const COLLECTION_DETAILS: Record<AdminOverviewCollectionKey, string> = {
  blog: '文章',
  projects: '项目',
  bits: '动态',
  devlog: '更新'
};

const RECENT_LIMIT = 6;
const TOP_TAG_LIMIT = 6;
const ACTIVITY_DAY_COUNT = 90;
const SYSTEM_STATUS_ACTIVITY_DAY_COUNT = 14;
const WORD_COUNT_COMPACT_THRESHOLD = 100_000;
const WORD_COUNT_COMPACT_UNIT = 10_000;
const WORD_TOKEN_REGEX =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[A-Za-z0-9]+/gu;
const ASTRO_VERSION = String(packageJson.dependencies?.astro ?? 'unknown').replace(/^[~^]/, '');

const DEPLOY_TARGET_LABELS = {
  'cloudflare-pages': 'Cloudflare Pages',
  vercel: 'Vercel',
  'github-pages': 'GitHub Pages',
  'static-host': 'Static Host'
} as const;

type AdminOverviewDeployTarget = keyof typeof DEPLOY_TARGET_LABELS;

const DEPLOY_TARGET_ALIASES = new Map<string, AdminOverviewDeployTarget>([
  ['cf', 'cloudflare-pages'],
  ['cloudflare', 'cloudflare-pages'],
  ['cloudflare-pages', 'cloudflare-pages'],
  ['vercel', 'vercel'],
  ['gh-pages', 'github-pages'],
  ['github', 'github-pages'],
  ['github-pages', 'github-pages'],
  ['static', 'static-host'],
  ['static-host', 'static-host']
]);

const formatCompactDate = (date: Date) => formatISODate(date).replace(/-/g, '.');
const formatCompactDateUtc = (date: Date) => formatISODateUtc(date).replace(/-/g, '.');

const formatShortDate = (date: Date | null, useUtc = false): string => {
  if (!date) return '--.--';
  const source = useUtc ? formatISODateUtc(date) : formatISODate(date);
  return source.slice(5).replace('-', '.');
};

const orderByEntryDateDesc = <Entry extends { data: { date: Date } }>(a: Entry, b: Entry): number =>
  b.data.date.valueOf() - a.data.date.valueOf();

const getCollectionDraftCount = (
  entries: readonly (BlogEntry | BitsEntry | AdminOverviewListEntry)[]
): number => entries.filter((entry) => entry.data.draft === true).length;

const filterPublishedEntries = <Entry extends { data: { draft?: boolean } }>(
  entries: readonly Entry[]
): Entry[] => entries.filter((entry) => entry.data.draft !== true);

const getPercentage = (count: number, total: number): number => {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count / total) * 100);
};

export const buildAdminOverviewBitsHrefById = (bits: readonly BitsEntry[]): Map<string, string> =>
  buildPublishedBitsHrefMap(
    bits.map((entry): BitPublicOrderItem => ({
      id: entry.id,
      date: entry.data.date,
      draft: entry.data.draft === true
    }))
  );

const getRecentBlogPublication = (entry: BlogEntry): AdminOverviewRecentPublication => {
  const isDraft = entry.data.draft === true;
  return {
    collection: 'blog',
    collectionLabel: COLLECTION_LABELS.blog,
    title: entry.data.title,
    href: isDraft ? null : `/blog/${getBlogSlug(entry)}/`,
    isDraft,
    date: entry.data.date,
    dateLabel: formatCompactDateUtc(entry.data.date),
    shortDateLabel: formatShortDate(entry.data.date, true)
  };
};

const getRecentBitsPublication = (
  entry: BitsEntry,
  bitsHrefById: ReadonlyMap<string, string>
): AdminOverviewRecentPublication => {
  const isDraft = entry.data.draft === true;
  const title = entry.data.title?.trim()
    || entry.data.description?.trim()
    || (isDraft ? 'Untitled bit' : getBitSlug(entry));

  return {
    collection: 'bits',
    collectionLabel: COLLECTION_LABELS.bits,
    title,
    href: isDraft ? null : bitsHrefById.get(entry.id) ?? null,
    isDraft,
    date: entry.data.date,
    dateLabel: formatDateTime(entry.data.date),
    shortDateLabel: formatShortDate(entry.data.date)
  };
};

const getRecentAnchorPublication = (
  entry: AdminOverviewListEntry,
  collection: 'projects' | 'devlog'
): AdminOverviewRecentPublication => {
  const isDraft = entry.data.draft === true;
  return {
    collection,
    collectionLabel: COLLECTION_LABELS[collection],
    title: entry.data.title,
    href: isDraft ? null : `/${collection}/#${entry.id}`,
    isDraft,
    date: entry.data.date,
    dateLabel: formatCompactDate(entry.data.date),
    shortDateLabel: formatShortDate(entry.data.date)
  };
};

const buildRecentPublications = (source: RecentSource): AdminOverviewRecentPublication[] =>
  [
    ...source.blogs.map((entry) => getRecentBlogPublication(entry)),
    ...source.projects.map((entry) => getRecentAnchorPublication(entry, 'projects')),
    ...source.bits.map((entry) => getRecentBitsPublication(entry, source.bitsHrefById)),
    ...source.devlogs.map((entry) => getRecentAnchorPublication(entry, 'devlog'))
  ]
    .sort((left, right) => compareByNullableDateDesc(left.date, right.date))
    .slice(0, RECENT_LIMIT);

const getLatestUpdate = (source: AdminOverviewPublicSource): AdminOverviewStats['lastUpdate'] => {
  const candidates = [
    ...source.blogs.map((entry) => ({
      date: entry.data.date,
      dateLabel: formatCompactDateUtc(entry.data.date)
    })),
    ...source.projects.map((entry) => ({
      date: entry.data.date,
      dateLabel: formatCompactDate(entry.data.date)
    })),
    ...source.bits.map((entry) => ({
      date: entry.data.date,
      dateLabel: formatCompactDate(entry.data.date)
    })),
    ...source.devlogs.map((entry) => ({
      date: entry.data.date,
      dateLabel: formatCompactDate(entry.data.date)
    }))
  ].sort((left, right) => compareByNullableDateDesc(left.date, right.date));

  const latest = candidates[0];
  return latest ? { date: latest.date, dateLabel: latest.dateLabel } : null;
};

const buildCollectionShares = (source: AdminOverviewPublicSource): AdminOverviewCollectionShare[] => {
  const total = source.blogs.length + source.projects.length + source.bits.length + source.devlogs.length;
  const counts: Record<AdminOverviewCollectionKey, number> = {
    blog: source.blogs.length,
    projects: source.projects.length,
    bits: source.bits.length,
    devlog: source.devlogs.length
  };

  return (Object.keys(counts) as AdminOverviewCollectionKey[]).map((key) => {
    const percentage = getPercentage(counts[key], total);
    return {
      key,
      label: COLLECTION_LABELS[key],
      detail: COLLECTION_DETAILS[key],
      count: counts[key],
      percentage,
      percentageLabel: `${percentage}%`
    };
  });
};

const countAdminOverviewTextWords = (text: string): number =>
  text.match(WORD_TOKEN_REGEX)?.length ?? 0;

export const countAdminOverviewWords = (markdown: string): number => {
  const text = cleanMarkdownToText(markdown);
  return countAdminOverviewTextWords(text);
};

export const formatAdminOverviewWordMetric = (wordCount: number): { value: string; suffix: string } => {
  if (wordCount <= WORD_COUNT_COMPACT_THRESHOLD) {
    return {
      value: String(wordCount),
      suffix: '字'
    };
  }

  return {
    value: (wordCount / WORD_COUNT_COMPACT_UNIT).toFixed(1),
    suffix: '万字'
  };
};

const buildAdminOverviewWordCount = (source: AdminOverviewPublicSource): number =>
  source.blogs.reduce(
    (total, entry) => total + countAdminOverviewTextWords(getBlogDerivedText(entry).plainText),
    0
  )
  + source.projects.reduce(
    (total, entry) => total + countAdminOverviewTextWords(entry.bodyText ?? ''),
    0
  )
  + source.bits.reduce(
    (total, entry) => total + countAdminOverviewTextWords(getBitsDerivedText(entry).plainText),
    0
  )
  + source.devlogs.reduce(
    (total, entry) => total + countAdminOverviewTextWords(entry.bodyText ?? ''),
    0
  );

const getActivityLevel = (count: number): AdminOverviewActivityDay['level'] => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
};

const createUtcDate = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addUtcDays = (date: Date, offset: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset));

const normalizeDeployTarget = (value: string | undefined): AdminOverviewDeployTarget | null => {
  const normalized = value?.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (!normalized) return null;
  return DEPLOY_TARGET_ALIASES.get(normalized) ?? null;
};

const getHostTargetLabel = (env: Record<string, string | undefined>): string => {
  const explicitTarget = normalizeDeployTarget(env.DEPLOY_TARGET);
  if (explicitTarget) return DEPLOY_TARGET_LABELS[explicitTarget];
  if (env.CF_PAGES === '1' || env.CF_PAGES === 'true') return DEPLOY_TARGET_LABELS['cloudflare-pages'];
  if (env.VERCEL === '1' || env.VERCEL === 'true') return DEPLOY_TARGET_LABELS.vercel;
  if (env.GITHUB_ACTIONS === 'true') return 'GitHub Actions';
  return DEPLOY_TARGET_LABELS['static-host'];
};

const formatBuildDateLabel = (date: Date): string => formatDateTime(date);

const buildWritingActivity = (
  blogs: readonly BlogEntry[],
  bits: readonly BitsEntry[],
  now: Date = new Date()
): AdminOverviewActivityDay[] => {
  const datedEntries = [
    ...blogs.map((entry) => entry.data.date),
    ...bits.map((entry) => entry.data.date)
  ];
  if (datedEntries.length === 0) return [];

  const anchor = createUtcDate(now);
  const counts = new Map<string, number>();

  for (const date of datedEntries) {
    const key = formatISODateUtc(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: ACTIVITY_DAY_COUNT }, (_, index) => {
    const date = addUtcDays(anchor, index - (ACTIVITY_DAY_COUNT - 1));
    const key = formatISODateUtc(date);
    const count = counts.get(key) ?? 0;
    return {
      date: key,
      dateLabel: key,
      count,
      level: getActivityLevel(count)
    };
  });
};

const buildAdminOverviewSystemStatus = (
  activity: readonly AdminOverviewActivityDay[],
  options: Pick<AdminOverviewDataOptions, 'env' | 'isDev' | 'now'>
): AdminOverviewSystemStatus => {
  const isDev = options.isDev === true;
  const buildDate = options.now ?? new Date();
  const buildDateTime = buildDate.toISOString();
  const env = options.env ?? process.env;

  return {
    statusLabel: isDev ? 'Dev Ready' : 'Static Ready',
    activity: activity.slice(-SYSTEM_STATUS_ACTIVITY_DAY_COUNT),
    items: [
      {
        key: 'runtime',
        label: 'Runtime',
        value: isDev ? 'Dev' : 'Static'
      },
      {
        key: 'hostTarget',
        label: 'Host Target',
        value: getHostTargetLabel(env)
      },
      {
        key: 'engine',
        label: 'Engine',
        value: `Astro ${ASTRO_VERSION}`
      },
      {
        key: 'lastBuild',
        label: 'Last Build',
        value: formatBuildDateLabel(buildDate),
        dateTime: buildDateTime
      }
    ]
  };
};

export const buildAdminOverviewPublicSummary = (
  source: AdminOverviewPublicSource,
  options: AdminOverviewPublicSummaryOptions = {}
): AdminOverviewPublicSummary => {
  const topTags = collectTagSummary(source.archiveblogs);

  return {
    stats: {
      publishedCount: source.blogs.length + source.projects.length + source.bits.length + source.devlogs.length,
      tagCount: topTags.length,
      wordCount: buildAdminOverviewWordCount(source),
      lastUpdate: getLatestUpdate(source)
    },
    collections: buildCollectionShares(source),
    topTags: topTags.slice(0, TOP_TAG_LIMIT).map((tag) => ({
      key: tag.key,
      label: tag.label,
      count: tag.count,
      href: getTagPath('archive', tag.key)
    })),
    writingActivity: buildWritingActivity(source.blogs, source.bits, options.now),
    recentPublications: buildRecentPublications(source)
  };
};

export const buildAdminOverviewMaintainerSummary = (
  source: AdminOverviewMaintainerSource | null,
  bitsHrefById: ReadonlyMap<string, string>
): AdminOverviewMaintainerSummary | null => {
  if (!source) return null;

  const collectionDrafts: AdminOverviewCollectionDraftSummary[] = [
    {
      key: 'blog',
      label: COLLECTION_LABELS.blog,
      draftCount: getCollectionDraftCount(source.blogs),
      totalCount: source.blogs.length
    },
    {
      key: 'projects',
      label: COLLECTION_LABELS.projects,
      draftCount: getCollectionDraftCount(source.projects),
      totalCount: source.projects.length
    },
    {
      key: 'bits',
      label: COLLECTION_LABELS.bits,
      draftCount: getCollectionDraftCount(source.bits),
      totalCount: source.bits.length
    },
    {
      key: 'devlog',
      label: COLLECTION_LABELS.devlog,
      draftCount: getCollectionDraftCount(source.devlogs),
      totalCount: source.devlogs.length
    }
  ];
  const recentPublications = buildRecentPublications({
    blogs: source.blogs,
    projects: source.projects,
    bits: source.bits,
    devlogs: source.devlogs,
    bitsHrefById
  });

  return {
    draftCount: collectionDrafts.reduce((total, summary) => total + summary.draftCount, 0),
    collectionDrafts,
    recentDraftCount: recentPublications.filter((entry) => entry.isDraft).length,
    recentPublications
  };
};

const loadAdminOverviewSource = async (
  options: AdminOverviewSourceOptions
): Promise<AdminOverviewSource> => {
  const includeDraft = options.includeMaintainer;
  const [sourceblogs, sourceProjects, sourceBits, sourceDevlogs] = await Promise.all([
    getSortedblogs({ includeDraft }),
    getPublishedCollection('projects', { includeDraft, orderBy: orderByEntryDateDesc }) as Promise<AdminOverviewListEntry[]>,
    getSortedBits({ includeDraft }),
    getPublishedCollection('devlog', { includeDraft, orderBy: orderByEntryDateDesc }) as Promise<AdminOverviewListEntry[]>
  ]);
  const blogs = filterPublishedEntries(sourceblogs);
  const projects = filterPublishedEntries(sourceProjects);
  const bits = filterPublishedEntries(sourceBits);
  const devlogs = filterPublishedEntries(sourceDevlogs);

  const publicSource: AdminOverviewPublicSource = {
    blogs,
    archiveblogs: blogs.filter(isVisibleBlogEntry),
    projects,
    bits,
    devlogs,
    bitsHrefById: buildAdminOverviewBitsHrefById(bits)
  };

  if (!options.includeMaintainer) {
    return {
      public: publicSource,
      maintainer: null
    };
  }

  return {
    public: publicSource,
    maintainer: {
      blogs: sourceblogs,
      projects: sourceProjects,
      bits: sourceBits,
      devlogs: sourceDevlogs
    }
  };
};

export const getAdminOverviewData = async (
  options: AdminOverviewDataOptions
): Promise<AdminOverviewData> => {
  const source = await loadAdminOverviewSource({ includeMaintainer: options.includeMaintainer });
  const publicSummary = buildAdminOverviewPublicSummary(
    source.public,
    options.now === undefined ? undefined : { now: options.now }
  );
  const maintainerSummary = buildAdminOverviewMaintainerSummary(
    source.maintainer,
    source.public.bitsHrefById
  );
  const systemStatusOptions: Pick<AdminOverviewDataOptions, 'env' | 'isDev' | 'now'> = {
    isDev: options.isDev ?? options.includeMaintainer
  };
  if (options.env) systemStatusOptions.env = options.env;
  if (options.now) systemStatusOptions.now = options.now;

  return {
    ...publicSummary,
    systemStatus: buildAdminOverviewSystemStatus(publicSummary.writingActivity, systemStatusOptions),
    recentPublications: options.includeDraftInRecent && maintainerSummary
      ? maintainerSummary.recentPublications
      : publicSummary.recentPublications,
    maintainerSummary
  };
};
