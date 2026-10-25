import type {
  SiteSocialIconKey,
  SiteSocialPresetId,
  ThemeSettingsEditablePayload
} from '@/lib/theme-settings';
import {
  createWithBase,
  normalizeHeroImageSrc as normalizeHeroImageSrcValue,
  normalizeSiteFaviconPath,
  type SiteFaviconSlot
} from '@/utils/format';
import {
  ADMIN_HERO_IMAGE_ALT_DEFAULT,
  ADMIN_PAGINATION_DEFAULTS,
  ADMIN_PAGINATION_SCOPES,
  normalizeSingleLine as normalizeSingleLineValue,
  normalizeTrimmed,
  parseInteger
} from '@/lib/admin-console/theme-shared';

export type EditableSettings = ThemeSettingsEditablePayload['settings'];
export type EditableCustomSocialItem = EditableSettings['site']['socialLinks']['custom'][number];
export type EditableNavItem = EditableSettings['shell']['nav'][number];
export type SocialPresetOrder = Record<SiteSocialPresetId, number>;

type Query = <T extends Element>(parent: ParentNode, selector: string) => T | null;

const base = import.meta.env.BASE_URL ?? '/';
export const withBase = createWithBase(base);

export type FormCodecContext = {
  footerStartYearMax: number;
  query: Query;
  getNavRows: () => HTMLElement[];
  getCustomRows: () => HTMLElement[];
  getCustomRowLabelInput: (row: Element | null) => HTMLInputElement | null;
  defaultCustomSocialIconKey: SiteSocialIconKey;
  normalizeCustomSocialLabel: (value: unknown, iconKey: SiteSocialIconKey) => string;
  replaceCustomRows: (items: EditableCustomSocialItem[]) => void;
  normalizeSocialOrders: () => void;
  getPresetSocialOrder: () => SocialPresetOrder;
  articleMetaPreviewValueEl: HTMLElement;
  footerPreviewValueEl: HTMLElement;
  homeIntroMorePreviewEl: HTMLElement;
  homeIntroMoreLinkSecondaryGroupEl: HTMLElement;
  inputSiteTitle: HTMLInputElement;
  inputShellTitleNarrow: HTMLInputElement;
  inputSiteDescription: HTMLTextAreaElement;
  inputSiteDefaultLocale: HTMLInputElement;
  inputSiteTimezone: HTMLInputElement;
  inputSiteTitleMaxPercent: HTMLInputElement;
  inputSitePageGapPx: HTMLInputElement;
  inputSiteRailOffsetPx: HTMLInputElement;
  inputPageListRssEnabled: HTMLInputElement;
  inputPageListRssBlog: HTMLInputElement;
  inputPageListRssBits: HTMLInputElement;
  inputPageListRssArchive: HTMLInputElement;
  inputPageArchiveVersionMode: HTMLSelectElement;
  inputUiArticleDateDisplay: HTMLSelectElement;
  inputUiArticleDateGranularity: HTMLSelectElement;
  inputUiCardDateDisplay: HTMLSelectElement;
  pageListRssGroupEl: HTMLElement;
  inputSiteFooterStartYear: HTMLInputElement;
  inputSiteFooterShowCurrentYear: HTMLInputElement;
  inputSiteFooterCopyright: HTMLInputElement;
  inputSiteFilingsIcpNumber: HTMLInputElement;
  inputSiteFilingsIcpLink: HTMLInputElement;
  inputSiteFilingsPoliceNumber: HTMLInputElement;
  inputSiteFilingsPoliceLink: HTMLInputElement;
  inputSiteFilingsPoliceIcon: HTMLInputElement;
  inputSiteFilingsScope: HTMLSelectElement;
  filingsPreviewValueEl: HTMLElement;
  filingsIconPreviewEl: HTMLElement;
  inputSiteAdminOverviewPublicVisible: HTMLInputElement;
  inputSiteAdminOverviewHiddenMessage: HTMLInputElement;
  inputSiteFaviconSvg: HTMLInputElement;
  inputSiteFaviconPng: HTMLInputElement;
  inputSiteFaviconAppleTouchIcon: HTMLInputElement;
  inputSiteSocialGithubOrder: HTMLInputElement;
  inputSiteSocialGithub: HTMLInputElement;
  inputSiteSocialXOrder: HTMLInputElement;
  inputSiteSocialX: HTMLInputElement;
  inputSiteSocialEmailOrder: HTMLInputElement;
  inputSiteSocialEmail: HTMLInputElement;
  inputShellBrandTitle: HTMLTextAreaElement;
  inputShellQuote: HTMLTextAreaElement;
  inputHomeShowIntroLead: HTMLInputElement;
  inputHomeShowIntroMore: HTMLInputElement;
  inputHomeIntroLead: HTMLTextAreaElement;
  inputHomeIntroMore: HTMLTextAreaElement;
  inputHomeIntroMoreLinkPrimary: HTMLSelectElement;
  inputHomeIntroMoreLinkSecondaryEnabled: HTMLInputElement;
  inputHomeIntroMoreLinkSecondary: HTMLSelectElement;
  inputPageBlogTitle: HTMLInputElement;
  inputPageBlogSubtitle: HTMLInputElement;
  inputPageProjectsTitle: HTMLInputElement;
  inputPageProjectsSubtitle: HTMLInputElement;
  inputPageArchiveTitle: HTMLInputElement;
  inputPageArchiveSubtitle: HTMLInputElement;
  inputPageBitsTitle: HTMLInputElement;
  inputPageBitsSubtitle: HTMLInputElement;
  inputPageDevlogTitle: HTMLInputElement;
  inputPageDevlogSubtitle: HTMLInputElement;
  inputPageAboutTitle: HTMLInputElement;
  inputPageAboutSubtitle: HTMLInputElement;
  inputArticleMetaShowDate: HTMLInputElement;
  inputArticleMetaDateLabel: HTMLInputElement;
  inputArticleMetaShowTags: HTMLInputElement;
  inputArticleMetaShowWordCount: HTMLInputElement;
  inputArticleMetaShowReadingTime: HTMLInputElement;
  inputPageBitsAuthorName: HTMLInputElement;
  inputPageBitsAuthorAvatar: HTMLInputElement;
  inputHomeShowHero: HTMLInputElement;
  inputHeroImageSrc: HTMLInputElement;
  inputHeroImageAlt: HTMLInputElement;
  inputCodeLineNumbers: HTMLInputElement;
  inputReadingEntry: HTMLInputElement;
  inputFloatStackShowResumeReading: HTMLInputElement;
  inputFloatStackShowScrollTop: HTMLInputElement;
  inputViewStatsShowPv: HTMLInputElement;
  inputViewStatsPvLabel: HTMLInputElement;
  inputViewStatsShowUv: HTMLInputElement;
  inputViewStatsUvLabel: HTMLInputElement;
  inputViewStatsOnArticleMeta: HTMLInputElement;
  inputViewStatsOnIndexPages: HTMLInputElement;
  viewStatsPreviewMetaEl: HTMLElement;
  viewStatsPreviewFooterEl: HTMLElement;
  inputSidebarActionsShowRssLink: HTMLInputElement;
  inputSidebarActionsShowThemeToggle: HTMLInputElement;
  inputSidebarActionsShowAdminEntry: HTMLInputElement;
  sidebarAdminEntryRowEl: HTMLElement;
  inputSidebarDividerDefault: HTMLInputElement;
  inputSidebarDividerSubtle: HTMLInputElement;
  inputSidebarDividerNone: HTMLInputElement;
  inputTypographyReadable: HTMLElement;
  inputTypographyCopy: HTMLElement;
  inputTypographyMono: HTMLElement;
  inputTypographyBrand: HTMLElement;
  inputFontCoverage: HTMLSelectElement;
  inputEntryVersionName: HTMLSelectElement;
};

/**
 * 归一化函数复用服务端实现：经 `theme-shared.ts` 桶导出，实现在
 * `theme-shared/guards.ts`。两端必须同源，各自复制一份会让
 * 「客户端提交 → 服务端规范化」对同一段文本得出不同结果。
 *
 * `normalizeSingleLine` 在这里额外拒绝换行：表单读的是单行输入框，
 * 含换行的值按无效处理并回退默认值；服务端则保留换行，交给后续校验判定。
 */
export const normalizeSingleLine = (value: unknown, fallback = ''): string =>
  normalizeSingleLineValue(value, fallback, { rejectMultiline: true });

export const paginationInput = (
  scope: (typeof ADMIN_PAGINATION_SCOPES)[number],
  field: 'enabled' | 'size'
): HTMLInputElement | null =>
  document.getElementById(`page-pagination-${scope}-${field}`) as HTMLInputElement | null;

const readPaginationScope = (
  scope: (typeof ADMIN_PAGINATION_SCOPES)[number]
): { enabled: boolean; pageSize: number } => {
  const enabledInput = paginationInput(scope, 'enabled');
  const sizeInput = paginationInput(scope, 'size');
  const fallback = ADMIN_PAGINATION_DEFAULTS[scope];
  return {
    enabled: enabledInput ? Boolean(enabledInput.checked) : fallback.enabled,
    pageSize: parseInteger(sizeInput?.value ?? null) ?? fallback.pageSize
  };
};

export const readPaginationSettings = (): EditableSettings['page']['pagination'] => ({
  home: readPaginationScope('home'),
  blog: readPaginationScope('blog'),
  bits: readPaginationScope('bits'),
  devlog: readPaginationScope('devlog'),
  archive: readPaginationScope('archive')
});

export const normalizeHeroImageInput = (value: unknown): string | null => {
  const rawValue = normalizeTrimmed(value);
  if (!rawValue) return null;
  return normalizeHeroImageSrcValue(rawValue) ?? rawValue;
};

export const normalizeHeroImageAlt = (value: unknown): string => {
  const rawValue = normalizeTrimmed(value);
  return rawValue || ADMIN_HERO_IMAGE_ALT_DEFAULT;
};

export const normalizeSiteFaviconInput = (slot: SiteFaviconSlot, value: unknown): string | null => {
  const rawValue = normalizeTrimmed(value);
  if (!rawValue) return null;
  return normalizeSiteFaviconPath(slot, rawValue) ?? rawValue;
};
