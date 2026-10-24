import type {
  ArticleDateGranularity,
  FontCoverage,
  SidebarDividerVariant,
  SiteFilingsScope,
  ThemeFontId,
  TypographyRole,
  TypographySettings
} from '@/lib/theme-settings';
import { normalizeEntryVersionNameMode } from '@/lib/entry-display';
import {
  ADMIN_ARTICLE_DATE_GRANULARITY_DEFAULT,
  ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT,
  ADMIN_FILINGS_SCOPE_DEFAULT,
  ADMIN_FONT_COVERAGE_DEFAULT,
  ADMIN_HERO_IMAGE_ALT_DEFAULT,
  ADMIN_OVERVIEW_HIDDEN_MESSAGE_DEFAULT,
  ADMIN_PAGINATION_DEFAULTS,
  ADMIN_PAGINATION_SCOPES,
  ADMIN_SIDEBAR_DIVIDER_DEFAULT,
  ADMIN_SITE_PAGE_GAP_DEFAULT,
  ADMIN_SITE_RAIL_OFFSET_DEFAULT,
  ADMIN_SITE_TITLE_PERCENT_DEFAULT,
  ADMIN_SITE_TIMEZONE_DEFAULT,
  ADMIN_SOCIAL_PRESET_ORDER_DEFAULT,
  ADMIN_TYPOGRAPHY_DEFAULT,
  ADMIN_VIEW_STATS_PV_LABEL_DEFAULT,
  ADMIN_VIEW_STATS_UV_LABEL_DEFAULT,
  canonicalizeAdminThemeSettings,
  isAdminArticleDateGranularity,
  isAdminFilingsScope,
  isAdminFontCoverage,
  isAdminTypographyFontId,
  normalizeEmail,
  normalizeHomeIntroLinks,
  normalizeMultiline,
  normalizeOptionalSingleLine,
  parseInteger
} from '@/lib/admin-console/theme-shared';
import {
  normalizeHeroImageAlt,
  normalizeHeroImageInput,
  normalizeSiteFaviconInput,
  normalizeSingleLine,
  paginationInput,
  readPaginationSettings,
  type EditableSettings,
  type FormCodecContext
} from './context';
import type { HomeIntroCodec } from './home-intro';
import type { NavSocialCodec } from './nav-social';
import type { PreviewCodec } from './previews';

export type SettingsCodec = {
  canonicalize: (settings: unknown) => EditableSettings;
  collectSettings: () => EditableSettings;
  applySettings: (settings: EditableSettings) => void;
  refreshFontCoveragePreview: () => void;
};

export type SettingsCodecDeps = {
  homeIntro: HomeIntroCodec;
  navSocial: NavSocialCodec;
  previews: PreviewCodec;
};

export const createSettingsCodec = (
  context: FormCodecContext,
  deps: SettingsCodecDeps
): SettingsCodec => {
  const { homeIntro, navSocial, previews } = deps;
  const {
    footerStartYearMax,
    query,
    defaultCustomSocialIconKey,
    normalizeCustomSocialLabel,
    replaceCustomRows,
    normalizeSocialOrders,
    getPresetSocialOrder,
    inputSiteTitle,
    inputShellTitleNarrow,
    inputSiteDescription,
    inputSiteDefaultLocale,
    inputSiteTimezone,
    inputSiteTitleMaxPercent,
    inputSitePageGapPx,
    inputSiteRailOffsetPx,
    inputPageListRssEnabled,
    inputPageListRssBlog,
    inputPageListRssBits,
    inputPageListRssArchive,
    inputPageArchiveVersionMode,
    inputUiArticleDateDisplay,
    inputUiCardDateDisplay,
    inputSiteFooterStartYear,
    inputSiteFooterShowCurrentYear,
    inputSiteFooterCopyright,
    inputSiteFilingsIcpNumber,
    inputSiteFilingsIcpLink,
    inputSiteFilingsPoliceNumber,
    inputSiteFilingsPoliceLink,
    inputSiteFilingsPoliceIcon,
    inputSiteFilingsScope,
    inputSiteAdminOverviewPublicVisible,
    inputSiteAdminOverviewHiddenMessage,
    inputSiteFaviconSvg,
    inputSiteFaviconPng,
    inputSiteFaviconAppleTouchIcon,
    inputSiteSocialGithubOrder,
    inputSiteSocialGithub,
    inputSiteSocialXOrder,
    inputSiteSocialX,
    inputSiteSocialEmailOrder,
    inputSiteSocialEmail,
    inputShellBrandTitle,
    inputShellQuote,
    inputHomeShowIntroLead,
    inputHomeShowIntroMore,
    inputHomeIntroLead,
    inputHomeIntroMore,
    inputHomeIntroMoreLinkPrimary,
    inputHomeIntroMoreLinkSecondaryEnabled,
    inputHomeIntroMoreLinkSecondary,
    inputPageBlogTitle,
    inputPageBlogSubtitle,
    inputPageProjectsTitle,
    inputPageProjectsSubtitle,
    inputPageArchiveTitle,
    inputPageArchiveSubtitle,
    inputPageBitsTitle,
    inputPageBitsSubtitle,
    inputPageDevlogTitle,
    inputPageDevlogSubtitle,
    inputPageAboutTitle,
    inputPageAboutSubtitle,
    inputArticleMetaShowDate,
    inputArticleMetaDateLabel,
    inputArticleMetaShowTags,
    inputArticleMetaShowWordCount,
    inputArticleMetaShowReadingTime,
    inputPageBitsAuthorName,
    inputPageBitsAuthorAvatar,
    inputHomeShowHero,
    inputHeroImageSrc,
    inputHeroImageAlt,
    inputCodeLineNumbers,
    inputReadingEntry,
    inputFloatStackShowResumeReading,
    inputFloatStackShowScrollTop,
    inputViewStatsShowPv,
    inputViewStatsPvLabel,
    inputViewStatsShowUv,
    inputViewStatsUvLabel,
    inputViewStatsOnArticleMeta,
    inputViewStatsOnIndexPages,
    inputSidebarActionsShowRssLink,
    inputSidebarActionsShowThemeToggle,
    inputSidebarActionsShowAdminEntry,
    inputEntryVersionName,
    inputFontCoverage,
    inputSidebarDividerDefault,
    inputSidebarDividerNone,
    inputSidebarDividerSubtle,
    inputTypographyBrand,
    inputTypographyCopy,
    inputTypographyMono,
    inputTypographyReadable,
    inputUiArticleDateGranularity,
  } = context;

  const getSelectedSidebarDividerVariant = (): SidebarDividerVariant => {
    if (inputSidebarDividerSubtle.checked) return 'subtle';
    if (inputSidebarDividerNone.checked) return 'none';
    return ADMIN_SIDEBAR_DIVIDER_DEFAULT;
  };

  const applySidebarDividerVariant = (value: SidebarDividerVariant): void => {
    inputSidebarDividerDefault.checked = value === 'default';
    inputSidebarDividerSubtle.checked = value === 'subtle';
    inputSidebarDividerNone.checked = value === 'none';
  };

  const getSelectedFilingsScope = (): SiteFilingsScope => {
    const value = inputSiteFilingsScope.value;
    return isAdminFilingsScope(value) ? value : ADMIN_FILINGS_SCOPE_DEFAULT;
  };

  const getSelectedArticleDateGranularity = (): ArticleDateGranularity => {
    const value = inputUiArticleDateGranularity.value;
    return isAdminArticleDateGranularity(value) ? value : ADMIN_ARTICLE_DATE_GRANULARITY_DEFAULT;
  };

  const applyArticleDateGranularity = (value: unknown): void => {
    inputUiArticleDateGranularity.value = isAdminArticleDateGranularity(value)
      ? value
      : ADMIN_ARTICLE_DATE_GRANULARITY_DEFAULT;
  };

  const typographyGroups: Record<TypographyRole, HTMLElement> = {
    readable: inputTypographyReadable,
    copy: inputTypographyCopy,
    mono: inputTypographyMono,
    brand: inputTypographyBrand
  };

  const getCheckedTypographyRadio = (role: TypographyRole): HTMLInputElement | null =>
    query<HTMLInputElement>(typographyGroups[role], 'input[type="radio"]:checked');

  const getSelectedTypographyFontId = (role: TypographyRole): ThemeFontId => {
    const rawValue = getCheckedTypographyRadio(role)?.value.trim() ?? '';
    return isAdminTypographyFontId(role, rawValue) ? rawValue : ADMIN_TYPOGRAPHY_DEFAULT[role];
  };

  const applyTypographySettings = (typography: TypographySettings | undefined): void => {
    (Object.keys(typographyGroups) as TypographyRole[]).forEach((role) => {
      const rawValue = typography?.[role] ?? '';
      const nextValue = isAdminTypographyFontId(role, rawValue) ? rawValue : ADMIN_TYPOGRAPHY_DEFAULT[role];
      const radio = query<HTMLInputElement>(typographyGroups[role], `input[type="radio"][value="${nextValue}"]`);
      if (radio) radio.checked = true;
    });
  };

  const getSelectedFontCoverage = (): FontCoverage => {
    const rawValue = inputFontCoverage.value.trim();
    return isAdminFontCoverage(rawValue) ? rawValue : ADMIN_FONT_COVERAGE_DEFAULT;
  };

  const applyFontCoverage = (value: unknown): void => {
    inputFontCoverage.value = isAdminFontCoverage(value) ? value : ADMIN_FONT_COVERAGE_DEFAULT;
  };

  /** 覆盖策略切换时同步切换预算摘要的两种变体（保存前即可看到对应说明）。 */
  const refreshFontCoveragePreview = (): void => {
    const coverage = getSelectedFontCoverage();
    document.querySelectorAll<HTMLElement>('[data-font-coverage-preview]').forEach((preview) => {
      preview.dataset.coverage = coverage;
      preview.querySelectorAll<HTMLElement>('[data-font-coverage-preview-variant]').forEach((variant) => {
        variant.hidden = (variant.dataset.fontCoveragePreviewVariant ?? '') !== coverage;
      });
    });
  };

  const canonicalize = (settings: unknown): EditableSettings =>
    canonicalizeAdminThemeSettings(settings, {
      footerStartYearMax,
      defaultCustomSocialIconKey,
      normalizeCustomSocialLabel
    });
  const collectSettings = (): EditableSettings => {
    const nav = navSocial.collectNavItems();
    const custom = navSocial.collectCustomItems();

    const showHero = Boolean(inputHomeShowHero.checked);

    return {
      site: {
        title: inputSiteTitle.value.trim(),
        description: normalizeMultiline(inputSiteDescription.value).trim(),
        defaultLocale: inputSiteDefaultLocale.value.trim(),
        timezone: inputSiteTimezone.value.trim() || ADMIN_SITE_TIMEZONE_DEFAULT,
        /* 窄屏站点标题宽度百分比（与页面外缘间隙同一行） */
        titleMaxPercent: parseInteger(inputSiteTitleMaxPercent.value) ?? ADMIN_SITE_TITLE_PERCENT_DEFAULT,
        /* 页面外缘间隙（px，内容盒到浏览器边缘的距离） */
        pageGapPx: parseInteger(inputSitePageGapPx.value) ?? ADMIN_SITE_PAGE_GAP_DEFAULT,
        /* 窄屏浮动列到右缘的距离（px，仅 ≤900px 生效） */
        railOffsetPx: parseInteger(inputSiteRailOffsetPx.value) ?? ADMIN_SITE_RAIL_OFFSET_DEFAULT,
        footer: {
          startYear: parseInteger(inputSiteFooterStartYear.value) ?? footerStartYearMax,
          showCurrentYear: Boolean(inputSiteFooterShowCurrentYear.checked),
          copyright: inputSiteFooterCopyright.value.trim()
        },
        filings: {
          scope: getSelectedFilingsScope(),
          icp: {
            number: normalizeSingleLine(inputSiteFilingsIcpNumber.value) || null,
            link: normalizeSingleLine(inputSiteFilingsIcpLink.value) || null
          },
          police: {
            number: normalizeSingleLine(inputSiteFilingsPoliceNumber.value) || null,
            link: normalizeSingleLine(inputSiteFilingsPoliceLink.value) || null,
            icon: normalizeSingleLine(inputSiteFilingsPoliceIcon.value) || null
          }
        },
        adminOverview: {
          publicVisible: Boolean(inputSiteAdminOverviewPublicVisible.checked),
          hiddenMessage: normalizeSingleLine(
            inputSiteAdminOverviewHiddenMessage.value,
            ADMIN_OVERVIEW_HIDDEN_MESSAGE_DEFAULT
          )
        },
        favicon: {
          svg: normalizeSiteFaviconInput('svg', inputSiteFaviconSvg.value),
          png: normalizeSiteFaviconInput('png', inputSiteFaviconPng.value),
          appleTouchIcon: normalizeSiteFaviconInput('appleTouchIcon', inputSiteFaviconAppleTouchIcon.value)
        },
        socialLinks: {
          github: inputSiteSocialGithub.value.trim() || null,
          x: inputSiteSocialX.value.trim() || null,
          email: normalizeEmail(inputSiteSocialEmail.value.trim()) || null,
          presetOrder: getPresetSocialOrder(),
          custom
        }
      },
      shell: {
        brandTitle: normalizeMultiline(inputShellBrandTitle.value).trim(),
        /* 窄屏标题：与侧栏站点名同组，留空表示沿用侧栏站点名 */
        titleNarrow: inputShellTitleNarrow.value.trim() || null,
        quote: normalizeMultiline(inputShellQuote.value).trim(),
        nav
      },
      home: {
        introLead: normalizeMultiline(inputHomeIntroLead.value).trim(),
        introMore: normalizeMultiline(inputHomeIntroMore.value).trim(),
        introMoreLinks: homeIntro.collectHomeIntroLinks(),
        showIntroLead: Boolean(inputHomeShowIntroLead.checked),
        showIntroMore: Boolean(inputHomeShowIntroMore.checked),
        heroPresetId: showHero ? 'default' : 'none',
        heroImageSrc: showHero ? normalizeHeroImageInput(inputHeroImageSrc.value) : null,
        heroImageAlt: showHero ? normalizeHeroImageAlt(inputHeroImageAlt.value) : ADMIN_HERO_IMAGE_ALT_DEFAULT
      },
      page: {
        /* 列表页描述行的 RSS 开关（总开关加三个页面各自可勾） */
        listRss: {
          enabled: Boolean(inputPageListRssEnabled.checked),
          blog: Boolean(inputPageListRssBlog.checked),
          bits: Boolean(inputPageListRssBits.checked),
          archive: Boolean(inputPageListRssArchive.checked)
        },
        blog: {
          title: normalizeOptionalSingleLine(inputPageBlogTitle.value),
          subtitle: normalizeOptionalSingleLine(inputPageBlogSubtitle.value)
        },
        projects: {
          title: normalizeOptionalSingleLine(inputPageProjectsTitle.value),
          subtitle: normalizeOptionalSingleLine(inputPageProjectsSubtitle.value)
        },
        archive: {
          title: normalizeOptionalSingleLine(inputPageArchiveTitle.value),
          subtitle: normalizeOptionalSingleLine(inputPageArchiveSubtitle.value),
          versionMode: inputPageArchiveVersionMode.value as 'all' | 'latest'
        },
        bits: {
          title: normalizeOptionalSingleLine(inputPageBitsTitle.value),
          subtitle: normalizeOptionalSingleLine(inputPageBitsSubtitle.value),
          defaultAuthor: {
            name: inputPageBitsAuthorName.value.trim(),
            avatar: inputPageBitsAuthorAvatar.value.trim()
          }
        },
        devlog: {
          title: normalizeOptionalSingleLine(inputPageDevlogTitle.value),
          subtitle: normalizeOptionalSingleLine(inputPageDevlogSubtitle.value)
        },
        about: {
          title: normalizeOptionalSingleLine(inputPageAboutTitle.value),
          subtitle: normalizeOptionalSingleLine(inputPageAboutSubtitle.value)
        },
        pagination: readPaginationSettings()
      },
      ui: {
        codeBlock: {
          showLineNumbers: Boolean(inputCodeLineNumbers.checked)
        },
        readingMode: {
          showEntry: Boolean(inputReadingEntry.checked)
        },
        floatStack: {
          showResumeReading: Boolean(inputFloatStackShowResumeReading.checked),
          showScrollTop: Boolean(inputFloatStackShowScrollTop.checked)
        },
        viewStats: {
          showPv: Boolean(inputViewStatsShowPv.checked),
          pvLabel: normalizeSingleLine(inputViewStatsPvLabel.value, ADMIN_VIEW_STATS_PV_LABEL_DEFAULT),
          showUv: Boolean(inputViewStatsShowUv.checked),
          uvLabel: normalizeSingleLine(inputViewStatsUvLabel.value, ADMIN_VIEW_STATS_UV_LABEL_DEFAULT),
          onArticleMeta: Boolean(inputViewStatsOnArticleMeta.checked),
          onIndexPages: Boolean(inputViewStatsOnIndexPages.checked)
        },
        sidebarActions: {
          showRssLink: Boolean(inputSidebarActionsShowRssLink.checked),
          showThemeToggle: Boolean(inputSidebarActionsShowThemeToggle.checked),
          showAdminEntry: Boolean(inputSidebarActionsShowAdminEntry.checked)
        },
        articleMeta: {
          showDate: Boolean(inputArticleMetaShowDate.checked),
          dateLabel: normalizeSingleLine(inputArticleMetaDateLabel.value),
          dateDisplay: inputUiArticleDateDisplay.value as 'published' | 'updated' | 'both',
          dateGranularity: getSelectedArticleDateGranularity(),
          showTags: Boolean(inputArticleMetaShowTags.checked),
          showWordCount: Boolean(inputArticleMetaShowWordCount.checked),
          showReadingTime: Boolean(inputArticleMetaShowReadingTime.checked)
        },
        cardDateDisplay: inputUiCardDateDisplay.value as 'published' | 'updated' | 'both',
        layout: {
          sidebarDivider: getSelectedSidebarDividerVariant()
        },
        typography: {
          readable: getSelectedTypographyFontId('readable'),
          copy: getSelectedTypographyFontId('copy'),
          mono: getSelectedTypographyFontId('mono'),
          brand: getSelectedTypographyFontId('brand')
        },
        fontCoverage: getSelectedFontCoverage(),
        entryVersionName: normalizeEntryVersionNameMode(inputEntryVersionName.value)
      }
    };
  };
  const applySettings = (settings: EditableSettings): void => {
    inputSiteTitle.value = settings.site.title || '';
    inputShellTitleNarrow.value = settings.shell.titleNarrow || '';
    inputSiteDescription.value = settings.site.description || '';
    inputSiteDefaultLocale.value = settings.site.defaultLocale || '';
    inputSiteTimezone.value = settings.site.timezone || ADMIN_SITE_TIMEZONE_DEFAULT;
    inputSiteTitleMaxPercent.value = String(settings.site.titleMaxPercent ?? ADMIN_SITE_TITLE_PERCENT_DEFAULT);
    inputSitePageGapPx.value = String(settings.site.pageGapPx ?? ADMIN_SITE_PAGE_GAP_DEFAULT);
    inputSiteRailOffsetPx.value = String(settings.site.railOffsetPx ?? ADMIN_SITE_RAIL_OFFSET_DEFAULT);
    inputPageListRssEnabled.checked = settings.page.listRss.enabled !== false;
    inputPageListRssBlog.checked = settings.page.listRss.blog !== false;
    inputPageListRssBits.checked = settings.page.listRss.bits !== false;
    inputPageListRssArchive.checked = settings.page.listRss.archive !== false;
    previews.syncListRssControls();
    inputSiteFooterStartYear.value = String(settings.site.footer?.startYear ?? '');
    inputSiteFooterShowCurrentYear.checked = Boolean(settings.site.footer?.showCurrentYear);
    inputSiteFooterCopyright.value = settings.site.footer?.copyright || '';
    inputSiteFilingsIcpNumber.value = settings.site.filings?.icp?.number || '';
    inputSiteFilingsIcpLink.value = settings.site.filings?.icp?.link || '';
    inputSiteFilingsPoliceNumber.value = settings.site.filings?.police?.number || '';
    inputSiteFilingsPoliceLink.value = settings.site.filings?.police?.link || '';
    inputSiteFilingsPoliceIcon.value = settings.site.filings?.police?.icon || '';
    inputSiteFilingsScope.value = settings.site.filings?.scope ?? ADMIN_FILINGS_SCOPE_DEFAULT;
    inputSiteAdminOverviewPublicVisible.checked = settings.site.adminOverview?.publicVisible !== false;
    inputSiteAdminOverviewHiddenMessage.value =
      settings.site.adminOverview?.hiddenMessage || ADMIN_OVERVIEW_HIDDEN_MESSAGE_DEFAULT;
    previews.syncAdminOverviewControls();
    inputSiteFaviconSvg.value = settings.site.favicon?.svg || '';
    inputSiteFaviconPng.value = settings.site.favicon?.png || '';
    inputSiteFaviconAppleTouchIcon.value = settings.site.favicon?.appleTouchIcon || '';
    inputSiteSocialGithubOrder.value = String(
      settings.site.socialLinks?.presetOrder?.github ?? ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.github
    );
    inputSiteSocialGithub.value = settings.site.socialLinks?.github || '';
    inputSiteSocialXOrder.value = String(
      settings.site.socialLinks?.presetOrder?.x ?? ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.x
    );
    inputSiteSocialX.value = settings.site.socialLinks?.x || '';
    // X 预置行只在已有链接时出现；留空的行不参与排序，也不占列表位置
    const xPresetRow = inputSiteSocialX.closest<HTMLElement>('[data-social-preset-row]');
    if (xPresetRow) xPresetRow.dataset.rowHidden = inputSiteSocialX.value.trim() ? 'false' : 'true';
    inputSiteSocialEmailOrder.value = String(
      settings.site.socialLinks?.presetOrder?.email ?? ADMIN_SOCIAL_PRESET_ORDER_DEFAULT.email
    );
    inputSiteSocialEmail.value = settings.site.socialLinks?.email || '';
    replaceCustomRows(settings.site.socialLinks?.custom || []);
    normalizeSocialOrders();
    inputShellBrandTitle.value = settings.shell.brandTitle || '';
    inputShellQuote.value = settings.shell.quote || '';
    inputHomeShowIntroLead.checked = settings.home.showIntroLead !== false;
    inputHomeShowIntroMore.checked = settings.home.showIntroMore !== false;
    inputHomeIntroLead.value = settings.home.introLead || '';
    inputHomeIntroMore.value = settings.home.introMore || '';
    const introMoreLinks = normalizeHomeIntroLinks(settings.home.introMoreLinks);
    const primaryIntroLink = introMoreLinks[0] || homeIntro.defaultPrimaryHomeIntroLink;
    inputHomeIntroMoreLinkPrimary.value = primaryIntroLink;
    inputHomeIntroMoreLinkSecondaryEnabled.checked = introMoreLinks.length > 1;
    inputHomeIntroMoreLinkSecondary.value =
      introMoreLinks[1] || homeIntro.getFallbackSecondaryIntroLink(primaryIntroLink);
    homeIntro.syncHomeIntroLinkControls();
    homeIntro.refreshHomeIntroPreview();
    inputPageBlogTitle.value = settings.page.blog?.title || '';
    inputPageBlogSubtitle.value = settings.page.blog?.subtitle || '';
    inputPageProjectsTitle.value = settings.page.projects?.title || '';
    inputPageProjectsSubtitle.value = settings.page.projects?.subtitle || '';
    inputPageArchiveTitle.value = settings.page.archive?.title || '';
    inputPageArchiveSubtitle.value = settings.page.archive?.subtitle || '';
    inputPageArchiveVersionMode.value = settings.page.archive?.versionMode ?? 'all';
    inputPageBitsTitle.value = settings.page.bits?.title || '';
    inputPageBitsSubtitle.value = settings.page.bits?.subtitle || '';
    inputPageDevlogTitle.value = settings.page.devlog?.title || '';
    inputPageDevlogSubtitle.value = settings.page.devlog?.subtitle || '';
    inputPageAboutTitle.value = settings.page.about?.title || '';
    inputPageAboutSubtitle.value = settings.page.about?.subtitle || '';
    for (const scope of ADMIN_PAGINATION_SCOPES) {
      const values = settings.page.pagination?.[scope] ?? ADMIN_PAGINATION_DEFAULTS[scope];
      const enabledInput = paginationInput(scope, 'enabled');
      const sizeInput = paginationInput(scope, 'size');
      if (enabledInput) enabledInput.checked = values.enabled;
      if (sizeInput) sizeInput.value = String(values.pageSize);
    }
    inputPageBitsAuthorName.value = settings.page.bits?.defaultAuthor?.name || '';
    inputPageBitsAuthorAvatar.value = settings.page.bits?.defaultAuthor?.avatar || '';
    inputHomeShowHero.checked = (settings.home.heroPresetId || 'default') !== 'none';
    inputHeroImageSrc.value = settings.home.heroImageSrc || '';
    inputHeroImageAlt.value = settings.home.heroImageAlt || ADMIN_HERO_IMAGE_ALT_DEFAULT;
    previews.syncHeroControls();
    previews.syncFooterYearControls();
    inputCodeLineNumbers.checked = Boolean(settings.ui?.codeBlock?.showLineNumbers);
    inputReadingEntry.checked = Boolean(settings.ui?.readingMode?.showEntry);
    inputFloatStackShowResumeReading.checked = settings.ui?.floatStack?.showResumeReading !== false;
    inputFloatStackShowScrollTop.checked = settings.ui?.floatStack?.showScrollTop !== false;
    inputViewStatsShowPv.checked = Boolean(settings.ui?.viewStats?.showPv);
    inputViewStatsPvLabel.value = settings.ui?.viewStats?.pvLabel ?? ADMIN_VIEW_STATS_PV_LABEL_DEFAULT;
    inputViewStatsShowUv.checked = Boolean(settings.ui?.viewStats?.showUv);
    inputViewStatsUvLabel.value = settings.ui?.viewStats?.uvLabel ?? ADMIN_VIEW_STATS_UV_LABEL_DEFAULT;
    inputViewStatsOnArticleMeta.checked = settings.ui?.viewStats?.onArticleMeta !== false;
    inputViewStatsOnIndexPages.checked = settings.ui?.viewStats?.onIndexPages !== false;
    inputSidebarActionsShowRssLink.checked = settings.ui?.sidebarActions?.showRssLink !== false;
    inputSidebarActionsShowThemeToggle.checked = settings.ui?.sidebarActions?.showThemeToggle !== false;
    inputSidebarActionsShowAdminEntry.checked = Boolean(settings.ui?.sidebarActions?.showAdminEntry);
    previews.syncSidebarActionControls();
    inputArticleMetaShowDate.checked = settings.ui?.articleMeta?.showDate !== false;
    inputArticleMetaDateLabel.value = settings.ui?.articleMeta?.dateLabel ?? ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT;
    inputUiArticleDateDisplay.value = settings.ui?.articleMeta?.dateDisplay ?? 'updated';
    applyArticleDateGranularity(settings.ui?.articleMeta?.dateGranularity);
    inputUiCardDateDisplay.value = settings.ui?.cardDateDisplay ?? 'updated';
    inputArticleMetaShowTags.checked = settings.ui?.articleMeta?.showTags !== false;
    inputArticleMetaShowWordCount.checked = settings.ui?.articleMeta?.showWordCount !== false;
    inputArticleMetaShowReadingTime.checked = settings.ui?.articleMeta?.showReadingTime !== false;
    applySidebarDividerVariant(settings.ui?.layout?.sidebarDivider || ADMIN_SIDEBAR_DIVIDER_DEFAULT);
    applyTypographySettings(settings.ui?.typography);
    applyFontCoverage(settings.ui?.fontCoverage);
    refreshFontCoveragePreview();
    inputEntryVersionName.value = normalizeEntryVersionNameMode(settings.ui?.entryVersionName);
    previews.refreshEntryVersionPreview();
    previews.refreshFooterPreview();
    previews.refreshFilingsPreview();
    previews.refreshArticleMetaPreview();
    previews.refreshViewStatsPreview();

    navSocial.applyNavRows(settings.shell.nav);
  };

  return {
    canonicalize,
    collectSettings,
    applySettings,
    refreshFontCoveragePreview
  };
};
