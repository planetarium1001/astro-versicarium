import type { FormCodecContext } from './context';
import { createHomeIntroCodec } from './home-intro';
import { createNavSocialCodec } from './nav-social';
import { createPreviewCodec } from './previews';
import { createSettingsCodec } from './settings';

export const createFormCodec = (context: FormCodecContext) => {
  const homeIntro = createHomeIntroCodec(context);
  const navSocial = createNavSocialCodec(context);
  const previews = createPreviewCodec(context);
  const settings = createSettingsCodec(context, { homeIntro, navSocial, previews });

  return {
    canonicalize: settings.canonicalize,
    collectSettings: settings.collectSettings,
    applySettings: settings.applySettings,
    collectHomeIntroLinks: homeIntro.collectHomeIntroLinks,
    refreshArticleMetaPreview: previews.refreshArticleMetaPreview,
    refreshViewStatsPreview: previews.refreshViewStatsPreview,
    refreshEntryVersionPreview: previews.refreshEntryVersionPreview,
    refreshFontCoveragePreview: settings.refreshFontCoveragePreview,
    refreshHomeIntroPreview: homeIntro.refreshHomeIntroPreview,
    syncAdminOverviewControls: previews.syncAdminOverviewControls,
    syncSidebarActionControls: previews.syncSidebarActionControls,
    syncHomeIntroLinkControls: homeIntro.syncHomeIntroLinkControls,
    syncListRssControls: previews.syncListRssControls,
    syncHeroControls: previews.syncHeroControls,
    refreshFooterPreview: previews.refreshFooterPreview,
    refreshFilingsPreview: previews.refreshFilingsPreview,
    syncFooterYearControls: previews.syncFooterYearControls
  };
};
