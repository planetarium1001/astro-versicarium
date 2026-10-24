import type { EditableThemeSettings, SiteSocialIconKey } from '../../theme-settings';
import { asThemeFontIdForRole } from '../../fonts/registry';
import { normalizeEntryVersionNameMode } from '../../entry-display';
import {
  normalizeHeroImageSrc as normalizeAdminHeroImageSrc,
  normalizeSiteFaviconPath as normalizeAdminSiteFaviconPath,
  normalizeSiteFilingIconPath as normalizeAdminSiteFilingIconPath,
  type SiteFaviconSlot
} from '../../../utils/format';
import { isRecord, type LooseRecord } from '../../is-record';
import {
  ADMIN_ARCHIVE_VERSION_MODE_DEFAULT,
  ADMIN_ARTICLE_DATE_DISPLAY_DEFAULT,
  ADMIN_ARTICLE_DATE_GRANULARITY_DEFAULT,
  ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT,
  ADMIN_FILINGS_SCOPE_DEFAULT,
  ADMIN_FONT_COVERAGE_DEFAULT,
  ADMIN_HERO_IMAGE_ALT_DEFAULT,
  ADMIN_NAV_IDS,
  ADMIN_OVERVIEW_HIDDEN_MESSAGE_DEFAULT,
  ADMIN_PAGINATION_DEFAULTS,
  ADMIN_PAGINATION_PAGE_SIZE_MAX,
  ADMIN_PAGINATION_PAGE_SIZE_MIN,
  ADMIN_SIDEBAR_DIVIDER_DEFAULT,
  ADMIN_SOCIAL_PRESET_ORDER_DEFAULT,
  ADMIN_TYPOGRAPHY_DEFAULT,
  ADMIN_VIEW_STATS_PV_LABEL_DEFAULT,
  ADMIN_VIEW_STATS_UV_LABEL_DEFAULT,
  type AdminPaginationScope
} from './constants';
import {
  clampSitePageGap,
  clampSiteRailOffset,
  clampSiteTitlePercent,
  cloneCustomItems,
  cloneNavItems,
  defaultNormalizeCustomSocialLabel,
  getAdminFooterStartYearMax,
  isAdminArchiveVersionMode,
  isAdminArticleDateDisplayMode,
  isAdminArticleDateGranularity,
  isAdminFilingsScope,
  isAdminFontCoverage,
  isAdminHeroPresetId,
  isAdminNavId,
  isAdminSidebarDividerVariant,
  normalizeAdminSocialIconKey,
  normalizeEmail,
  normalizeHomeIntroLinks,
  normalizeMultiline,
  normalizeNavOrnament,
  normalizeOptionalSingleLine,
  normalizeSingleLine,
  normalizeTrimmed,
  parseInteger,
  parseOrder
} from './guards';

export type AdminWritableThemeSettingsGroups = {
  site: EditableThemeSettings['site'];
  shell: EditableThemeSettings['shell'];
  home: EditableThemeSettings['home'];
  page: EditableThemeSettings['page'];
  ui: EditableThemeSettings['ui'];
};

type AdminThemeSettingsCanonicalizeOptions = {
  footerStartYearMax?: number;
  defaultCustomSocialIconKey?: SiteSocialIconKey;
  normalizeCustomSocialLabel?: (value: unknown, iconKey: SiteSocialIconKey) => string;
};

export const canonicalizeAdminThemeSettings = (
  settings: unknown,
  options: AdminThemeSettingsCanonicalizeOptions = {}
): EditableThemeSettings => {
  type SortableCustomItem = EditableThemeSettings['site']['socialLinks']['custom'][number] & { __index: number };

  const {
    footerStartYearMax = getAdminFooterStartYearMax(),
    defaultCustomSocialIconKey = 'website',
    normalizeCustomSocialLabel = defaultNormalizeCustomSocialLabel
  } = options;

  const next = isRecord(settings) ? settings : {};
  const site = isRecord(next.site) ? next.site : {};
  const shell = isRecord(next.shell) ? next.shell : {};
  const home = isRecord(next.home) ? next.home : {};
  const page = isRecord(next.page) ? next.page : {};
  const ui = isRecord(next.ui) ? next.ui : {};
  const siteFooter = isRecord(site.footer) ? site.footer : {};
  const adminOverview = isRecord(site.adminOverview) ? site.adminOverview : {};
  const socialLinks = isRecord(site.socialLinks) ? site.socialLinks : {};
  const customItems = Array.isArray(socialLinks.custom) ? socialLinks.custom : [];
  const bitsPage = isRecord(page.bits) ? page.bits : {};
  const pageArchive = isRecord(page.archive) ? page.archive : {};
  const rawListRss = isRecord(page.listRss) ? page.listRss : {};
  const bitsDefaultAuthor = isRecord(bitsPage.defaultAuthor) ? bitsPage.defaultAuthor : {};
  const rawPresetOrder = isRecord(socialLinks.presetOrder) ? socialLinks.presetOrder : {};
  const rawFilings = isRecord(site.filings) ? site.filings : {};
  const rawFilingsIcp = isRecord(rawFilings.icp) ? rawFilings.icp : {};
  const rawFilingsPolice = isRecord(rawFilings.police) ? rawFilings.police : {};
  const rawFilingsScope = normalizeTrimmed(rawFilings.scope);
  const rawUiArticleMeta: LooseRecord = isRecord(ui.articleMeta) ? ui.articleMeta : {};
  const canonicalPaginationScope = (scope: AdminPaginationScope): { enabled: boolean; pageSize: number } => {
    const rawScope = isRecord(page.pagination) && isRecord(page.pagination[scope])
      ? page.pagination[scope]
      : undefined;
    const fallback = ADMIN_PAGINATION_DEFAULTS[scope];
    const pageSize = parseInteger(rawScope?.pageSize as string | number | null | undefined) ?? fallback.pageSize;
    return {
      enabled: typeof rawScope?.enabled === 'boolean' ? rawScope.enabled : fallback.enabled,
      pageSize: Math.min(
        Math.max(pageSize, ADMIN_PAGINATION_PAGE_SIZE_MIN),
        ADMIN_PAGINATION_PAGE_SIZE_MAX
      )
    };
  };
  const rawUiFloatStack: LooseRecord = isRecord(ui.floatStack) ? ui.floatStack : {};
  const rawUiViewStats: LooseRecord = isRecord(ui.viewStats) ? ui.viewStats : {};
  const rawUiSidebarActions: LooseRecord = isRecord(ui.sidebarActions) ? ui.sidebarActions : {};
  const rawUiLayout: LooseRecord = isRecord(ui.layout) ? ui.layout : {};
  const rawUiTypography: LooseRecord = isRecord(ui.typography) ? ui.typography : {};
  const rawHeroPresetId = normalizeTrimmed(home.heroPresetId);
  const heroPresetId = isAdminHeroPresetId(rawHeroPresetId) ? rawHeroPresetId : 'default';
  const rawSidebarDivider = normalizeTrimmed(rawUiLayout.sidebarDivider);
  const rawTypographyReadable = normalizeTrimmed(rawUiTypography.readable);
  const rawTypographyCopy = normalizeTrimmed(rawUiTypography.copy);
  const rawTypographyMono = normalizeTrimmed(rawUiTypography.mono);
  const rawTypographyBrand = normalizeTrimmed(rawUiTypography.brand);

  const normalizedCustom: EditableThemeSettings['site']['socialLinks']['custom'] = customItems
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      const iconKey = normalizeAdminSocialIconKey(record.iconKey) ?? defaultCustomSocialIconKey;
      const sortableItem: SortableCustomItem = {
        id: normalizeTrimmed(record.id),
        label: normalizeCustomSocialLabel(record.label, iconKey),
        href: normalizeTrimmed(record.href),
        iconKey,
        visible: Boolean(record.visible),
        order: parseOrder(record.order as string | number | null | undefined, index + 1),
        __index: index
      };
      return sortableItem;
    })
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      const idCompare = a.id.localeCompare(b.id);
      if (idCompare !== 0) return idCompare;
      return a.__index - b.__index;
    })
    .map(({ __index: _ignored, ...item }) => item);

  const normalizedNav = (Array.isArray(shell.nav) ? shell.nav : [])
    .map((item) => {
      const record = isRecord(item) ? item : null;
      if (!record) return null;
      const id = normalizeTrimmed(record.id);
      if (!isAdminNavId(id)) return null;
      return {
        id,
        label: normalizeTrimmed(record.label),
        ornament: normalizeNavOrnament(record.ornament),
        order: parseOrder(record.order as string | number | null | undefined, ADMIN_NAV_IDS.indexOf(id) + 1),
        visible: Boolean(record.visible)
      };
    })
    .filter((item): item is EditableThemeSettings['shell']['nav'][number] => item !== null)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return ADMIN_NAV_IDS.indexOf(a.id) - ADMIN_NAV_IDS.indexOf(b.id);
    });

  const heroImageSrc = (() => {
    if (heroPresetId === 'none') return null;

    const normalized = normalizeAdminHeroImageSrc(home.heroImageSrc);
    if (normalized === undefined) {
      const rawValue = normalizeTrimmed(home.heroImageSrc);
      return rawValue ? rawValue : null;
    }
    return normalized;
  })();

  const heroImageAlt = (() => {
    if (heroPresetId === 'none') return ADMIN_HERO_IMAGE_ALT_DEFAULT;

    const normalized = normalizeTrimmed(home.heroImageAlt);
    return normalized || ADMIN_HERO_IMAGE_ALT_DEFAULT;
  })();

  const rawFavicon = isRecord(site.favicon) ? site.favicon : {};
  // 图标与 favicon 同策略：合法路径归一化，非法值保留原文交给校验报错
  const canonicalFilingsIcon = (): string | null => {
    const rawValue = rawFilingsPolice.icon;
    if (rawValue === null || rawValue === undefined) return null;

    const normalized = normalizeAdminSiteFilingIconPath(rawValue);
    return normalized === undefined ? (normalizeTrimmed(rawValue) || null) : normalized;
  };

  const canonicalFaviconSlot = (slot: SiteFaviconSlot): string | null => {
    const rawValue = rawFavicon[slot];
    if (rawValue === null || rawValue === undefined) return null;

    const normalized = normalizeAdminSiteFaviconPath(slot, rawValue);
    if (normalized === undefined) {
      const rawText = normalizeTrimmed(rawValue);
      return rawText ? rawText : null;
    }
    return normalized;
  };

  return {
    site: {
      title: normalizeTrimmed(site.title),
      description: normalizeMultiline(String(site.description ?? '')).trim(),
      defaultLocale: normalizeTrimmed(site.defaultLocale),
      timezone: normalizeTrimmed(site.timezone),
      footer: {
        startYear: parseInteger(siteFooter.startYear as string | number | null | undefined) ?? footerStartYearMax,
        showCurrentYear: Boolean(siteFooter.showCurrentYear),
        copyright: normalizeTrimmed(siteFooter.copyright)
      },
      /**
       * 窄屏站点标题宽度百分比。非法 / 缺失 / 越界都回落到默认 35%，并夹取到 10–100。
       */
      titleMaxPercent: clampSiteTitlePercent(parseInteger(site.titleMaxPercent as string | number | null | undefined)),
      /**
       * 页面外缘间隙。非法 / 缺失 / 越界都回落到默认 32，并夹取到 32–160。
       */
      pageGapPx: clampSitePageGap(parseInteger(site.pageGapPx as string | number | null | undefined)),
      /**
       * 窄屏浮动列右侧距离。非法 / 缺失 / 越界都回落到默认 6，并夹取到 0–32。
       */
      railOffsetPx: clampSiteRailOffset(
        parseInteger(site.railOffsetPx as string | number | null | undefined)
      ),
      adminOverview: {
        publicVisible: typeof adminOverview.publicVisible === 'boolean' ? adminOverview.publicVisible : true,
        hiddenMessage: normalizeSingleLine(
          adminOverview.hiddenMessage,
          ADMIN_OVERVIEW_HIDDEN_MESSAGE_DEFAULT
        )
      },
      filings: {
        /* 显示范围：非法 / 缺失都回落到默认 'all'（所有页面） */
        scope: isAdminFilingsScope(rawFilingsScope) ? rawFilingsScope : ADMIN_FILINGS_SCOPE_DEFAULT,
        icp: {
          number: normalizeOptionalSingleLine(String(rawFilingsIcp.number ?? '')),
          link: normalizeOptionalSingleLine(String(rawFilingsIcp.link ?? ''))
        },
        police: {
          number: normalizeOptionalSingleLine(String(rawFilingsPolice.number ?? '')),
          link: normalizeOptionalSingleLine(String(rawFilingsPolice.link ?? '')),
          icon: canonicalFilingsIcon()
        }
      },
      favicon: {
        svg: canonicalFaviconSlot('svg'),
        png: canonicalFaviconSlot('png'),
        appleTouchIcon: canonicalFaviconSlot('appleTouchIcon')
      },
      socialLinks: {
        github: normalizeTrimmed(socialLinks.github) || null,
        x: normalizeTrimmed(socialLinks.x) || null,
        email: normalizeEmail(normalizeTrimmed(socialLinks.email)) || null,
        presetOrder: {
          github: parseOrder(
            rawPresetOrder.github as string | number | null | undefined,
            ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.github
          ),
          x: parseOrder(rawPresetOrder.x as string | number | null | undefined, ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.x),
          email: parseOrder(
            rawPresetOrder.email as string | number | null | undefined,
            ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.email
          )
        },
        custom: normalizedCustom
      }
    },
    shell: {
      brandTitle: normalizeTrimmed(shell.brandTitle),
      /** 窄屏标题：空 / 全空白 / 非字符串一律归为 null，渲染期回落到侧栏站点名。 */
      titleNarrow: normalizeTrimmed(shell.titleNarrow) || null,
      quote: normalizeMultiline(String(shell.quote ?? '')).trim(),
      nav: normalizedNav
    },
    home: {
      introLead: normalizeMultiline(String(home.introLead ?? '')).trim(),
      introMore: normalizeMultiline(String(home.introMore ?? '')).trim(),
      introMoreLinks: normalizeHomeIntroLinks(home.introMoreLinks),
      showIntroLead: typeof home.showIntroLead === 'boolean' ? home.showIntroLead : true,
      showIntroMore: typeof home.showIntroMore === 'boolean' ? home.showIntroMore : true,
      heroPresetId,
      heroImageSrc,
      heroImageAlt
    },
    page: {
      blog: {
        title: normalizeOptionalSingleLine(String(isRecord(page.blog) ? page.blog.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.blog) ? page.blog.subtitle ?? '' : ''))
      },
      projects: {
        title: normalizeOptionalSingleLine(String(isRecord(page.projects) ? page.projects.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.projects) ? page.projects.subtitle ?? '' : ''))
      },
      archive: {
        title: normalizeOptionalSingleLine(String(isRecord(page.archive) ? page.archive.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.archive) ? page.archive.subtitle ?? '' : '')),
        versionMode: isAdminArchiveVersionMode(pageArchive.versionMode)
          ? pageArchive.versionMode
          : ADMIN_ARCHIVE_VERSION_MODE_DEFAULT
      },
      bits: {
        title: normalizeOptionalSingleLine(String(bitsPage.title ?? '')),
        subtitle: normalizeOptionalSingleLine(String(bitsPage.subtitle ?? '')),
        defaultAuthor: {
          name: normalizeTrimmed(bitsDefaultAuthor.name),
          avatar: normalizeTrimmed(bitsDefaultAuthor.avatar)
        }
      },
      devlog: {
        title: normalizeOptionalSingleLine(String(isRecord(page.devlog) ? page.devlog.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.devlog) ? page.devlog.subtitle ?? '' : ''))
      },
      about: {
        title: normalizeOptionalSingleLine(String(isRecord(page.about) ? page.about.title ?? '' : '')),
        subtitle: normalizeOptionalSingleLine(String(isRecord(page.about) ? page.about.subtitle ?? '' : ''))
      },
      /* 列表页描述行的 RSS 开关：总开关 + 三个页面各自可勾，默认全开 */
      listRss: {
        enabled: typeof rawListRss.enabled === 'boolean' ? rawListRss.enabled : true,
        blog: typeof rawListRss.blog === 'boolean' ? rawListRss.blog : true,
        bits: typeof rawListRss.bits === 'boolean' ? rawListRss.bits : true,
        archive: typeof rawListRss.archive === 'boolean' ? rawListRss.archive : true
      },
      pagination: {
        home: canonicalPaginationScope('home'),
        blog: canonicalPaginationScope('blog'),
        bits: canonicalPaginationScope('bits'),
        devlog: canonicalPaginationScope('devlog'),
        archive: canonicalPaginationScope('archive')
      }
    },
    ui: {
      codeBlock: {
        showLineNumbers: Boolean(isRecord(ui.codeBlock) ? ui.codeBlock.showLineNumbers : false)
      },
      readingMode: {
        showEntry: Boolean(isRecord(ui.readingMode) ? ui.readingMode.showEntry : false)
      },
      floatStack: {
        showResumeReading: typeof rawUiFloatStack.showResumeReading === 'boolean'
          ? rawUiFloatStack.showResumeReading
          : true,
        showScrollTop: typeof rawUiFloatStack.showScrollTop === 'boolean'
          ? rawUiFloatStack.showScrollTop
          : true
      },
      viewStats: {
        showPv: typeof rawUiViewStats.showPv === 'boolean' ? rawUiViewStats.showPv : false,
        pvLabel: normalizeSingleLine(rawUiViewStats.pvLabel, ADMIN_VIEW_STATS_PV_LABEL_DEFAULT),
        showUv: typeof rawUiViewStats.showUv === 'boolean' ? rawUiViewStats.showUv : false,
        uvLabel: normalizeSingleLine(rawUiViewStats.uvLabel, ADMIN_VIEW_STATS_UV_LABEL_DEFAULT),
        onArticleMeta: typeof rawUiViewStats.onArticleMeta === 'boolean' ? rawUiViewStats.onArticleMeta : true,
        onIndexPages: typeof rawUiViewStats.onIndexPages === 'boolean' ? rawUiViewStats.onIndexPages : true
      },
      sidebarActions: {
        showRssLink: typeof rawUiSidebarActions.showRssLink === 'boolean' ? rawUiSidebarActions.showRssLink : true,
        showThemeToggle: typeof rawUiSidebarActions.showThemeToggle === 'boolean'
          ? rawUiSidebarActions.showThemeToggle
          : true,
        showAdminEntry: typeof rawUiSidebarActions.showAdminEntry === 'boolean'
          ? rawUiSidebarActions.showAdminEntry
          : false
      },
      articleMeta: {
        showDate: typeof rawUiArticleMeta.showDate === 'boolean' ? rawUiArticleMeta.showDate : true,
        dateLabel: normalizeSingleLine(rawUiArticleMeta.dateLabel, ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT),
        dateDisplay: isAdminArticleDateDisplayMode(rawUiArticleMeta.dateDisplay)
          ? rawUiArticleMeta.dateDisplay
          : ADMIN_ARTICLE_DATE_DISPLAY_DEFAULT,
        dateGranularity: isAdminArticleDateGranularity(rawUiArticleMeta.dateGranularity)
          ? rawUiArticleMeta.dateGranularity
          : ADMIN_ARTICLE_DATE_GRANULARITY_DEFAULT,
        showTags: typeof rawUiArticleMeta.showTags === 'boolean' ? rawUiArticleMeta.showTags : true,
        showWordCount: typeof rawUiArticleMeta.showWordCount === 'boolean' ? rawUiArticleMeta.showWordCount : true,
        showReadingTime: typeof rawUiArticleMeta.showReadingTime === 'boolean'
          ? rawUiArticleMeta.showReadingTime
          : true
      },
      cardDateDisplay: isAdminArticleDateDisplayMode(ui.cardDateDisplay)
        ? ui.cardDateDisplay
        : ADMIN_ARTICLE_DATE_DISPLAY_DEFAULT,
      layout: {
        sidebarDivider: isAdminSidebarDividerVariant(rawSidebarDivider)
          ? rawSidebarDivider
          : ADMIN_SIDEBAR_DIVIDER_DEFAULT
      },
      typography: {
        readable: asThemeFontIdForRole('readable', rawTypographyReadable)
          ?? ADMIN_TYPOGRAPHY_DEFAULT.readable,
        copy: asThemeFontIdForRole('copy', rawTypographyCopy) ?? ADMIN_TYPOGRAPHY_DEFAULT.copy,
        mono: asThemeFontIdForRole('mono', rawTypographyMono) ?? ADMIN_TYPOGRAPHY_DEFAULT.mono,
        brand: asThemeFontIdForRole('brand', rawTypographyBrand) ?? ADMIN_TYPOGRAPHY_DEFAULT.brand
      },
      fontCoverage: isAdminFontCoverage(ui.fontCoverage) ? ui.fontCoverage : ADMIN_FONT_COVERAGE_DEFAULT,
      entryVersionName: normalizeEntryVersionNameMode(ui.entryVersionName)
    }
  };
};

export const createAdminWritableThemeSettingsGroups = (
  settings: EditableThemeSettings
): AdminWritableThemeSettingsGroups => ({
  site: {
    title: settings.site.title,
    description: settings.site.description,
    defaultLocale: settings.site.defaultLocale,
    timezone: settings.site.timezone,
    titleMaxPercent: settings.site.titleMaxPercent,
    pageGapPx: settings.site.pageGapPx,
    railOffsetPx: settings.site.railOffsetPx,
    footer: {
      ...settings.site.footer
    },
    filings: {
      scope: settings.site.filings.scope,
      icp: { ...settings.site.filings.icp },
      police: { ...settings.site.filings.police }
    },
    adminOverview: {
      ...settings.site.adminOverview
    },
    favicon: {
      ...settings.site.favicon
    },
    socialLinks: {
      github: settings.site.socialLinks.github,
      x: settings.site.socialLinks.x,
      email: settings.site.socialLinks.email,
      presetOrder: {
        ...settings.site.socialLinks.presetOrder
      },
      custom: cloneCustomItems(settings.site.socialLinks.custom)
    }
  },
  shell: {
    brandTitle: settings.shell.brandTitle,
    titleNarrow: settings.shell.titleNarrow,
    quote: settings.shell.quote,
    nav: cloneNavItems(settings.shell.nav)
  },
  home: {
    ...settings.home,
    introMoreLinks: [...settings.home.introMoreLinks]
  },
  page: {
    listRss: { ...settings.page.listRss },
    blog: { ...settings.page.blog },
    projects: { ...settings.page.projects },
    archive: { ...settings.page.archive },
    bits: {
      title: settings.page.bits.title,
      subtitle: settings.page.bits.subtitle,
      defaultAuthor: {
        ...settings.page.bits.defaultAuthor
      }
    },
    devlog: { ...settings.page.devlog },
    about: { ...settings.page.about },
    pagination: {
      home: { ...settings.page.pagination.home },
      blog: { ...settings.page.pagination.blog },
      bits: { ...settings.page.pagination.bits },
      devlog: { ...settings.page.pagination.devlog },
      archive: { ...settings.page.pagination.archive }
    }
  },
  ui: {
    codeBlock: { ...settings.ui.codeBlock },
    readingMode: { ...settings.ui.readingMode },
    floatStack: { ...settings.ui.floatStack },
    viewStats: { ...settings.ui.viewStats },
    sidebarActions: { ...settings.ui.sidebarActions },
    articleMeta: { ...settings.ui.articleMeta },
    cardDateDisplay: settings.ui.cardDateDisplay,
    layout: { ...settings.ui.layout },
    typography: { ...settings.ui.typography },
    fontCoverage: settings.ui.fontCoverage,
    entryVersionName: settings.ui.entryVersionName
  }
});
