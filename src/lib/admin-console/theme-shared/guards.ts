import type {
  ArchiveVersionMode,
  ArticleDateDisplayMode,
  ArticleDateGranularity,
  EditableThemeSettings,
  FontCoverage,
  HeroPresetId,
  HomeIntroLinkKey,
  SidebarDividerVariant,
  SidebarNavId,
  SiteFilingsScope,
  SiteSocialIconKey,
  SiteSocialPresetId,
  SiteSocialPresetOrder
} from '../../theme-settings';
import {
  ADMIN_ARTICLE_DATE_DISPLAY_SET,
  ADMIN_ARTICLE_DATE_GRANULARITY_SET,
  ADMIN_ARCHIVE_VERSION_MODE_SET,
  ADMIN_FILINGS_SCOPE_SET,
  ADMIN_FONT_COVERAGE_SET,
  ADMIN_HERO_PRESET_SET,
  ADMIN_HOME_INTRO_LINK_DEFAULT,
  ADMIN_HOME_INTRO_LINK_KEY_SET,
  ADMIN_HOME_INTRO_LINK_LIMIT,
  ADMIN_HOME_INTRO_LINK_OPTIONS,
  ADMIN_NAV_IDS,
  ADMIN_NAV_ORNAMENT_DEFAULT,
  ADMIN_NAV_ORDER_MAX,
  ADMIN_NAV_ORDER_MIN,
  ADMIN_SIDEBAR_DIVIDER_SET,
  ADMIN_SITE_PAGE_GAP_DEFAULT,
  ADMIN_SITE_PAGE_GAP_MAX,
  ADMIN_SITE_PAGE_GAP_MIN,
  ADMIN_SITE_RAIL_OFFSET_DEFAULT,
  ADMIN_SITE_RAIL_OFFSET_MAX,
  ADMIN_SITE_RAIL_OFFSET_MIN,
  ADMIN_SITE_TITLE_PERCENT_DEFAULT,
  ADMIN_SITE_TITLE_PERCENT_MAX,
  ADMIN_SITE_TITLE_PERCENT_MIN,
  ADMIN_SOCIAL_ICON_KEY_SET,
  ADMIN_SOCIAL_ORDER_MAX,
  ADMIN_SOCIAL_ORDER_MIN,
  ADMIN_SOCIAL_PRESET_IDS
} from './constants';

export type AdminSocialOrderScope = 'preset' | 'custom';
export type AdminSocialOrderInput = {
  key: string;
  order: number;
};
export type AdminNavOrderInput = {
  key: SidebarNavId;
  order: number;
};

export type AdminSocialOrderIssue = {
  type: 'range' | 'duplicate';
  scope: AdminSocialOrderScope;
  key: string;
  order: number;
};
export type AdminNavOrderIssue = {
  type: 'range' | 'duplicate';
  key: SidebarNavId;
  order: number;
};

export const isAdminArticleDateDisplayMode = (value: unknown): value is ArticleDateDisplayMode =>
  typeof value === 'string' && ADMIN_ARTICLE_DATE_DISPLAY_SET.has(value as ArticleDateDisplayMode);

export const isAdminArticleDateGranularity = (value: unknown): value is ArticleDateGranularity =>
  typeof value === 'string' && ADMIN_ARTICLE_DATE_GRANULARITY_SET.has(value as ArticleDateGranularity);

export const isAdminArchiveVersionMode = (value: unknown): value is ArchiveVersionMode =>
  typeof value === 'string' && ADMIN_ARCHIVE_VERSION_MODE_SET.has(value as ArchiveVersionMode);

export const isAdminFontCoverage = (value: unknown): value is FontCoverage =>
  typeof value === 'string' && ADMIN_FONT_COVERAGE_SET.has(value as FontCoverage);

export const getAdminFooterStartYearMax = (): number => new Date().getFullYear();

export const isAdminNavId = (value: string): value is SidebarNavId =>
  (ADMIN_NAV_IDS as readonly string[]).includes(value);

export const isAdminHeroPresetId = (value: string): value is HeroPresetId =>
  ADMIN_HERO_PRESET_SET.has(value as HeroPresetId);

export const isAdminSidebarDividerVariant = (value: string): value is SidebarDividerVariant =>
  ADMIN_SIDEBAR_DIVIDER_SET.has(value as SidebarDividerVariant);

export const isAdminFilingsScope = (value: string): value is SiteFilingsScope =>
  ADMIN_FILINGS_SCOPE_SET.has(value as SiteFilingsScope);

export const isAdminHomeIntroLinkKey = (value: string): value is HomeIntroLinkKey =>
  ADMIN_HOME_INTRO_LINK_KEY_SET.has(value as HomeIntroLinkKey);

export const isAdminSocialPresetId = (value: string): value is SiteSocialPresetId =>
  (ADMIN_SOCIAL_PRESET_IDS as readonly string[]).includes(value);

export const normalizeAdminSocialIconKey = (value: unknown): SiteSocialIconKey | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized === 'link' || normalized === 'globe') return 'website';
  return ADMIN_SOCIAL_ICON_KEY_SET.has(normalized as SiteSocialIconKey) ? (normalized as SiteSocialIconKey) : undefined;
};

export const isAdminSocialIconKey = (value: string): value is SiteSocialIconKey =>
  ADMIN_SOCIAL_ICON_KEY_SET.has(value as SiteSocialIconKey);

export const isAdminSocialOrderValue = (value: number): boolean =>
  Number.isInteger(value) && value >= ADMIN_SOCIAL_ORDER_MIN && value <= ADMIN_SOCIAL_ORDER_MAX;

export const isAdminNavOrderValue = (value: number): boolean =>
  Number.isInteger(value) && value >= ADMIN_NAV_ORDER_MIN && value <= ADMIN_NAV_ORDER_MAX;

export const getAdminSocialOrderIssues = (
  presetOrder: Readonly<SiteSocialPresetOrder>,
  customItems: readonly AdminSocialOrderInput[]
): AdminSocialOrderIssue[] => {
  const entries = [
    ...ADMIN_SOCIAL_PRESET_IDS.map((id) => ({
      scope: 'preset' as const,
      key: id,
      order: presetOrder[id]
    })),
    ...customItems.map((item) => ({
      scope: 'custom' as const,
      key: item.key,
      order: item.order
    }))
  ];
  const orderCounts = new Map<number, number>();

  entries.forEach((entry) => {
    if (!isAdminSocialOrderValue(entry.order)) return;
    orderCounts.set(entry.order, (orderCounts.get(entry.order) ?? 0) + 1);
  });

  const issues: AdminSocialOrderIssue[] = [];

  entries.forEach((entry) => {
    if (!isAdminSocialOrderValue(entry.order)) {
      issues.push({ type: 'range', ...entry });
      return;
    }

    if ((orderCounts.get(entry.order) ?? 0) > 1) {
      issues.push({ type: 'duplicate', ...entry });
    }
  });

  return issues;
};

export const getAdminNavOrderIssues = (items: readonly AdminNavOrderInput[]): AdminNavOrderIssue[] => {
  const orderCounts = new Map<number, number>();

  items.forEach((item) => {
    if (!isAdminNavOrderValue(item.order)) return;
    orderCounts.set(item.order, (orderCounts.get(item.order) ?? 0) + 1);
  });

  const issues: AdminNavOrderIssue[] = [];

  items.forEach((item) => {
    if (!isAdminNavOrderValue(item.order)) {
      issues.push({ type: 'range', ...item });
      return;
    }

    if ((orderCounts.get(item.order) ?? 0) > 1) {
      issues.push({ type: 'duplicate', ...item });
    }
  });

  return issues;
};

export const getAdminHomeIntroLinkOption = (
  id: HomeIntroLinkKey
): (typeof ADMIN_HOME_INTRO_LINK_OPTIONS)[number] =>
  ADMIN_HOME_INTRO_LINK_OPTIONS.find((option) => option.id === id) ?? ADMIN_HOME_INTRO_LINK_OPTIONS[0];

export const isAdminAllowedHttpsUrl = (value: string, allowedHosts?: readonly string[]): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (!Array.isArray(allowedHosts) || !allowedHosts.length) return true;

    const hostname = parsed.hostname.toLowerCase();
    return allowedHosts.some((host) => hostname === host || hostname === `www.${host}` || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

/**
 * 归一化函数组：本文件 `theme-shared/guards.ts`（服务端归一化）与
 * `src/scripts/admin-console/form-codec/`（浏览器端表单编码）共用这一份实现。
 *
 * 两端对同一段文本必须得到相同结果，否则「客户端提交 → 服务端规范化」会漂移；
 * 因此这里全部导出，`form-codec/` 只 import、不再复制。
 */

export const normalizeMultiline = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

export const normalizeTrimmed = (value: unknown): string => String(value ?? '').trim();

export const normalizeOptionalSingleLine = (value: string): string | null => {
  const normalized = normalizeMultiline(value).trim();
  return normalized ? normalized : null;
};

/**
 * 单行文本归一化。`rejectMultiline` 是两端唯一的差异点：
 * 服务端规范化保留换行（后续校验再判定），后台表单读取单行输入框时含换行即视为无效、回退默认值。
 */
export const normalizeSingleLine = (
  value: unknown,
  fallback = '',
  options: { rejectMultiline?: boolean } = {}
): string => {
  const normalized = normalizeMultiline(String(value ?? '')).trim();
  if (options.rejectMultiline === true && normalized.includes('\n')) return fallback;
  return normalized || fallback;
};

export const normalizeNavOrnament = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string') return ADMIN_NAV_ORNAMENT_DEFAULT;
  const normalized = normalizeMultiline(value).trim();
  return normalized || null;
};

export const normalizeEmail = (value: string): string => value.replace(/^mailto:/i, '').trim();

export const parseOrder = (value: string | number | null | undefined, fallback: number): number => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : fallback;
};

export const parseInteger = (value: string | number | null | undefined): number | null => {
  const next = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(next) ? next : null;
};

/** 站点标题宽度百分比：缺失 / 非法 → 默认 35%，越界夹取到 10–100。 */
export const clampSiteTitlePercent = (value: number | null): number => {
  if (value === null) return ADMIN_SITE_TITLE_PERCENT_DEFAULT;
  return Math.min(Math.max(value, ADMIN_SITE_TITLE_PERCENT_MIN), ADMIN_SITE_TITLE_PERCENT_MAX);
};

/** 页面外缘间隙：缺失 / 非法 → 默认 32，越界夹取到 32–160。 */
export const clampSitePageGap = (value: number | null): number => {
  if (value === null) return ADMIN_SITE_PAGE_GAP_DEFAULT;
  return Math.min(Math.max(value, ADMIN_SITE_PAGE_GAP_MIN), ADMIN_SITE_PAGE_GAP_MAX);
};

/** 窄屏浮动列右侧距离：缺失 / 非法 → 默认 6，越界夹取到 0–32。 */
export const clampSiteRailOffset = (value: number | null): number => {
  if (value === null) return ADMIN_SITE_RAIL_OFFSET_DEFAULT;
  return Math.min(Math.max(value, ADMIN_SITE_RAIL_OFFSET_MIN), ADMIN_SITE_RAIL_OFFSET_MAX);
};

export const defaultNormalizeCustomSocialLabel = (value: unknown): string => normalizeTrimmed(value);

export const cloneCustomItems = (
  items: ReadonlyArray<EditableThemeSettings['site']['socialLinks']['custom'][number]>
): EditableThemeSettings['site']['socialLinks']['custom'] =>
  items.map((item) => ({ ...item }));

export const cloneNavItems = (
  items: ReadonlyArray<EditableThemeSettings['shell']['nav'][number]>
): EditableThemeSettings['shell']['nav'] =>
  items.map((item) => ({ ...item }));

export const normalizeHomeIntroLinks = (value: unknown): HomeIntroLinkKey[] => {
  const defaultHomeIntroLinks = [...ADMIN_HOME_INTRO_LINK_DEFAULT] as HomeIntroLinkKey[];
  if (!Array.isArray(value)) return defaultHomeIntroLinks;

  const normalized: HomeIntroLinkKey[] = [];
  const seen = new Set<HomeIntroLinkKey>();

  value.forEach((item) => {
    const rawValue = normalizeTrimmed(item);
    if (!rawValue || !isAdminHomeIntroLinkKey(rawValue)) return;
    const linkKey = rawValue as HomeIntroLinkKey;
    if (seen.has(linkKey) || normalized.length >= ADMIN_HOME_INTRO_LINK_LIMIT) return;
    normalized.push(linkKey);
    seen.add(linkKey);
  });

  return normalized.length ? normalized : defaultHomeIntroLinks;
};

