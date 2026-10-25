import type { HomeIntroLinkKey } from '@/lib/theme-settings';
import {
  ADMIN_HOME_INTRO_LINK_DEFAULT,
  ADMIN_HOME_INTRO_LINK_OPTIONS,
  isAdminHomeIntroLinkKey,
  normalizeMultiline
} from '@/lib/admin-console/theme-shared';
import type { FormCodecContext } from './context';

export type HomeIntroCodec = {
  defaultPrimaryHomeIntroLink: HomeIntroLinkKey;
  getFallbackSecondaryIntroLink: (primary: HomeIntroLinkKey) => HomeIntroLinkKey;
  collectHomeIntroLinks: () => HomeIntroLinkKey[];
  refreshHomeIntroPreview: () => void;
  syncHomeIntroLinkControls: () => void;
};

export const createHomeIntroCodec = (context: FormCodecContext): HomeIntroCodec => {
  const {
    inputHomeIntroMoreLinkPrimary,
    inputHomeIntroMoreLinkSecondary,
    inputHomeIntroMoreLinkSecondaryEnabled,
    inputHomeIntroMore,
    inputHomeShowIntroMore,
    homeIntroMorePreviewEl,
    homeIntroMoreLinkSecondaryGroupEl
  } = context;

  const defaultHomeIntroLinks = [...ADMIN_HOME_INTRO_LINK_DEFAULT] as HomeIntroLinkKey[];
  const defaultPrimaryHomeIntroLink: HomeIntroLinkKey = ADMIN_HOME_INTRO_LINK_DEFAULT[0];
  const defaultSecondaryHomeIntroLink: HomeIntroLinkKey = ADMIN_HOME_INTRO_LINK_DEFAULT[1];

  const getFallbackSecondaryIntroLink = (primary: HomeIntroLinkKey): HomeIntroLinkKey =>
    defaultHomeIntroLinks.find((link) => link !== primary)
    || ADMIN_HOME_INTRO_LINK_OPTIONS.find((option) => option.id !== primary)?.id
    || defaultSecondaryHomeIntroLink
    || primary;

  const getSelectedHomeIntroLink = (
    selectEl: HTMLSelectElement,
    fallback: HomeIntroLinkKey
  ): HomeIntroLinkKey => {
    const rawValue = selectEl.value.trim();
    return isAdminHomeIntroLinkKey(rawValue) ? rawValue : fallback;
  };

  const HOME_INTRO_PREVIEW_EMPTY = '无首页补充导语';
  const getHomeIntroLinkLabel = (linkKey: HomeIntroLinkKey): string =>
    ADMIN_HOME_INTRO_LINK_OPTIONS.find((option) => option.id === linkKey)?.label || '链接';

  const collectHomeIntroLinks = (): HomeIntroLinkKey[] => {
    const primary = getSelectedHomeIntroLink(inputHomeIntroMoreLinkPrimary, defaultPrimaryHomeIntroLink);
    if (!inputHomeIntroMoreLinkSecondaryEnabled.checked) {
      return [primary];
    }

    const secondary = getSelectedHomeIntroLink(
      inputHomeIntroMoreLinkSecondary,
      getFallbackSecondaryIntroLink(primary)
    );

    return secondary !== primary ? [primary, secondary] : [primary];
  };

  const getHomeIntroPreviewText = (): string => {
    if (!inputHomeShowIntroMore.checked) {
      return HOME_INTRO_PREVIEW_EMPTY;
    }
    const introText = normalizeMultiline(inputHomeIntroMore.value).trim() || '……';
    const [primary, secondary] = collectHomeIntroLinks();
    const primaryLabel = getHomeIntroLinkLabel(primary || defaultPrimaryHomeIntroLink);
    if (!secondary) {
      return `${introText} ${primaryLabel}。`;
    }
    const secondaryLabel = getHomeIntroLinkLabel(secondary);
    return `${introText} ${primaryLabel} 或 ${secondaryLabel}。`;
  };

  const refreshHomeIntroPreview = (): void => {
    homeIntroMorePreviewEl.textContent = getHomeIntroPreviewText();
  };

  const syncHomeIntroLinkControls = (): void => {
    const primary = getSelectedHomeIntroLink(inputHomeIntroMoreLinkPrimary, defaultPrimaryHomeIntroLink);
    const hasSecondary = Boolean(inputHomeIntroMoreLinkSecondaryEnabled.checked);
    inputHomeIntroMoreLinkSecondary.disabled = !hasSecondary;
    homeIntroMoreLinkSecondaryGroupEl.setAttribute('aria-disabled', String(!hasSecondary));

    if (hasSecondary) {
      const secondary = getSelectedHomeIntroLink(
        inputHomeIntroMoreLinkSecondary,
        getFallbackSecondaryIntroLink(primary)
      );

      if (secondary === primary) {
        inputHomeIntroMoreLinkSecondary.value = getFallbackSecondaryIntroLink(primary);
      }
    }

    refreshHomeIntroPreview();
  };

  return {
    defaultPrimaryHomeIntroLink,
    getFallbackSecondaryIntroLink,
    collectHomeIntroLinks,
    refreshHomeIntroPreview,
    syncHomeIntroLinkControls
  };
};
