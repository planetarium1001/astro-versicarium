import type { EditableThemeSettings, ThemeSettingsFileGroup } from '../../theme-settings';
import { isRecord, type LooseRecord } from '../../is-record';
import { ADMIN_PAGINATION_SCOPES, ADMIN_SITE_FAVICON_SLOTS } from './constants';

const fillAdminThemeSettingsSiteCompatibilityDefaults = (
  rawSite: LooseRecord,
  canonicalSite: LooseRecord
): LooseRecord => {
  let next = rawSite;

  if (next.timezone === undefined) {
    next = { ...next, timezone: canonicalSite.timezone };
  }

  const canonicalAdminOverview = canonicalSite.adminOverview;
  if (isRecord(canonicalAdminOverview)) {
    const rawAdminOverview = next.adminOverview;
    if (rawAdminOverview === undefined) {
      next = { ...next, adminOverview: canonicalAdminOverview };
    } else if (isRecord(rawAdminOverview)) {
      next = {
        ...next,
        adminOverview: {
          publicVisible: canonicalAdminOverview.publicVisible,
          hiddenMessage: canonicalAdminOverview.hiddenMessage,
          ...rawAdminOverview
        }
      };
    }
  }

  const canonicalFilings = canonicalSite.filings;
  if (isRecord(canonicalFilings)) {
    const rawFilings = next.filings;
    if (rawFilings === undefined) {
      next = { ...next, filings: canonicalFilings };
    } else if (isRecord(rawFilings)) {
      const mergeEntry = (key: 'icp' | 'police'): LooseRecord => {
        const canonicalEntry = isRecord(canonicalFilings[key]) ? canonicalFilings[key] : {};
        const rawEntry = isRecord(rawFilings[key]) ? rawFilings[key] : {};
        return { ...canonicalEntry, ...rawEntry };
      };
      next = {
        ...next,
        filings: {
          /* 旧配置没有显示范围时按默认补齐；已有值原样保留交给校验。 */
          scope: rawFilings.scope === undefined ? canonicalFilings.scope : rawFilings.scope,
          icp: mergeEntry('icp'),
          police: mergeEntry('police')
        }
      };
    }
  }

  const canonicalFavicon = canonicalSite.favicon;
  if (isRecord(canonicalFavicon)) {
    const rawFavicon = next.favicon;
    if (rawFavicon === undefined) {
      next = { ...next, favicon: canonicalFavicon };
    } else if (isRecord(rawFavicon)) {
      const defaults = Object.fromEntries(
        ADMIN_SITE_FAVICON_SLOTS.map((slot) => [slot, canonicalFavicon[slot]])
      );
      next = { ...next, favicon: { ...defaults, ...rawFavicon } };
    }
  }

  return next;
};

/* ui.* 分组兼容回填的字段表：新增分组只需在此登记，不再复制合并块。 */
const UI_COMPATIBILITY_GROUP_FIELDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['sidebarActions', ['showRssLink', 'showThemeToggle', 'showAdminEntry']],
  ['floatStack', ['showResumeReading', 'showScrollTop']],
  [
    'viewStats',
    ['showPv', 'pvLabel', 'showUv', 'uvLabel', 'onArticleMeta', 'onIndexPages']
  ],
  ['typography', ['readable', 'copy', 'mono', 'brand']],
  ['articleMeta', ['showDate', 'dateLabel', 'dateDisplay', 'dateGranularity', 'showTags', 'showWordCount', 'showReadingTime']]
];

const fillAdminThemeSettingsShellCompatibilityDefaults = (
  rawShell: LooseRecord,
  canonicalShell: LooseRecord
): LooseRecord => {
  let next = rawShell;

  // 旧配置没有该键时按「未设置」补齐，避免读取期被静默修补判定锁住后台。
  if (next.titleNarrow === undefined && canonicalShell.titleNarrow !== undefined) {
    next = { ...next, titleNarrow: canonicalShell.titleNarrow };
  }

  return next;
};

const fillAdminThemeSettingsPageCompatibilityDefaults = (
  rawPage: LooseRecord,
  canonicalPage: LooseRecord
): LooseRecord => {
  let next = rawPage;
  const canonicalArchive = canonicalPage.archive;
  if (isRecord(canonicalArchive)) {
    const rawArchive = next.archive;
    if (rawArchive === undefined) {
      next = { ...next, archive: canonicalArchive };
    } else if (isRecord(rawArchive) && rawArchive.versionMode === undefined) {
      next = { ...next, archive: { ...canonicalArchive, ...rawArchive } };
    }
  }

  const canonicalPagination = canonicalPage.pagination;
  if (isRecord(canonicalPagination)) {
    const rawPagination = next.pagination;
    if (rawPagination === undefined) {
      next = { ...next, pagination: canonicalPagination };
    } else if (isRecord(rawPagination)) {
      /* 旧配置没有分页组：按页面补齐默认值，已有值原样保留交给校验。 */
      const merged = { ...rawPagination };
      for (const scope of ADMIN_PAGINATION_SCOPES) {
        const canonicalScope = canonicalPagination[scope];
        if (!isRecord(canonicalScope)) continue;
        const rawScope = rawPagination[scope];
        merged[scope] = isRecord(rawScope)
          ? { ...canonicalScope, ...rawScope }
          : canonicalScope;
      }
      next = { ...next, pagination: merged };
    }
  }
  return next;
};

const fillAdminThemeSettingsUiCompatibilityDefaults = (
  rawUi: LooseRecord,
  canonicalUi: LooseRecord
): LooseRecord => {
  let next = rawUi;

  for (const [key, fields] of UI_COMPATIBILITY_GROUP_FIELDS) {
    const canonicalGroup = canonicalUi[key];
    if (!isRecord(canonicalGroup)) continue;

    const rawGroup = next[key];
    if (rawGroup === undefined) {
      next = { ...next, [key]: canonicalGroup };
    } else if (isRecord(rawGroup)) {
      const defaults = Object.fromEntries(fields.map((field) => [field, canonicalGroup[field]]));
      next = { ...next, [key]: { ...defaults, ...rawGroup } };
    }
  }

  // 条目版本名称是后加的顶层标量：旧 ui.json 缺该键时补默认，避免读取期被判定锁住后台。
  if (canonicalUi.entryVersionName !== undefined && next.entryVersionName === undefined) {
    next = { ...next, entryVersionName: canonicalUi.entryVersionName };
  }

  // 字体覆盖策略同样是后加的顶层标量：旧 ui.json 缺该键时按默认 full 补齐。
  if (canonicalUi.fontCoverage !== undefined && next.fontCoverage === undefined) {
    next = { ...next, fontCoverage: canonicalUi.fontCoverage };
  }

  // 旧的条目格式组合器已移除：保留该键会被误判为 schema-mismatch，读取时直接忽略，
  // 下次保存会自然把它从 ui.json 里去掉。
  if ('entryFormat' in next) {
    const { entryFormat: _removedEntryFormat, ...rest } = next;
    next = rest;
  }

  return next;
};

export const fillAdminThemeSettingsGroupCompatibilityDefaults = (
  group: ThemeSettingsFileGroup,
  rawGroup: unknown,
  canonicalGroup: unknown
): unknown => {
  if (!isRecord(rawGroup) || !isRecord(canonicalGroup)) return rawGroup;
  if (group === 'site') return fillAdminThemeSettingsSiteCompatibilityDefaults(rawGroup, canonicalGroup);
  if (group === 'shell') return fillAdminThemeSettingsShellCompatibilityDefaults(rawGroup, canonicalGroup);
  if (group === 'page') return fillAdminThemeSettingsPageCompatibilityDefaults(rawGroup, canonicalGroup);
  if (group === 'ui') return fillAdminThemeSettingsUiCompatibilityDefaults(rawGroup, canonicalGroup);
  return rawGroup;
};

export const fillAdminThemeSettingsCompatibilityDefaults = (
  settings: unknown,
  canonicalSettings: EditableThemeSettings
): unknown => {
  if (!isRecord(settings)) return settings;

  const filled = {
    ...settings,
    ...(isRecord(settings.site)
      ? {
          site: fillAdminThemeSettingsSiteCompatibilityDefaults(
            settings.site,
            canonicalSettings.site as unknown as LooseRecord
          )
        }
      : {}),
    ...(isRecord(settings.shell)
      ? {
          shell: fillAdminThemeSettingsShellCompatibilityDefaults(
            settings.shell,
            canonicalSettings.shell as unknown as LooseRecord
          )
        }
      : {}),
    ...(isRecord(settings.page)
      ? {
          page: fillAdminThemeSettingsPageCompatibilityDefaults(
            settings.page,
            canonicalSettings.page as unknown as LooseRecord
          )
        }
      : {}),
    ...(isRecord(settings.ui)
      ? {
          ui: fillAdminThemeSettingsUiCompatibilityDefaults(
            settings.ui,
            canonicalSettings.ui as unknown as LooseRecord
          )
        }
      : {})
  };
  return isRecord(filled.ui) && filled.ui.cardDateDisplay === undefined
    ? { ...filled, ui: { ...filled.ui, cardDateDisplay: canonicalSettings.ui.cardDateDisplay } }
    : filled;
};
