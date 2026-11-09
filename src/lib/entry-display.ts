/**
 * 条目标题行的固定排版。
 *
 * 列表与归档统一为 `(分类胶囊) 标题 (版本号淡色胶囊)`，版本名称出现的位置可配置。
 * 版本号与版本名称只来自显式 frontmatter，不使用日期兜底。
 *
 * 内容系列是版本之外的第二块呈现（`series` / `seriesName` / `seriesOrder`）：
 * 系列成员是并列的独立文章，编号是「第 N 篇 / 共 M 篇」的阅读序号，所以这里只用
 * `series-name` / `series-label` 两种片段，绝不产生「最新 / 历史」这类版本语义。
 */

import type { BlogSeriesGroup } from './blog-series';

export type EntryVersionNameMode = 'hidden' | 'before-label' | 'after-label';

export type EntryTitleSurface = 'list' | 'archive' | 'project';

export type EntryTitleKind = 'blog' | 'projects' | 'devlog';

export const ENTRY_VERSION_NAME_MODES = ['hidden', 'before-label', 'after-label'] as const satisfies readonly EntryVersionNameMode[];

export const DEFAULT_ENTRY_VERSION_NAME_MODE: EntryVersionNameMode = 'hidden';

/**
 * 后台下拉框用「结构组合」而不是自然语言描述：每个选项直接画出字段顺序，
 * 下方的实时预览再给出真实条目外观。
 */
export const ENTRY_VERSION_NAME_MODE_OPTIONS = [
  { id: 'hidden', label: '分类 · 标题 · 版本号' },
  { id: 'before-label', label: '分类 · 标题 : 版本名称 · 版本号' },
  { id: 'after-label', label: '分类 · 标题 · 版本号 · 版本名称' }
] as const satisfies ReadonlyArray<{ id: EntryVersionNameMode; label: string }>;

export const ENTRY_TITLE_COLON = ': ';

export const isEntryVersionNameMode = (value: unknown): value is EntryVersionNameMode =>
  typeof value === 'string' && (ENTRY_VERSION_NAME_MODES as readonly string[]).includes(value);

export const normalizeEntryVersionNameMode = (value: unknown): EntryVersionNameMode =>
  isEntryVersionNameMode(value) ? value : DEFAULT_ENTRY_VERSION_NAME_MODE;

/**
 * 条目上的系列呈现档位：
 * - `meta`：标题行不变，元信息行在标签之前插入「系列名 N/M」；
 * - `pill`：标题之后先一枚淡色胶囊装 `N/M`，再接系列名；
 * - `prefix`：分类胶囊之后是「系列名: 」，标题正常显示，末尾按需挂 `N/M` 胶囊；
 * - `hidden`：条目上不显示（文章页侧栏仍然生效）。
 */
export type EntrySeriesMode = 'hidden' | 'meta' | 'pill' | 'prefix';

/** 顺序指示（`N/M`）单独开关：关掉后名称仍在，只是不显示阅读序号。 */
export type EntrySeriesOrder = 'show' | 'hide';

export const ENTRY_SERIES_MODES = ['hidden', 'meta', 'pill', 'prefix'] as const satisfies readonly EntrySeriesMode[];

export const DEFAULT_ENTRY_SERIES_MODE: EntrySeriesMode = 'meta';

/**
 * 选项标签沿用「结构组合」画法：直接写出字段顺序，真实外观由下方的条目预览给出。
 * `pill` 的胶囊在前、名字在后是硬约定，与版本号胶囊的阅读顺序一致。
 */
export const ENTRY_SERIES_MODE_OPTIONS = [
  { id: 'hidden', label: '不显示' },
  { id: 'meta', label: '标题 · 元信息行：系列名 2/5' },
  { id: 'pill', label: '分类 · 标题 · 2/5 · 系列名' },
  { id: 'prefix', label: '分类 · 系列名 : 标题 · 2/5' }
] as const satisfies ReadonlyArray<{ id: EntrySeriesMode; label: string }>;

export const ENTRY_SERIES_ORDERS = ['show', 'hide'] as const satisfies readonly EntrySeriesOrder[];

export const DEFAULT_ENTRY_SERIES_ORDER: EntrySeriesOrder = 'show';

export const ENTRY_SERIES_ORDER_OPTIONS = [
  { id: 'show', label: '显示序号 2/5' },
  { id: 'hide', label: '不显示序号' }
] as const satisfies ReadonlyArray<{ id: EntrySeriesOrder; label: string }>;

export const isEntrySeriesMode = (value: unknown): value is EntrySeriesMode =>
  typeof value === 'string' && (ENTRY_SERIES_MODES as readonly string[]).includes(value);

export const normalizeEntrySeriesMode = (value: unknown): EntrySeriesMode =>
  isEntrySeriesMode(value) ? value : DEFAULT_ENTRY_SERIES_MODE;

export const isEntrySeriesOrder = (value: unknown): value is EntrySeriesOrder =>
  typeof value === 'string' && (ENTRY_SERIES_ORDERS as readonly string[]).includes(value);

export const normalizeEntrySeriesOrder = (value: unknown): EntrySeriesOrder =>
  isEntrySeriesOrder(value) ? value : DEFAULT_ENTRY_SERIES_ORDER;

/** 站点设置里与系列呈现相关的两个键，取值刻意放宽成 unknown，见 `resolveEntrySeriesDisplay`。 */
export type EntrySeriesDisplayInput =
  | { entrySeriesMode?: unknown; entrySeriesOrder?: unknown }
  | null
  | undefined;

/**
 * 站点设置 → 条目呈现的归一化入口。
 * 参数刻意放宽到可选 unknown：旧 `ui.json` 缺这两个键、以及设置值被外部改成非法值，
 * 都必须在渲染侧安静回落到默认值，而不是让整页构建失败；校验与提示由后台设置页负责。
 * 返回值保持设置原样的 `show` / `hide` 词汇，避免调用方再把它翻译成布尔量。
 */
export const resolveEntrySeriesDisplay = (
  ui: EntrySeriesDisplayInput
): { mode: EntrySeriesMode; order: EntrySeriesOrder } => ({
  mode: normalizeEntrySeriesMode(ui?.entrySeriesMode),
  order: normalizeEntrySeriesOrder(ui?.entrySeriesOrder)
});

/** `N/M` 阅读序号；任一侧缺失或非法时返回空串（宁可不显示，也不显示 `0/0`）。 */
export const formatEntrySeriesOrder = (
  index?: number | null,
  total?: number | null
): string => {
  const position = typeof index === 'number' && Number.isFinite(index) ? Math.trunc(index) : 0;
  const size = typeof total === 'number' && Number.isFinite(total) ? Math.trunc(total) : 0;
  if (position <= 0 || size <= 0) return '';
  return `${position}/${size}`;
};

const trimmed = (value: string | null | undefined): string => (value ?? '').trim();

/** 系列信息在条目上的落点：`meta` 档进元信息行，`pill` / `prefix` 档进标题行。 */
export type EntrySeriesSlots = {
  /** 标题行是否承载系列段（`pill` / `prefix`）。 */
  showInTitle: boolean;
  /** 元信息行是否承载系列段（`meta`）。 */
  showInMeta: boolean;
  /** 已经算好的 `N/M` 序号文本；空串表示不显示序号。 */
  orderText: string;
};

/**
 * 列表卡片与首页条目共用的槽位解析：系列名与系列键都存在才算「属于一个系列」。
 * 抽出来是因为两个组件的判定必须完全一致——漏掉任一侧，同一条目会在两种列表里
 * 出现不同的系列文案。
 */
export const resolveEntrySeriesSlots = (
  series: {
    name?: string | null;
    slug?: string | null;
    index?: number | null;
    total?: number | null;
  },
  ui: EntrySeriesDisplayInput
): EntrySeriesSlots => {
  const display = resolveEntrySeriesDisplay(ui);
  const hasSeries = Boolean(trimmed(series.name) && trimmed(series.slug));
  return {
    showInTitle: hasSeries && (display.mode === 'pill' || display.mode === 'prefix'),
    showInMeta: hasSeries && display.mode === 'meta',
    orderText: display.order === 'show'
      ? formatEntrySeriesOrder(series.index, series.total)
      : ''
  };
};

export type EntryTitleSegment =
  | { kind: 'badge'; text: string }
  | { kind: 'project'; text: string }
  | { kind: 'title'; text: string }
  | { kind: 'gap' }
  | { kind: 'colon' }
  | { kind: 'version-name'; text: string }
  | { kind: 'version-label'; text: string }
  | { kind: 'series-name'; text: string }
  /** 系列阅读序号（`2/5`），渲染成淡色胶囊。 */
  | { kind: 'series-label'; text: string };

export type EntryTitleData = {
  /** 归档行类型：只有 devlog 使用「项目名: 标题」前缀。 */
  kind?: EntryTitleKind | null;
  badge?: string | null;
  project?: string | null;
  title: string;
  versionLabel?: string | null;
  versionName?: string | null;
  /** 系列显示名（缺省已由系列模型回退成 slug）。 */
  seriesName?: string | null;
  /** 系列内 1-based 阅读序号与成员总数，用来生成 `2/5`。 */
  seriesIndex?: number | null;
  seriesTotal?: number | null;
};

/** 系列呈现的标题段开关；不传时按站点默认档 `meta`（标题行不产生系列段）。 */
export type EntrySeriesTitleOptions = {
  mode?: EntrySeriesMode;
  order?: EntrySeriesOrder;
};

/**
 * 生成固定顺序的标题行片段。
 *
 * - `list` / `project`：badge → 间隙 → 标题 → 版本段 → 系列段（`pill` / `prefix`）。
 * - `archive` + `devlog`：项目名 → `": "` → 标题，不显示版本段与系列段。
 * - 其余归档行：标题 → 版本段 → 系列段（`pill` / `prefix`）。
 * - `versionLabel` 为空时完全跳过版本段；`versionName` 为空时退化为仅版本号。
 * - `meta` / `hidden` 档不产出系列段：前者由元信息行承担（归档行没有元信息行，
 *   所以在归档 surface 上退化成标题行内的小字），后者完全不显示。
 * - 版本与系列同时存在时，胶囊并排在前、名称按同序在后（版本在前、系列在后）：
 *   胶囊与文字交替出现会让高度与字号反复跳变，读起来更碎。
 */
export const buildEntryTitleSegments = (
  data: EntryTitleData,
  surface: EntryTitleSurface,
  mode: EntryVersionNameMode = DEFAULT_ENTRY_VERSION_NAME_MODE,
  series: EntrySeriesTitleOptions = {}
): EntryTitleSegment[] => {
  const title = data.title ?? '';
  const versionLabel = trimmed(data.versionLabel);
  const versionName = trimmed(data.versionName);
  const project = trimmed(data.project);
  const seriesMode = series.mode ?? DEFAULT_ENTRY_SERIES_MODE;
  const seriesName = trimmed(data.seriesName);
  const seriesOrderLabel = series.order === 'hide'
    ? ''
    : formatEntrySeriesOrder(data.seriesIndex, data.seriesTotal);

  if (surface === 'archive' && data.kind === 'devlog') {
    const segments: EntryTitleSegment[] = [];
    if (project) {
      segments.push({ kind: 'project', text: project }, { kind: 'colon' });
    }
    segments.push({ kind: 'title', text: title });
    return segments;
  }

  const segments: EntryTitleSegment[] = [];

  if (surface !== 'archive') {
    const badge = trimmed(data.badge) || (surface === 'list' ? '随笔' : '');
    if (badge) segments.push({ kind: 'badge', text: badge }, { kind: 'gap' });
  }

  // `prefix` 档把系列名放在标题之前，用与版本名称同一个冒号片段收尾（`系列名: 标题`）。
  if (seriesMode === 'prefix' && seriesName) {
    segments.push({ kind: 'series-name', text: seriesName }, { kind: 'colon' });
  }

  segments.push({ kind: 'title', text: title });

  // 归档行没有元信息行：`meta` 档在这里退化成标题后面的一小段淡色小字。
  // 必须走标题段而不是行内追加节点——`.entry-title` 是 flex 容器，追加在它外面的
  // 节点会被挤到下一行，整条时间线的行距就散了。
  if (seriesMode === 'meta' && surface === 'archive' && seriesName) {
    segments.push(
      { kind: 'gap' },
      { kind: 'series-name', text: seriesOrderLabel ? `${seriesName} ${seriesOrderLabel}` : seriesName }
    );
    return segments;
  }

  // 版本与系列同时出现时，先把两枚胶囊并排放在一起，再按同一顺序放名称：
  // 胶囊与文字交替出现会让字号与高度反复跳变，视觉上很碎。
  const showSeriesPill = seriesMode === 'pill' || (seriesMode === 'prefix' && Boolean(seriesOrderLabel));
  const versionNameFirst = Boolean(versionLabel && versionName) && mode === 'before-label';
  const versionNameLast = Boolean(versionLabel && versionName) && mode !== 'hidden' && mode !== 'before-label';

  if (versionNameFirst) {
    segments.push({ kind: 'colon' }, { kind: 'version-name', text: versionName });
  }
  if (versionLabel) {
    segments.push({ kind: 'gap' }, { kind: 'version-label', text: versionLabel });
  }
  if (showSeriesPill && seriesOrderLabel) {
    segments.push({ kind: 'gap' }, { kind: 'series-label', text: seriesOrderLabel });
  }
  if (versionNameLast) {
    segments.push({ kind: 'gap' }, { kind: 'version-name', text: versionName });
  }
  if (seriesMode === 'pill' && seriesName) {
    segments.push({ kind: 'gap' }, { kind: 'series-name', text: seriesName });
  }

  return segments;
};

/** 条目视角的系列信息：列表卡片与归档行只需要「我这一篇在第几篇」。 */
export type EntrySeriesView = {
  slug: string;
  name: string;
  index: number;
  total: number;
};

/**
 * 系列索引（按 slug 分组）→ 按条目 id 反查。
 * 放在展示层而不是系列模型里：模型管排序，这里只负责把结果摊平给条目消费。
 */
export const buildEntrySeriesLookup = (
  index: ReadonlyMap<string, BlogSeriesGroup>
): Map<string, EntrySeriesView> => {
  const lookup = new Map<string, EntrySeriesView>();
  for (const [slug, group] of index) {
    for (const member of group.members) {
      lookup.set(member.entryId, {
        slug,
        name: group.name,
        index: member.index,
        total: group.total
      });
    }
  }
  return lookup;
};
