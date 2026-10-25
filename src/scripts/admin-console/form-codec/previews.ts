import { normalizeEntryVersionNameMode } from '@/lib/entry-display';
import { normalizeSiteFilingIconPath } from '@/utils/format';
import {
  ADMIN_VIEW_STATS_PV_LABEL_DEFAULT,
  ADMIN_VIEW_STATS_UV_LABEL_DEFAULT,
  parseInteger
} from '@/lib/admin-console/theme-shared';
import { normalizeSingleLine, withBase, type FormCodecContext } from './context';

export type PreviewCodec = {
  refreshArticleMetaPreview: () => void;
  refreshViewStatsPreview: () => void;
  refreshEntryVersionPreview: () => void;
  refreshFooterPreview: () => void;
  refreshFilingsPreview: () => void;
  syncAdminOverviewControls: () => void;
  syncSidebarActionControls: () => void;
  syncListRssControls: () => void;
  syncHeroControls: () => void;
  syncFooterYearControls: () => void;
};

export const createPreviewCodec = (context: FormCodecContext): PreviewCodec => {
  const {
    articleMetaPreviewValueEl,
    footerPreviewValueEl,
    filingsIconPreviewEl,
    filingsPreviewValueEl,
    footerStartYearMax,
    inputArticleMetaDateLabel,
    inputArticleMetaShowDate,
    inputArticleMetaShowReadingTime,
    inputArticleMetaShowTags,
    inputArticleMetaShowWordCount,
    inputEntryVersionName,
    inputHeroImageAlt,
    inputHeroImageSrc,
    inputHomeShowHero,
    inputPageListRssArchive,
    inputPageListRssBits,
    inputPageListRssBlog,
    inputPageListRssEnabled,
    inputSidebarActionsShowAdminEntry,
    inputSiteAdminOverviewHiddenMessage,
    inputSiteAdminOverviewPublicVisible,
    inputSiteFilingsIcpNumber,
    inputSiteFilingsPoliceIcon,
    inputSiteFilingsPoliceNumber,
    inputSiteFooterCopyright,
    inputSiteFooterShowCurrentYear,
    inputSiteFooterStartYear,
    inputUiArticleDateDisplay,
    inputUiArticleDateGranularity,
    inputViewStatsOnArticleMeta,
    inputViewStatsOnIndexPages,
    inputViewStatsPvLabel,
    inputViewStatsShowPv,
    inputViewStatsShowUv,
    inputViewStatsUvLabel,
    pageListRssGroupEl,
    sidebarAdminEntryRowEl,
    viewStatsPreviewFooterEl,
    viewStatsPreviewMetaEl
  } = context;

  const syncAdminOverviewControls = (): void => {
    inputSiteAdminOverviewHiddenMessage.disabled = inputSiteAdminOverviewPublicVisible.checked;
  };

  const syncSidebarActionControls = (): void => {
    const adminOverviewPublicVisible = Boolean(inputSiteAdminOverviewPublicVisible.checked);
    inputSidebarActionsShowAdminEntry.disabled = !adminOverviewPublicVisible;
    sidebarAdminEntryRowEl.setAttribute('aria-disabled', String(!adminOverviewPublicVisible));
  };

  const ARTICLE_META_PREVIEW_PUBLISHED = '2026-03-18';
  const ARTICLE_META_PREVIEW_UPDATED = '2026-03-20';
  const ARTICLE_META_PREVIEW_TIME = '14:30';
  const ARTICLE_META_PREVIEW_TAGS = ['#Astro', '#写作'] as const;
  const ARTICLE_META_PREVIEW_WORD_COUNT = '共 2,416 字';
  const ARTICLE_META_PREVIEW_READING_TIME = '约 6 分钟';
  const ARTICLE_META_PREVIEW_EMPTY = '当前不显示文章元信息';

  /** 预览跟随粒度：date 只到日期，datetime 补站点时间语义的时分（不带时区后缀）。 */
  const getArticleMetaPreviewDateText = (dateText: string): string =>
    inputUiArticleDateGranularity.value === 'datetime'
      ? `${dateText} ${ARTICLE_META_PREVIEW_TIME}`
      : dateText;

  const getArticleMetaPreviewText = (): string => {
    const segments: string[] = [];

    if (inputArticleMetaShowDate.checked) {
      const dateLabel = normalizeSingleLine(inputArticleMetaDateLabel.value) || '发布于：';
      const dateDisplay = inputUiArticleDateDisplay.value;
      // 与 resolveArticleDateItems 保持一致：updated 缺失时回退 published，
      // 但预览固定展示「同时显示」时的两行日期。
      if (dateDisplay === 'published') {
        segments.push(`${dateLabel}${getArticleMetaPreviewDateText(ARTICLE_META_PREVIEW_PUBLISHED)}`);
      } else if (dateDisplay === 'updated') {
        segments.push(`更新于：${getArticleMetaPreviewDateText(ARTICLE_META_PREVIEW_UPDATED)}`);
      } else {
        segments.push(
          `${dateLabel}${getArticleMetaPreviewDateText(ARTICLE_META_PREVIEW_PUBLISHED)}`,
          `更新于：${getArticleMetaPreviewDateText(ARTICLE_META_PREVIEW_UPDATED)}`
        );
      }
    }

    if (inputArticleMetaShowTags.checked) {
      segments.push(ARTICLE_META_PREVIEW_TAGS.join('\u00A0'));
    }

    if (inputArticleMetaShowWordCount.checked) {
      segments.push(ARTICLE_META_PREVIEW_WORD_COUNT);
    }

    if (inputArticleMetaShowReadingTime.checked) {
      segments.push(ARTICLE_META_PREVIEW_READING_TIME);
    }

    return segments.length ? segments.join(' · ') : ARTICLE_META_PREVIEW_EMPTY;
  };

  const refreshArticleMetaPreview = (): void => {
    articleMetaPreviewValueEl.textContent = getArticleMetaPreviewText();
  };

  const VIEW_STATS_PREVIEW_PV = '1,234';
  const VIEW_STATS_PREVIEW_UV = '456';
  const VIEW_STATS_PREVIEW_EMPTY = '当前不显示浏览数据';

  const getViewStatsPreviewTexts = (): { meta: string; footer: string } => {
    const segments: string[] = [];

    if (inputViewStatsShowPv.checked) {
      const pvLabel = normalizeSingleLine(inputViewStatsPvLabel.value, ADMIN_VIEW_STATS_PV_LABEL_DEFAULT);
      segments.push(`${pvLabel} ${VIEW_STATS_PREVIEW_PV}`);
    }

    if (inputViewStatsShowUv.checked) {
      const uvLabel = normalizeSingleLine(inputViewStatsUvLabel.value, ADMIN_VIEW_STATS_UV_LABEL_DEFAULT);
      segments.push(`${uvLabel} ${VIEW_STATS_PREVIEW_UV}`);
    }

    const statsText = segments.join(' · ');
    return {
      meta: inputViewStatsOnArticleMeta.checked && statsText ? statsText : VIEW_STATS_PREVIEW_EMPTY,
      footer: inputViewStatsOnIndexPages.checked && statsText ? statsText : VIEW_STATS_PREVIEW_EMPTY
    };
  };

  const refreshViewStatsPreview = (): void => {
    const { meta, footer } = getViewStatsPreviewTexts();
    viewStatsPreviewMetaEl.textContent = meta;
    viewStatsPreviewFooterEl.textContent = footer;
  };

  /** 条目版本下拉框与下方预览保持同步：只切换当前模式的示例块。 */
  const refreshEntryVersionPreview = (): void => {
    const mode = normalizeEntryVersionNameMode(inputEntryVersionName.value);
    document.querySelectorAll<HTMLElement>('[data-entry-version-preview]').forEach((preview) => {
      preview.dataset.mode = mode;
      preview.querySelectorAll<HTMLElement>('[data-entry-version-preview-variant]').forEach((variant) => {
        variant.hidden = (variant.dataset.entryVersionPreviewVariant ?? '') !== mode;
      });
    });
  };

  /** 总开关关掉时三个页面各自的勾选框置灰并加 `aria-disabled`。 */
  const syncListRssControls = (): void => {
    const enabled = Boolean(inputPageListRssEnabled.checked);
    for (const input of [inputPageListRssBlog, inputPageListRssBits, inputPageListRssArchive]) {
      input.disabled = !enabled;
    }
    pageListRssGroupEl.setAttribute('aria-disabled', String(!enabled));
  };

  const syncHeroControls = (): void => {
    const isHidden = !inputHomeShowHero.checked;
    inputHeroImageSrc.disabled = isHidden;
    inputHeroImageAlt.disabled = isHidden;
  };

  const getFooterPreviewText = (): string => {
    const startYear = parseInteger(inputSiteFooterStartYear.value);
    const showCurrentYear = Boolean(inputSiteFooterShowCurrentYear.checked);
    const yearRange = showCurrentYear && startYear && startYear < footerStartYearMax
      ? `${startYear}-${footerStartYearMax}`
      : String(startYear || footerStartYearMax);
    const copyright = inputSiteFooterCopyright.value.trim() || 'Versicarium · 垄录 · Planetarium';
    return `页脚预览：© ${yearRange} ${copyright}`;
  };

  const FILINGS_PREVIEW_EMPTY = '当前不显示备案信息';

  const getFilingsPreviewText = (): string => {
    const icpNumber = normalizeSingleLine(inputSiteFilingsIcpNumber.value);
    const policeNumber = normalizeSingleLine(inputSiteFilingsPoliceNumber.value);
    const segments = [icpNumber, policeNumber].filter(Boolean);
    if (!segments.length) return FILINGS_PREVIEW_EMPTY;
    return segments.join(' · ');
  };

  const FILINGS_ICON_PREVIEW_STATES = { empty: 'empty', custom: 'custom', error: 'error' } as const;
  const filingsIconPreviewImg = filingsIconPreviewEl.querySelector<HTMLImageElement>(
    '[data-filings-icon-preview-img]'
  );

  // 路径写错或外链 404 时退回虚框，避免裂图
  filingsIconPreviewEl.addEventListener(
    'error',
    (event) => {
      if (!(event.target instanceof HTMLImageElement)) return;
      event.target.removeAttribute('src');
      event.target.hidden = true;
      filingsIconPreviewEl.dataset.state = FILINGS_ICON_PREVIEW_STATES.error;
    },
    true
  );

  // 相对路径补 base，https 外链原样使用；空值与非法值只留虚框
  const refreshFilingsIconPreview = (): void => {
    if (!filingsIconPreviewImg) return;

    const normalized = normalizeSiteFilingIconPath(inputSiteFilingsPoliceIcon.value);
    const src = typeof normalized === 'string' && normalized
      ? (/^https:\/\//i.test(normalized) ? normalized : withBase(normalized))
      : null;

    if (!src) {
      filingsIconPreviewImg.removeAttribute('src');
      filingsIconPreviewImg.hidden = true;
      filingsIconPreviewEl.dataset.state = FILINGS_ICON_PREVIEW_STATES.empty;
      return;
    }

    filingsIconPreviewImg.hidden = false;
    filingsIconPreviewImg.src = src;
    filingsIconPreviewEl.dataset.state = FILINGS_ICON_PREVIEW_STATES.custom;
  };

  const refreshFilingsPreview = (): void => {
    filingsPreviewValueEl.textContent = getFilingsPreviewText();
    refreshFilingsIconPreview();
  };

  const refreshFooterPreview = (): void => {
    footerPreviewValueEl.textContent = getFooterPreviewText().replace(/^页脚预览：/, '').trim();
  };

  const syncFooterYearControls = (): void => {
    const footerYearRangeEl = inputSiteFooterShowCurrentYear.closest<HTMLElement>('.admin-year-range');
    if (!footerYearRangeEl) return;
    footerYearRangeEl.dataset.currentYearEnabled = String(Boolean(inputSiteFooterShowCurrentYear.checked));
  };

  return {
    refreshArticleMetaPreview,
    refreshViewStatsPreview,
    refreshEntryVersionPreview,
    refreshFooterPreview,
    refreshFilingsPreview,
    syncAdminOverviewControls,
    syncSidebarActionControls,
    syncListRssControls,
    syncHeroControls,
    syncFooterYearControls
  };
};
