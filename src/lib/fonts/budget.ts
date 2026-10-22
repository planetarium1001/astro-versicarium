import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FontCoverage,
  ThemeFontId,
  TypographyRole,
  TypographySettings
} from '../theme-settings';
import { THEME_TYPOGRAPHY_DEFAULT, getThemeFontRegistryEntry } from './registry';

/**
 * 字体预算 helper（后台排版字体区域与服务端组件共用）。
 *
 * 数据来源优先级：`tools/font-manifest.json`（由 `font:subset` 生成，schemaVersion 2：
 * 顶层 `families[]` + `faces[]`，face 以 `fontId` 归属字体）→ 静态回退估算。
 * 同时兼容旧 `fonts[]` 形态（face 的 `id` 即字体注册表 id），避免清单升级期后台崩溃。
 *
 * 清单尚未生成时（例如只改了后台设置、还没跑 `npm run font:build`）不能让后台崩溃，
 * 因此这里始终返回可渲染的预算文案，并用 `source` 标记数据来源。
 */

export const FONT_MANIFEST_RELATIVE_PATH = 'tools/font-manifest.json';
const KB = 1024;
const MB = 1024 * KB;
const DLC_TARGET_BLOCK_BYTES = 200 * KB;

export interface FontManifestFace {
  /** 分片文件名（去掉 .woff2 的内容哈希名）；旧 `fonts[]` 契约下等于 fontId。 */
  id: string;
  /** 字体注册表 id（noto-serif-sc / lxgw-wenkai-lite / noto-sans-sc）。 */
  fontId: string;
  family?: string;
  weight?: number | string;
  /** 生成期角色：text / display / meta / latin / dlc。 */
  role?: string;
  tier?: string;
  file?: string;
  bytes: number;
  unicodeRange?: string | readonly string[];
  dlc: boolean;
}

export interface FontManifestByFontEntry {
  baseBytes?: number;
  dlcBytes?: number;
  baseFaces?: number;
  dlcFaces?: number;
}

export interface FontManifestSummary {
  /* schemaVersion 2（font-engineer 生成） */
  baseBytes?: number;
  dlcBytes?: number;
  totalBytes?: number;
  baseFaces?: number;
  dlcFaces?: number;
  byFont?: Record<string, FontManifestByFontEntry>;
  byRole?: Record<string, FontManifestByFontEntry>;
  byTier?: Record<string, { bytes?: number; faces?: number }>;
  estimate?: {
    commonPageBytes?: number;
    rarePageExtraBytes?: number;
    maxDlcChunkBytes?: number;
    averageDlcChunkBytes?: number;
  };
  /* 旧设计稿 fonts[] 形态的汇总字段（tolerant 兼容） */
  baseBytesByFont?: Record<string, number>;
  dlcBytesByFont?: Record<string, number>;
  commonPageBytes?: Record<string, number> | number;
  rarePageBytes?: Record<string, number> | number;
  totalBaseBytes?: number;
  totalDlcBytes?: number;
}

export interface FontManifest {
  schemaVersion?: number;
  generatedAt?: string;
  families?: readonly unknown[];
  faces?: readonly FontManifestFace[];
  summary?: FontManifestSummary;
}

export type FontBudgetSource = 'manifest' | 'static-fallback';

export interface FontCardBudget {
  /** 该角色下选中这个字体的 base 分片合计字节；null 表示无法估算或与覆盖策略无关。 */
  bytes: number | null;
  /** 卡片徽章文案。 */
  label: string;
  /** 是否受全局 CJK 覆盖策略影响（拉丁 / 系统字体为 false）。 */
  appliesToCoverage: boolean;
}

export interface FontBudgetSummary {
  coverage: FontCoverage;
  source: FontBudgetSource;
  /** 当前 typography 选择下，常用页首屏会加载的 base 分片字节。 */
  commonPageBytes: number;
  /** full 模式下生僻字页最多额外下载的单个 DLC 分片字节；common 模式为 0。 */
  rarePageIncrementBytes: number;
  /** 当前选择对应的 base 分片合计。 */
  baseBytes: number;
  /** 当前选择对应的 DLC 分片合计。 */
  dlcBytes: number;
  /** 构建产物总量（base + DLC，与覆盖模式无关：DLC 资产始终随主题仓库发布）。 */
  buildTotalBytes: number;
  selectedFontIds: ThemeFontId[];
}

export interface FontCoverageCopy {
  coverage: FontCoverage;
  budgetLine: string;
  detailLine: string;
  buildLine: string;
  sourceNote: string | null;
}

/* 静态回退只用于清单缺失时的展示，不代表最终产物；数字取 design.md/PRD 的量级（DLC 目标 180 KB，
   full 增量约 23 MB，文楷在 copy 约 30 KB、在 readable 约 220 KB）。 */
const FALLBACK_BASE_BYTES_BY_FONT_ROLE: Partial<
  Record<ThemeFontId, Partial<Record<TypographyRole, number>>>
> = {
  'noto-serif-sc': { readable: 180 * KB, copy: 150 * KB, brand: 96 * KB },
  'lxgw-wenkai-lite': { readable: 220 * KB, copy: 32 * KB, brand: 72 * KB },
  'noto-sans-sc': { readable: 160 * KB, copy: 110 * KB }
};

const FALLBACK_DLC_BYTES_BY_FONT: Partial<Record<ThemeFontId, number>> = {
  'noto-serif-sc': 12.5 * MB,
  'noto-sans-sc': 3.6 * MB,
  'lxgw-wenkai-lite': 1.2 * MB
};

/* manifest 的 role 是生成期角色（text/display/meta/latin），后台角色是语义角色
   （readable/copy/mono/brand）；latin 分片会随任一使用该 family 的角色一起加载。 */
const MANIFEST_ROLES_BY_UI_ROLE: Record<TypographyRole, readonly string[]> = {
  readable: ['text', 'display', 'latin'],
  copy: ['meta', 'latin'],
  mono: [],
  brand: ['text', 'latin']
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asFiniteBytes = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const normalizeUnicodeRange = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value.join(', ');
  }
  return undefined;
};

/**
 * 单条 face 归一化：
 * - v2：`{ id: chunk 文件名, fontId, ... }`，id 与 fontId 是两个字段；
 * - 旧 `fonts[]`：`{ id: 字体注册表 id, ... }`，没有 fontId，此时 id 兼任 fontId。
 */
const normalizeFace = (value: unknown): FontManifestFace | null => {
  if (!isRecord(value)) return null;
  const bytes = asFiniteBytes(value.bytes);
  if (bytes === null) return null;
  const rawId = typeof value.id === 'string' ? value.id.trim() : '';
  const rawFontId = typeof value.fontId === 'string' ? value.fontId.trim() : '';
  const fontId = rawFontId || rawId;
  if (!fontId) return null;

  const unicodeRange = normalizeUnicodeRange(value.unicodeRange);
  return {
    id: rawId || fontId,
    fontId,
    bytes,
    dlc: value.dlc === true,
    ...(typeof value.family === 'string' ? { family: value.family } : {}),
    ...(typeof value.role === 'string' ? { role: value.role } : {}),
    ...(typeof value.tier === 'string' ? { tier: value.tier } : {}),
    ...(typeof value.file === 'string' ? { file: value.file } : {}),
    ...(typeof value.weight === 'number' || typeof value.weight === 'string'
      ? { weight: value.weight }
      : {}),
    ...(unicodeRange ? { unicodeRange } : {})
  };
};

const normalizeManifest = (value: unknown): FontManifest | null => {
  if (!isRecord(value)) return null;

  /* schemaVersion 2 用 faces；旧清单用 fonts。两者都按 face 处理（旧形态 id 即 fontId）。 */
  const rawFaces = Array.isArray(value.faces)
    ? value.faces
    : Array.isArray(value.fonts)
      ? value.fonts
      : [];
  const faces = rawFaces.flatMap((face): FontManifestFace[] => {
    const normalized = normalizeFace(face);
    return normalized ? [normalized] : [];
  });
  const summary = isRecord(value.summary) ? (value.summary as FontManifestSummary) : undefined;

  if (!faces.length && !summary) return null;
  return {
    ...(typeof value.schemaVersion === 'number' ? { schemaVersion: value.schemaVersion } : {}),
    ...(typeof value.generatedAt === 'string' ? { generatedAt: value.generatedAt } : {}),
    ...(Array.isArray(value.families) ? { families: value.families } : {}),
    ...(faces.length ? { faces } : {}),
    ...(summary ? { summary } : {})
  };
};

/** 归一化 manifest（兼容 v2 faces[] 与旧 fonts[]）；测试与 readFontManifest 共用。 */
export const normalizeFontManifest = (value: unknown): FontManifest | null => normalizeManifest(value);

/** 读取 `tools/font-manifest.json`；缺失、损坏或尚未生成时返回 null，由调用方回退静态估算。 */
export const readFontManifest = (): FontManifest | null => {
  try {
    const raw = readFileSync(join(process.cwd(), ...FONT_MANIFEST_RELATIVE_PATH.split('/')), 'utf8');
    return normalizeManifest(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};

const sumValues = (values: readonly (number | null)[]): number =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

const sumFaceBytes = (faces: readonly FontManifestFace[]): number =>
  faces.reduce((total, face) => total + face.bytes, 0);

/** face 归属字体：v2 用 fontId，旧形态缺 fontId 时用 id（= 字体注册表 id）。 */
const getFaceFontId = (face: FontManifestFace): string =>
  typeof face.fontId === 'string' && face.fontId ? face.fontId : face.id;

/** 优先 summary.byFont（v2），再读旧 baseBytesByFont / dlcBytesByFont，最后按 face 求和。 */
const getManifestBaseBytes = (manifest: FontManifest | null, fontId: string): number | null => {
  const byFont = asFiniteBytes(manifest?.summary?.byFont?.[fontId]?.baseBytes);
  if (byFont !== null) return byFont;

  const legacy = asFiniteBytes(manifest?.summary?.baseBytesByFont?.[fontId]);
  if (legacy !== null) return legacy;

  const faces =
    manifest?.faces?.filter((face) => getFaceFontId(face) === fontId && !face.dlc) ?? [];
  if (!faces.length) return null;
  return sumFaceBytes(faces);
};

const getManifestDlcBytes = (manifest: FontManifest | null, fontId: string): number | null => {
  const byFont = asFiniteBytes(manifest?.summary?.byFont?.[fontId]?.dlcBytes);
  if (byFont !== null) return byFont;

  const legacy = asFiniteBytes(manifest?.summary?.dlcBytesByFont?.[fontId]);
  if (legacy !== null) return legacy;

  const faces = manifest?.faces?.filter((face) => getFaceFontId(face) === fontId && face.dlc) ?? [];
  if (!faces.length) return null;
  return sumFaceBytes(faces);
};

const getManifestRoleBytes = (
  manifest: FontManifest | null,
  role: TypographyRole,
  fontId: string
): number | null => {
  const allowedRoles = MANIFEST_ROLES_BY_UI_ROLE[role];
  if (!allowedRoles.length) return null;

  const faces = manifest?.faces?.filter(
    (face) =>
      getFaceFontId(face) === fontId &&
      !face.dlc &&
      typeof face.role === 'string' &&
      allowedRoles.includes(face.role)
  ) ?? [];
  if (!faces.length) return null;
  return sumFaceBytes(faces);
};

const getFallbackRoleBytes = (fontId: ThemeFontId, role: TypographyRole): number | null => {
  const bytes = FALLBACK_BASE_BYTES_BY_FONT_ROLE[fontId]?.[role];
  return typeof bytes === 'number' ? bytes : null;
};

/** 单个字体卡片在该角色下的 base 分片合计（用于替换注册表里的静态徽章）。 */
export const getFontCardBudget = (
  role: TypographyRole,
  fontId: ThemeFontId,
  manifest: FontManifest | null = readFontManifest()
): FontCardBudget => {
  const entry = getThemeFontRegistryEntry(fontId);
  if (!entry) return { bytes: null, label: '', appliesToCoverage: false };
  if (entry.acquisition === 'system') {
    return { bytes: 0, label: '零下载', appliesToCoverage: false };
  }
  if (entry.acquisition === 'astro-fonts-api') {
    return { bytes: 0, label: '拉丁字体，不受 CJK 覆盖策略影响', appliesToCoverage: false };
  }

  const bytes = getManifestRoleBytes(manifest, role, fontId) ?? getFallbackRoleBytes(fontId, role);
  if (bytes === null) {
    return { bytes: null, label: entry.badge, appliesToCoverage: true };
  }
  return {
    bytes,
    label: `约 ${formatFontBudgetBytes(bytes)}/基础分片`,
    appliesToCoverage: true
  };
};

const getSelectedSubsetFontIds = (typography: TypographySettings): ThemeFontId[] => {
  const ids = new Set<ThemeFontId>();
  for (const role of Object.keys(typography) as TypographyRole[]) {
    const entry = getThemeFontRegistryEntry(typography[role]);
    if (entry?.acquisition === 'subset-pipeline') ids.add(typography[role]);
  }
  return [...ids];
};

const getFallbackBaseBytes = (typography: TypographySettings): number => {
  const bytesByFont = new Map<ThemeFontId, number>();
  for (const role of Object.keys(typography) as TypographyRole[]) {
    const fontId = typography[role];
    const entry = getThemeFontRegistryEntry(fontId);
    if (entry?.acquisition !== 'subset-pipeline') continue;
    const bytes = getFallbackRoleBytes(fontId, role) ?? 0;
    bytesByFont.set(fontId, Math.max(bytesByFont.get(fontId) ?? 0, bytes));
  }
  return [...bytesByFont.values()].reduce((total, bytes) => total + bytes, 0);
};

const getFallbackBuildTotalBytes = (): number => {
  const baseBytes = Object.entries(FALLBACK_BASE_BYTES_BY_FONT_ROLE).reduce((total, [, roleBytes]) => {
    const maxBytes = Math.max(
      0,
      ...Object.values(roleBytes ?? {}).filter((value): value is number => typeof value === 'number')
    );
    return total + maxBytes;
  }, 0);
  const dlcBytes = Object.values(FALLBACK_DLC_BYTES_BY_FONT).filter(
    (value): value is number => typeof value === 'number'
  );
  return baseBytes + sumValues(dlcBytes);
};

const isDefaultTypography = (typography: TypographySettings): boolean =>
  (Object.keys(THEME_TYPOGRAPHY_DEFAULT) as TypographyRole[]).every(
    (role) => typography[role] === THEME_TYPOGRAPHY_DEFAULT[role]
  );

/** 构建产物总量：优先 v2 summary.totalBytes，其次 baseBytes+dlcBytes，再兼容旧字段与 face 求和。 */
const getManifestBuildTotalBytes = (manifest: FontManifest | null): number | null => {
  const totalBytes = asFiniteBytes(manifest?.summary?.totalBytes);
  if (totalBytes !== null) return totalBytes;

  const baseBytes = asFiniteBytes(manifest?.summary?.baseBytes);
  const dlcBytes = asFiniteBytes(manifest?.summary?.dlcBytes);
  if (baseBytes !== null || dlcBytes !== null) {
    return (baseBytes ?? 0) + (dlcBytes ?? 0);
  }

  const legacyBaseBytes = asFiniteBytes(manifest?.summary?.totalBaseBytes);
  const legacyDlcBytes = asFiniteBytes(manifest?.summary?.totalDlcBytes);
  if (legacyBaseBytes !== null || legacyDlcBytes !== null) {
    return (legacyBaseBytes ?? 0) + (legacyDlcBytes ?? 0);
  }

  const faces = manifest?.faces;
  if (!faces?.length) return null;
  return sumFaceBytes(faces);
};

/** 生僻字页增量：优先 v2 estimate，其次旧 rarePageBytes，最后取最大 DLC 分片。 */
const getManifestRarePageBytes = (manifest: FontManifest | null): number | null => {
  const estimate = manifest?.summary?.estimate;
  const estimateBytes =
    asFiniteBytes(estimate?.rarePageExtraBytes) ?? asFiniteBytes(estimate?.maxDlcChunkBytes);
  if (estimateBytes !== null) return estimateBytes;

  const raw = manifest?.summary?.rarePageBytes;
  const direct = asFiniteBytes(raw);
  if (direct !== null) return direct;
  if (isRecord(raw)) {
    const values = Object.values(raw)
      .map((value) => asFiniteBytes(value))
      .filter((value): value is number => value !== null);
    if (values.length) return Math.max(...values);
  }

  const dlcFaces = manifest?.faces?.filter((face) => face.dlc) ?? [];
  if (!dlcFaces.length) return null;
  return Math.max(...dlcFaces.map((face) => face.bytes));
};

/** 常用页首屏预算：v2 estimate 只对默认 typography 有效；非默认选择退回按选中字体求和。 */
const getManifestCommonPageBytes = (
  manifest: FontManifest | null,
  typography: TypographySettings
): number | null => {
  if (!isDefaultTypography(typography)) return null;
  const estimateBytes = asFiniteBytes(manifest?.summary?.estimate?.commonPageBytes);
  if (estimateBytes !== null && estimateBytes > 0) return estimateBytes;

  // 旧 fonts[] 清单没有 estimate，只有 commonPageBytes（number 或按 fontId 的 map）。
  const raw = manifest?.summary?.commonPageBytes;
  const direct = asFiniteBytes(raw);
  if (direct !== null && direct > 0) return direct;
  if (isRecord(raw)) {
    const selected = sumValues(
      getSelectedSubsetFontIds(typography).map((fontId) => asFiniteBytes(raw[fontId]))
    );
    if (selected > 0) return selected;
    const all = sumValues(Object.values(raw).map((value) => asFiniteBytes(value)));
    if (all > 0) return all;
  }
  return null;
};

/**
 * 后台覆盖策略区域与预算摘要的唯一计算入口。
 * `manifest` 可显式传入（测试 / 生成器复用）；默认读取项目根 `tools/font-manifest.json`。
 */
export const getFontBudgetSummary = (
  typography: TypographySettings,
  coverage: FontCoverage,
  manifest: FontManifest | null = readFontManifest()
): FontBudgetSummary => {
  const selectedFontIds = getSelectedSubsetFontIds(typography);
  const hasManifest = manifest !== null;

  const baseBytes = (() => {
    if (hasManifest) {
      const bytes = sumValues(selectedFontIds.map((fontId) => getManifestBaseBytes(manifest, fontId)));
      if (bytes > 0) return bytes;
    }
    return getFallbackBaseBytes(typography);
  })();

  const dlcBytes = (() => {
    if (hasManifest) {
      const bytes = sumValues(selectedFontIds.map((fontId) => getManifestDlcBytes(manifest, fontId)));
      if (bytes > 0) return bytes;
    }
    return sumValues(selectedFontIds.map((fontId) => FALLBACK_DLC_BYTES_BY_FONT[fontId] ?? 0));
  })();

  const rarePageIncrementBytes = (() => {
    if (coverage === 'common') return 0;
    // 没有选中任何自托管 CJK 字体时，页面不会命中 DLC 分片。
    if (!selectedFontIds.length) return 0;
    const manifestRareBytes = hasManifest ? getManifestRarePageBytes(manifest) : null;
    const blockBytes = manifestRareBytes ?? DLC_TARGET_BLOCK_BYTES;
    return dlcBytes > 0 ? Math.min(blockBytes, dlcBytes) : blockBytes;
  })();

  const buildTotalBytes = (() => {
    if (hasManifest) {
      const totalBytes = getManifestBuildTotalBytes(manifest);
      if (totalBytes !== null && totalBytes > 0) return totalBytes;
    }
    return getFallbackBuildTotalBytes();
  })();

  const commonPageBytes = (() => {
    const estimateBytes = hasManifest ? getManifestCommonPageBytes(manifest, typography) : null;
    if (estimateBytes !== null) return estimateBytes;
    return baseBytes;
  })();

  return {
    coverage,
    source: hasManifest ? 'manifest' : 'static-fallback',
    commonPageBytes,
    rarePageIncrementBytes,
    baseBytes,
    dlcBytes,
    buildTotalBytes,
    selectedFontIds
  };
};

/** 字节数的人类可读格式：≥1 MB 保留一位小数，否则取整 KB。 */
export const formatFontBudgetBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KB))} KB`;
};

/** 生成两种覆盖模式的预算文案，供后台直接渲染（避免组件里重复拼字符串）。 */
export const getFontCoverageCopy = (summary: FontBudgetSummary): FontCoverageCopy => {
  const commonPage = formatFontBudgetBytes(summary.commonPageBytes);
  const baseBytes = formatFontBudgetBytes(summary.baseBytes);
  const dlcBytes = formatFontBudgetBytes(summary.dlcBytes);
  const buildTotal = formatFontBudgetBytes(summary.buildTotalBytes);
  const rareIncrement = formatFontBudgetBytes(summary.rarePageIncrementBytes);
  const sourceNote =
    summary.source === 'manifest'
      ? null
      : `预算为静态估算；运行 npm run font:build 生成 ${FONT_MANIFEST_RELATIVE_PATH} 后自动更新。`;

  if (summary.coverage === 'common') {
    return {
      coverage: 'common',
      budgetLine: `常用页首屏预算约 ${commonPage}；所选字体的基础分片合计 ${baseBytes}，页面只下载命中分片。`,
      detailLine: '生僻字回退系统字体，不加载 DLC，也不会产生 404。',
      buildLine: `主题字体资产共约 ${buildTotal}，构建产物全量，页面按需下载；系统字体与拉丁等宽字体不受影响。开发模式即时预览，生产需重新构建。`,
      sourceNote
    };
  }

  return {
    coverage: 'full',
    budgetLine: `常用页首屏预算约 ${commonPage}；所选字体的基础分片合计 ${baseBytes}，页面只下载命中分片。`,
    detailLine:
      summary.rarePageIncrementBytes > 0
        ? `生僻字页按需加载命中的 DLC 分片（单块约 ${rareIncrement}）；无生僻字不请求 DLC。完整覆盖在出现生僻字时下载，常用覆盖回退系统字体。`
        : '当前没有选中自托管 CJK 字体，不会请求任何 DLC 分片。',
    buildLine: `主题字体资产共约 ${buildTotal}（当前选择 DLC 约 ${dlcBytes}），构建产物全量，页面按需下载；系统字体与拉丁等宽字体不受影响。开发模式即时预览，生产需重新构建。`,
    sourceNote
  };
};
