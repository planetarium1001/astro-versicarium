import type {
  EditableThemeSettings,
  HomeIntroLinkKey,
  SidebarNavId,
  SiteSocialPresetId
} from '../../theme-settings';
import { isValidIanaTimeZone } from '../../../utils/timezone';
import { isEntryVersionNameMode } from '../../entry-display';
import {
  getHeroImageLocalFilePath as getAdminHeroImageLocalFilePath,
  getSiteFaviconLocalFilePath as getAdminSiteFaviconLocalFilePath,
  normalizeBitsAvatarPath as normalizeAdminBitsAvatarPath,
  normalizeHeroImageSrc as normalizeAdminHeroImageSrc,
  normalizeSiteFaviconPath as normalizeAdminSiteFaviconPath,
  normalizeSiteFilingIconPath as normalizeAdminSiteFilingIconPath
} from '../../../utils/format';
import {
  ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH, ADMIN_EMAIL_RE, ADMIN_FILINGS_NUMBER_MAX_LENGTH,
  ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH, ADMIN_FOOTER_START_YEAR_MIN, ADMIN_GITHUB_HOSTS,
  ADMIN_HERO_IMAGE_ALT_MAX_LENGTH, ADMIN_HERO_PRESET_SET, ADMIN_HOME_INTRO_LINK_LIMIT,
  ADMIN_HOME_INTRO_MAX_LENGTH, ADMIN_ICP_FILING_HOSTS, ADMIN_LOCALE_RE, ADMIN_NAV_IDS,
  ADMIN_NAV_ORDER_MAX, ADMIN_NAV_ORDER_MIN, ADMIN_NAV_ORNAMENT_MAX_LENGTH,
  ADMIN_OVERVIEW_HIDDEN_MESSAGE_MAX_LENGTH, ADMIN_PAGE_SUBTITLE_MAX_LENGTH,
  ADMIN_PAGE_TITLE_MAX_LENGTH, ADMIN_PAGINATION_PAGE_OPTIONS,
  ADMIN_PAGINATION_PAGE_SIZE_MAX, ADMIN_PAGINATION_PAGE_SIZE_MIN, ADMIN_POLICE_FILING_HOSTS,
  ADMIN_SHELL_TITLE_NARROW_MAX_LENGTH, ADMIN_SITE_FAVICON_SLOTS, ADMIN_SITE_FAVICON_SLOT_LABELS,
  ADMIN_SITE_PAGE_GAP_MAX, ADMIN_SITE_PAGE_GAP_MIN, ADMIN_SITE_RAIL_OFFSET_MAX,
  ADMIN_SITE_RAIL_OFFSET_MIN, ADMIN_SITE_TITLE_PERCENT_MAX, ADMIN_SITE_TITLE_PERCENT_MIN,
  ADMIN_SOCIAL_CUSTOM_LIMIT, ADMIN_SOCIAL_ORDER_MAX, ADMIN_SOCIAL_ORDER_MIN,
  ADMIN_SOCIAL_PRESET_IDS, ADMIN_VIEW_STATS_LABEL_MAX_LENGTH, ADMIN_X_HOSTS,
  isAdminTypographyFontId
} from './constants';
import {
  getAdminFooterStartYearMax,
  getAdminNavOrderIssues,
  getAdminSocialOrderIssues,
  isAdminAllowedHttpsUrl,
  isAdminArchiveVersionMode,
  isAdminArticleDateDisplayMode,
  isAdminArticleDateGranularity,
  isAdminFilingsScope,
  isAdminFontCoverage,
  isAdminHomeIntroLinkKey,
  isAdminSidebarDividerVariant,
  isAdminSocialIconKey,
  isAdminSocialPresetId,
  normalizeEmail
} from './guards';

export type AdminThemeSettingsValidationIssue = {
  path: string;
  message: string;
};

export type AdminThemeSettingsValidateOptions = {
  footerStartYearMax?: number;
  localFileExists?: (relativePath: string) => boolean;
};

export const createValidationIssue = (path: string, message: string): AdminThemeSettingsValidationIssue => ({
  path,
  message
});

export const validateAdminThemeSettings = (
  settings: EditableThemeSettings,
  options: AdminThemeSettingsValidateOptions = {}
): AdminThemeSettingsValidationIssue[] => {
  const footerStartYearMax = options.footerStartYearMax ?? getAdminFooterStartYearMax();
  const issues: AdminThemeSettingsValidationIssue[] = [];
  const pushIssue = (path: string, message: string): void => {
    issues.push(createValidationIssue(path, message));
  };

  for (const [key, label] of [
    ['enabled', 'RSS 总开关'],
    ['blog', '/blog/ RSS 开关'],
    ['bits', '/bits/ RSS 开关'],
    ['archive', '/archive/ RSS 开关']
  ] as const) {
    if (typeof settings.page?.listRss?.[key] !== 'boolean') {
      pushIssue(`page.listRss.${key}`, `${label}必须是布尔值`);
    }
  }

  if (!settings.site.title) pushIssue('site.title', '站点标题不能为空');
  if (!settings.site.description) pushIssue('site.description', '站点描述不能为空');
  if (!isAdminArchiveVersionMode(settings.page.archive.versionMode)) {
    pushIssue('page.archive.versionMode', '归档版本模式无效');
  }

  for (const option of ADMIN_PAGINATION_PAGE_OPTIONS) {
    const scope = option.id;
    const current = settings.page?.pagination?.[scope];
    if (typeof current?.enabled !== 'boolean') {
      pushIssue(`page.pagination.${scope}.enabled`, `${option.label}分页开关必须是布尔值`);
    }
    if (
      !Number.isInteger(current?.pageSize)
      || (current?.pageSize ?? 0) < ADMIN_PAGINATION_PAGE_SIZE_MIN
      || (current?.pageSize ?? 0) > ADMIN_PAGINATION_PAGE_SIZE_MAX
    ) {
      pushIssue(
        `page.pagination.${scope}.pageSize`,
        `${option.label}每页条数必须是 ${ADMIN_PAGINATION_PAGE_SIZE_MIN}–${ADMIN_PAGINATION_PAGE_SIZE_MAX} 的整数`
      );
    }
  }

  if (!settings.site.defaultLocale) {
    pushIssue('site.defaultLocale', '默认语言不能为空');
  } else if (!ADMIN_LOCALE_RE.test(settings.site.defaultLocale)) {
    pushIssue('site.defaultLocale', '默认语言格式无效（示例：zh-CN）');
  }

  if (!settings.site.timezone) {
    pushIssue('site.timezone', '站点时区不能为空');
  } else if (!isValidIanaTimeZone(settings.site.timezone)) {
    pushIssue('site.timezone', '站点时区必须是有效的 IANA 时区（示例：Asia/Shanghai）');
  }

  if (!Number.isInteger(settings.site.footer?.startYear)) {
    pushIssue('site.footer.startYear', '页脚起始年份必须是整数');
  } else if (
    settings.site.footer.startYear < ADMIN_FOOTER_START_YEAR_MIN ||
    settings.site.footer.startYear > footerStartYearMax
  ) {
    pushIssue('site.footer.startYear', '页脚起始年份超出允许范围');
  }

  if (typeof settings.site.footer?.showCurrentYear !== 'boolean') {
    pushIssue('site.footer.showCurrentYear', '是否显示当前年必须是布尔值');
  }

  if (!isAdminArticleDateDisplayMode(settings.ui.articleMeta.dateDisplay)) {
    pushIssue('ui.articleMeta.dateDisplay', '文章日期显示模式无效');
  }
  if (!isAdminArticleDateGranularity(settings.ui.articleMeta.dateGranularity)) {
    pushIssue('ui.articleMeta.dateGranularity', '文章日期粒度无效');
  }
  if (!isAdminArticleDateDisplayMode(settings.ui.cardDateDisplay)) {
    pushIssue('ui.cardDateDisplay', '卡片日期显示模式无效');
  }

  if (!Number.isInteger(settings.site.titleMaxPercent)) {
    pushIssue('site.titleMaxPercent', '站点标题宽度百分比必须是整数');
  } else if (
    settings.site.titleMaxPercent < ADMIN_SITE_TITLE_PERCENT_MIN ||
    settings.site.titleMaxPercent > ADMIN_SITE_TITLE_PERCENT_MAX
  ) {
    pushIssue(
      'site.titleMaxPercent',
      `站点标题宽度百分比必须在 ${ADMIN_SITE_TITLE_PERCENT_MIN}–${ADMIN_SITE_TITLE_PERCENT_MAX} 之间`
    );
  }

  if (!Number.isInteger(settings.site.pageGapPx)) {
    pushIssue('site.pageGapPx', '页面外缘间隙必须是整数');
  } else if (
    settings.site.pageGapPx < ADMIN_SITE_PAGE_GAP_MIN ||
    settings.site.pageGapPx > ADMIN_SITE_PAGE_GAP_MAX
  ) {
    pushIssue(
      'site.pageGapPx',
      `页面外缘间隙必须在 ${ADMIN_SITE_PAGE_GAP_MIN}–${ADMIN_SITE_PAGE_GAP_MAX} 之间`
    );
  }

  if (!Number.isInteger(settings.site.railOffsetPx)) {
    pushIssue('site.railOffsetPx', '窄屏浮动列右侧距离必须是整数');
  } else if (
    settings.site.railOffsetPx < ADMIN_SITE_RAIL_OFFSET_MIN ||
    settings.site.railOffsetPx > ADMIN_SITE_RAIL_OFFSET_MAX
  ) {
    pushIssue(
      'site.railOffsetPx',
      `窄屏浮动列右侧距离必须在 ${ADMIN_SITE_RAIL_OFFSET_MIN}–${ADMIN_SITE_RAIL_OFFSET_MAX} 之间`
    );
  }

  if (!settings.site.footer?.copyright) {
    pushIssue('site.footer.copyright', '页脚版权行不能为空');
  } else if (
    settings.site.footer.copyright.includes('\n') ||
    settings.site.footer.copyright.includes('\r')
  ) {
    pushIssue('site.footer.copyright', '页脚版权行只允许单行文本');
  } else if (settings.site.footer.copyright.length > ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH) {
    pushIssue('site.footer.copyright', `页脚版权行不能超过 ${ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH} 个字符`);
  }

  for (const [path, label, value] of [
    ['site.filings.icp.number', '工信部备案号', settings.site.filings?.icp?.number],
    ['site.filings.police.number', '公安备案号', settings.site.filings?.police?.number]
  ] as const) {
    if (value === null) continue;
    if (typeof value !== 'string') {
      pushIssue(path, `备案信息里的“${label}”必须是字符串`);
    } else if (value.includes('\n') || value.includes('\r')) {
      pushIssue(path, `备案信息里的“${label}”只允许单行文本`);
    } else if (value.length > ADMIN_FILINGS_NUMBER_MAX_LENGTH) {
      pushIssue(path, `备案信息里的“${label}”不能超过 ${ADMIN_FILINGS_NUMBER_MAX_LENGTH} 个字符`);
    }
  }

  for (const [path, label, value, hosts] of [
    ['site.filings.icp.link', '工信部备案链接', settings.site.filings?.icp?.link, ADMIN_ICP_FILING_HOSTS],
    ['site.filings.police.link', '公安备案链接', settings.site.filings?.police?.link, ADMIN_POLICE_FILING_HOSTS]
  ] as const) {
    if (value === null) continue;
    if (typeof value !== 'string' || !isAdminAllowedHttpsUrl(value, hosts)) {
      pushIssue(path, `备案信息里的“${label}”只允许 ${hosts.map((host) => `https://${host}`).join(' 或 ')} 的地址`);
    }
  }

  if (!isAdminFilingsScope(settings.site.filings?.scope ?? '')) {
    pushIssue('site.filings.scope', '备案信息显示范围只允许 所有页面显示 / 仅在首页显示');
  }

  const filingsIcon = settings.site.filings?.police?.icon ?? null;
  if (filingsIcon !== null) {
    if (normalizeAdminSiteFilingIconPath(filingsIcon) === undefined) {
      pushIssue('site.filings.police.icon', '公安备案图标只允许 https 图片地址或 public/**（或 / 开头）的图片路径');
    } else if (!/^https:\/\//i.test(filingsIcon) && options.localFileExists) {
      const localFilePath = `public${filingsIcon}`;
      if (!options.localFileExists(localFilePath)) {
        pushIssue('site.filings.police.icon', `公安备案图标指向的本地文件不存在：${localFilePath}`);
      }
    }
  }

  if (typeof settings.site.adminOverview?.publicVisible !== 'boolean') {
    pushIssue('site.adminOverview.publicVisible', 'Admin Overview 公开展示开关必须是布尔值');
  }

  if (!settings.site.adminOverview?.hiddenMessage) {
    pushIssue('site.adminOverview.hiddenMessage', 'Admin Overview 关闭态文案不能为空');
  } else if (
    settings.site.adminOverview.hiddenMessage.includes('\n') ||
    settings.site.adminOverview.hiddenMessage.includes('\r')
  ) {
    pushIssue('site.adminOverview.hiddenMessage', 'Admin Overview 关闭态文案只允许单行文本');
  } else if (settings.site.adminOverview.hiddenMessage.length > ADMIN_OVERVIEW_HIDDEN_MESSAGE_MAX_LENGTH) {
    pushIssue(
      'site.adminOverview.hiddenMessage',
      `Admin Overview 关闭态文案不能超过 ${ADMIN_OVERVIEW_HIDDEN_MESSAGE_MAX_LENGTH} 个字符`
    );
  }

  ADMIN_SITE_FAVICON_SLOTS.forEach((slot) => {
    const slotValue = settings.site.favicon?.[slot] ?? null;
    if (slotValue === null) return;

    const slotLabel = ADMIN_SITE_FAVICON_SLOT_LABELS[slot];
    const extHint = slot === 'svg' ? '.svg' : '.png';
    if (normalizeAdminSiteFaviconPath(slot, slotValue) === undefined) {
      pushIssue(
        `site.favicon.${slot}`,
        `${slotLabel} 只允许 public/**（或 / 开头）的 ${extHint} 路径，不允许 URL、..、?、#`
      );
      return;
    }

    const localFilePath = getAdminSiteFaviconLocalFilePath(slotValue);
    if (options.localFileExists && !options.localFileExists(localFilePath)) {
      pushIssue(`site.favicon.${slot}`, `${slotLabel} 指向的本地文件不存在：${localFilePath}`);
    }
  });

  if (
    settings.site.socialLinks?.github &&
    !isAdminAllowedHttpsUrl(settings.site.socialLinks.github, ADMIN_GITHUB_HOSTS)
  ) {
    pushIssue('site.socialLinks.github', 'GitHub 链接只允许 https://github.com/... ');
  }
  if (
    settings.site.socialLinks?.x &&
    !isAdminAllowedHttpsUrl(settings.site.socialLinks.x, ADMIN_X_HOSTS)
  ) {
    pushIssue('site.socialLinks.x', 'X / Twitter 链接只允许 https://x.com/... 或 https://twitter.com/... ');
  }
  if (
    settings.site.socialLinks?.email &&
    !ADMIN_EMAIL_RE.test(normalizeEmail(settings.site.socialLinks.email))
  ) {
    pushIssue('site.socialLinks.email', 'Email 必须是合法邮箱地址');
  }

  const presetOrder = settings.site.socialLinks.presetOrder;
  const customLinks = Array.isArray(settings.site.socialLinks?.custom) ? settings.site.socialLinks.custom : [];
  const socialOrderIssues = getAdminSocialOrderIssues(
    presetOrder,
    customLinks.map((item, index) => ({
      key: String(index),
      order: item.order
    }))
  );
  const presetOrderIssues = new Map<SiteSocialPresetId, 'range' | 'duplicate'>();
  const customOrderIssues = new Map<number, 'range' | 'duplicate'>();

  socialOrderIssues.forEach((issue) => {
    if (issue.scope === 'preset') {
      if (isAdminSocialPresetId(issue.key)) {
        presetOrderIssues.set(issue.key, issue.type);
      }
      return;
    }

    const index = Number.parseInt(issue.key, 10);
    if (Number.isInteger(index)) {
      customOrderIssues.set(index, issue.type);
    }
  });

  ADMIN_SOCIAL_PRESET_IDS.forEach((id) => {
    const rowLabel = id === 'github' ? 'GitHub' : id === 'x' ? 'X / Twitter' : 'Email';
    const orderIssue = presetOrderIssues.get(id);
    if (orderIssue === 'range') {
      pushIssue(
        `site.socialLinks.presetOrder.${id}`,
        `${rowLabel} 的位置排序必须为 ${ADMIN_SOCIAL_ORDER_MIN}-${ADMIN_SOCIAL_ORDER_MAX} 的整数`
      );
      return;
    }
    if (orderIssue === 'duplicate') {
      pushIssue(`site.socialLinks.presetOrder.${id}`, `社交链接位置排序不能重复：${presetOrder[id]}`);
    }
  });

  if (customLinks.length > ADMIN_SOCIAL_CUSTOM_LIMIT) {
    pushIssue('site.socialLinks.custom', `自定义链接最多只能添加 ${ADMIN_SOCIAL_CUSTOM_LIMIT} 条`);
  }

  const seenCustomIds = new Set<string>();
  customLinks.forEach((item, index) => {
    const basePath = `site.socialLinks.custom[${index}]`;
    if (!item.id) {
      pushIssue(`${basePath}.id`, `自定义链接 #${index + 1} 的 ID 不能为空`);
    } else {
      if (item.id.includes('\n') || item.id.includes('\r')) {
        pushIssue(`${basePath}.id`, `自定义链接 #${index + 1} 的 ID 只允许单行文本`);
      }
      if (seenCustomIds.has(item.id)) {
        pushIssue(`${basePath}.id`, `自定义链接 ID 重复：${item.id}`);
      }
      seenCustomIds.add(item.id);
    }

    if (!item.label) {
      pushIssue(`${basePath}.label`, `自定义链接 #${index + 1} 的显示名称不能为空`);
    } else if (item.label.includes('\n') || item.label.includes('\r')) {
      pushIssue(`${basePath}.label`, `自定义链接 #${index + 1} 的显示名称只允许单行文本`);
    }

    if (!item.href || !isAdminAllowedHttpsUrl(item.href)) {
      pushIssue(`${basePath}.href`, `自定义链接 #${index + 1} 的链接必须是合法 https:// 地址`);
    }
    if (!isAdminSocialIconKey(item.iconKey)) {
      pushIssue(`${basePath}.iconKey`, `自定义链接 #${index + 1} 的图标必须从白名单中选择`);
    }
    const orderIssue = customOrderIssues.get(index);
    if (orderIssue === 'range') {
      pushIssue(
        `${basePath}.order`,
        `自定义链接 #${index + 1} 的位置排序必须为 ${ADMIN_SOCIAL_ORDER_MIN}-${ADMIN_SOCIAL_ORDER_MAX} 的整数`
      );
    } else if (orderIssue === 'duplicate') {
      pushIssue(`${basePath}.order`, `社交链接位置排序不能重复：${item.order}`);
    }
    if (typeof item.visible !== 'boolean') {
      pushIssue(`${basePath}.visible`, `自定义链接 #${index + 1} 的 visible 必须是布尔值`);
    }
  });

  if (!settings.shell.brandTitle) pushIssue('shell.brandTitle', '侧栏站点名不能为空');
  if (settings.shell.titleNarrow !== null) {
    if (typeof settings.shell.titleNarrow !== 'string') {
      pushIssue('shell.titleNarrow', '窄屏标题必须是字符串');
    } else if (settings.shell.titleNarrow.length > ADMIN_SHELL_TITLE_NARROW_MAX_LENGTH) {
      pushIssue('shell.titleNarrow', `窄屏标题不能超过 ${ADMIN_SHELL_TITLE_NARROW_MAX_LENGTH} 个字符`);
    }
  }
  if (!settings.shell.quote) pushIssue('shell.quote', '侧栏引用文案不能为空');

  if (!settings.home.introLead) {
    pushIssue('home.introLead', '首页导语主文案不能为空');
  } else if (settings.home.introLead.length > ADMIN_HOME_INTRO_MAX_LENGTH) {
    pushIssue('home.introLead', `首页导语主文案不能超过 ${ADMIN_HOME_INTRO_MAX_LENGTH} 个字符`);
  }

  if (typeof settings.home.showIntroLead !== 'boolean') {
    pushIssue('home.showIntroLead', '首页导语主文案展示开关必须是布尔值');
  }

  if (!settings.home.introMore) {
    pushIssue('home.introMore', '首页导语补充文案不能为空');
  } else if (settings.home.introMore.length > ADMIN_HOME_INTRO_MAX_LENGTH) {
    pushIssue('home.introMore', `首页导语补充文案不能超过 ${ADMIN_HOME_INTRO_MAX_LENGTH} 个字符`);
  }

  if (typeof settings.home.showIntroMore !== 'boolean') {
    pushIssue('home.showIntroMore', '首页导语补充文案展示开关必须是布尔值');
  }

  if (!Array.isArray(settings.home.introMoreLinks)) {
    pushIssue('home.introMoreLinks', '首页导语补充链接必须是数组');
  } else if (
    settings.home.introMoreLinks.length < 1 ||
    settings.home.introMoreLinks.length > ADMIN_HOME_INTRO_LINK_LIMIT
  ) {
    pushIssue('home.introMoreLinks', `首页导语补充链接必须选择 1-${ADMIN_HOME_INTRO_LINK_LIMIT} 个入口`);
  } else {
    const seenHomeIntroLinks = new Set<HomeIntroLinkKey>();
    settings.home.introMoreLinks.forEach((linkKey, index) => {
      if (!isAdminHomeIntroLinkKey(linkKey)) {
        pushIssue(`home.introMoreLinks[${index}]`, `首页导语补充链接 #${index + 1} 非法：${String(linkKey)}`);
        return;
      }
      if (seenHomeIntroLinks.has(linkKey)) {
        pushIssue(`home.introMoreLinks[${index}]`, `首页导语补充链接不能重复：${linkKey}`);
        return;
      }
      seenHomeIntroLinks.add(linkKey);
    });
  }

  if (!ADMIN_HERO_PRESET_SET.has(settings.home.heroPresetId)) {
    pushIssue('home.heroPresetId', 'Hero 展示模式只允许 default/none');
  }

  if (
    settings.home.heroImageSrc !== null &&
    normalizeAdminHeroImageSrc(settings.home.heroImageSrc) === undefined
  ) {
    pushIssue(
      'home.heroImageSrc',
      'Hero 图片地址只允许 src/assets/**、public/**（或 / 开头路径）以及 https:// 图片地址'
    );
  } else if (settings.home.heroImageSrc) {
    const localFilePath = getAdminHeroImageLocalFilePath(settings.home.heroImageSrc);
    if (localFilePath && options.localFileExists && !options.localFileExists(localFilePath)) {
      pushIssue('home.heroImageSrc', `Hero 图片指向的本地文件不存在：${localFilePath}`);
    }
  }

  if (!settings.home.heroImageAlt) {
    pushIssue('home.heroImageAlt', 'Hero 图片说明不能为空');
  } else if (
    settings.home.heroImageAlt.includes('\n') ||
    settings.home.heroImageAlt.includes('\r')
  ) {
    pushIssue('home.heroImageAlt', 'Hero 图片说明只允许单行文本');
  } else if (settings.home.heroImageAlt.length > ADMIN_HERO_IMAGE_ALT_MAX_LENGTH) {
    pushIssue('home.heroImageAlt', `Hero 图片说明不能超过 ${ADMIN_HERO_IMAGE_ALT_MAX_LENGTH} 个字符`);
  }

  const pageTitleMap: Array<[string | null, string, string]> = [
    [settings.page.blog?.title, '/blog/ 页面主标题', 'page.blog.title'],
    [settings.page.archive?.title, '/archive/ 页面主标题', 'page.archive.title'],
    [settings.page.bits?.title, '/bits/ 页面主标题', 'page.bits.title'],
    [settings.page.projects?.title, '/projects/ 页面主标题', 'page.projects.title'],
    [settings.page.devlog?.title, '/devlog/ 页面主标题', 'page.devlog.title'],
    [settings.page.about?.title, '/about/ 页面主标题', 'page.about.title']
  ];

  pageTitleMap.forEach(([title, label, path]) => {
    if (title == null) return;
    if (typeof title !== 'string') {
      pushIssue(path, `${label} 必须是字符串或留空`);
      return;
    }
    if (title.includes('\n') || title.includes('\r')) {
      pushIssue(path, `${label} 只允许单行文本`);
    }
    if (title.length > ADMIN_PAGE_TITLE_MAX_LENGTH) {
      pushIssue(path, `${label} 不能超过 ${ADMIN_PAGE_TITLE_MAX_LENGTH} 个字符`);
    }
  });

  const pageSubtitleMap: Array<[string | null, string, string]> = [
    [settings.page.blog?.subtitle, '/blog/ 页面副标题', 'page.blog.subtitle'],
    [settings.page.archive?.subtitle, '/archive/ 页面副标题', 'page.archive.subtitle'],
    [settings.page.bits?.subtitle, '/bits/ 页面副标题', 'page.bits.subtitle'],
    [settings.page.projects?.subtitle, '/projects/ 页面副标题', 'page.projects.subtitle'],
    [settings.page.devlog?.subtitle, '/devlog/ 页面副标题', 'page.devlog.subtitle'],
    [settings.page.about?.subtitle, '/about/ 页面副标题', 'page.about.subtitle']
  ];

  pageSubtitleMap.forEach(([subtitle, label, path]) => {
    if (subtitle == null) return;
    if (typeof subtitle !== 'string') {
      pushIssue(path, `${label} 必须是字符串或留空`);
      return;
    }
    if (subtitle.includes('\n') || subtitle.includes('\r')) {
      pushIssue(path, `${label} 只允许单行文本`);
    }
    if (subtitle.length > ADMIN_PAGE_SUBTITLE_MAX_LENGTH) {
      pushIssue(path, `${label} 不能超过 ${ADMIN_PAGE_SUBTITLE_MAX_LENGTH} 个字符`);
    }
  });

  if (!settings.page.bits?.defaultAuthor?.name) {
    pushIssue('page.bits.defaultAuthor.name', 'Bits 默认作者名不能为空');
  }
  if (settings.page.bits?.defaultAuthor?.avatar) {
    if (normalizeAdminBitsAvatarPath(settings.page.bits.defaultAuthor.avatar) === undefined) {
      pushIssue(
        'page.bits.defaultAuthor.avatar',
        'Bits 默认头像只允许相对图片路径（例如 author/avatar.webp），不要带 public/、不要以 / 开头，也不要包含 URL、..、?、#'
      );
    }
  }

  if (typeof settings.ui?.articleMeta?.showDate !== 'boolean') {
    pushIssue('ui.articleMeta.showDate', '文章元信息里的“显示发布日期”必须是布尔值');
  }

  if (typeof settings.ui?.articleMeta?.dateLabel !== 'string') {
    pushIssue('ui.articleMeta.dateLabel', '文章元信息里的“日期前缀”必须是字符串');
  } else if (
    settings.ui.articleMeta.dateLabel.includes('\n') ||
    settings.ui.articleMeta.dateLabel.includes('\r')
  ) {
    pushIssue('ui.articleMeta.dateLabel', '文章元信息里的“日期前缀”只允许单行文本');
  } else if (settings.ui.articleMeta.dateLabel.length > ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH) {
    pushIssue(
      'ui.articleMeta.dateLabel',
      `文章元信息里的“日期前缀”不能超过 ${ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH} 个字符`
    );
  }

  if (typeof settings.ui?.articleMeta?.showTags !== 'boolean') {
    pushIssue('ui.articleMeta.showTags', '文章元信息里的“显示标签”必须是布尔值');
  }

  if (typeof settings.ui?.articleMeta?.showWordCount !== 'boolean') {
    pushIssue('ui.articleMeta.showWordCount', '文章元信息里的“显示字数”必须是布尔值');
  }

  if (typeof settings.ui?.articleMeta?.showReadingTime !== 'boolean') {
    pushIssue('ui.articleMeta.showReadingTime', '文章元信息里的“显示阅读时长”必须是布尔值');
  }

  if (typeof settings.ui?.sidebarActions?.showRssLink !== 'boolean') {
    pushIssue('ui.sidebarActions.showRssLink', '侧栏图标里的“显示 RSS 入口”必须是布尔值');
  }

  if (typeof settings.ui?.sidebarActions?.showThemeToggle !== 'boolean') {
    pushIssue('ui.sidebarActions.showThemeToggle', '侧栏图标里的“显示主题切换入口”必须是布尔值');
  }

  if (typeof settings.ui?.sidebarActions?.showAdminEntry !== 'boolean') {
    pushIssue('ui.sidebarActions.showAdminEntry', '侧栏图标里的“显示 /admin/ 入口”必须是布尔值');
  }

  if (typeof settings.ui?.floatStack?.showResumeReading !== 'boolean') {
    pushIssue('ui.floatStack.showResumeReading', '浮动操作列里的“回到上次阅读位置”必须是布尔值');
  }

  if (typeof settings.ui?.floatStack?.showScrollTop !== 'boolean') {
    pushIssue('ui.floatStack.showScrollTop', '浮动操作列里的“回到顶部”必须是布尔值');
  }

  for (const [path, label, value] of [
    ['ui.viewStats.pvLabel', '浏览量前缀', settings.ui?.viewStats?.pvLabel],
    ['ui.viewStats.uvLabel', '访客数前缀', settings.ui?.viewStats?.uvLabel]
  ] as const) {
    if (typeof value !== 'string') {
      pushIssue(path, `浏览数据里的“${label}”必须是字符串`);
    } else if (value.includes('\n') || value.includes('\r')) {
      pushIssue(path, `浏览数据里的“${label}”只允许单行文本`);
    } else if (value.length > ADMIN_VIEW_STATS_LABEL_MAX_LENGTH) {
      pushIssue(path, `浏览数据里的“${label}”不能超过 ${ADMIN_VIEW_STATS_LABEL_MAX_LENGTH} 个字符`);
    }
  }

  for (const [path, label, value] of [
    ['ui.viewStats.showPv', '显示浏览量', settings.ui?.viewStats?.showPv],
    ['ui.viewStats.showUv', '显示访客数', settings.ui?.viewStats?.showUv],
    ['ui.viewStats.onArticleMeta', '显示在文章元信息行', settings.ui?.viewStats?.onArticleMeta],
    ['ui.viewStats.onIndexPages', '显示在博客 / 动态 / 更新 / 归档等列表页底部', settings.ui?.viewStats?.onIndexPages]
  ] as const) {
    if (typeof value !== 'boolean') {
      pushIssue(path, `浏览数据里的“${label}”必须是布尔值`);
    }
  }

  if (!isAdminSidebarDividerVariant(settings.ui?.layout?.sidebarDivider ?? '')) {
    pushIssue('ui.layout.sidebarDivider', '侧栏分隔线只允许 默认 / 弱化 / 隐藏');
  }

  if (!isAdminTypographyFontId('readable', settings.ui?.typography?.readable ?? '')) {
    pushIssue('ui.typography.readable', '正文字体必须从注册表可选项中选择');
  }

  if (!isAdminTypographyFontId('copy', settings.ui?.typography?.copy ?? '')) {
    pushIssue('ui.typography.copy', '文案字体必须从注册表可选项中选择');
  }

  if (!isAdminTypographyFontId('mono', settings.ui?.typography?.mono ?? '')) {
    pushIssue('ui.typography.mono', '等宽字体必须从注册表可选项中选择');
  }
  if (!isAdminTypographyFontId('brand', settings.ui?.typography?.brand ?? '')) {
    pushIssue('ui.typography.brand', '品牌字体必须从注册表可选项中选择');
  }

  if (!isAdminFontCoverage(settings.ui?.fontCoverage)) {
    pushIssue('ui.fontCoverage', '字体覆盖策略只允许 完整覆盖 / 常用覆盖');
  }

  if (!isEntryVersionNameMode(settings.ui?.entryVersionName ?? '')) {
    pushIssue('ui.entryVersionName', '版本名称只允许 不显示 / 标题后 / 版本号后');
  }

  const nav = Array.isArray(settings.shell.nav) ? settings.shell.nav : [];
  if (nav.length !== ADMIN_NAV_IDS.length) {
    pushIssue('shell.nav', 'Sidebar 导航项数量必须与既有导航一致');
  }

  const seenIds = new Set<SidebarNavId>();
  const navOrderIssues = new Map<SidebarNavId, 'range' | 'duplicate'>();
  getAdminNavOrderIssues(
    nav.flatMap((item) =>
      ADMIN_NAV_IDS.includes(item.id)
        ? [
            {
              key: item.id as SidebarNavId,
              order: item.order
            }
          ]
        : []
    )
  ).forEach((issue) => {
    navOrderIssues.set(issue.key, issue.type);
  });

  nav.forEach((item, index) => {
    const navId = ADMIN_NAV_IDS.includes(item.id) ? item.id : null;
    const basePath = navId ? `shell.nav.${navId}` : `shell.nav[${index}]`;
    if (!navId) {
      pushIssue(`${basePath}.id`, `存在非法导航项 ID：${item.id}`);
    } else if (seenIds.has(navId)) {
      pushIssue(`${basePath}.id`, `导航项 ID 重复：${navId}`);
    }
    if (navId) seenIds.add(navId);

    if (!item.label) {
      pushIssue(`${basePath}.label`, `导航项 ${item.id} 的显示名称不能为空`);
    }
    if (item.ornament !== null) {
      if (typeof item.ornament !== 'string') {
        pushIssue(`${basePath}.ornament`, `导航项 ${item.id} 的点缀必须是字符串或留空`);
      } else if (item.ornament.includes('\n') || item.ornament.includes('\r')) {
        pushIssue(`${basePath}.ornament`, `导航项 ${item.id} 的点缀只允许单行文本`);
      } else if (item.ornament.length > ADMIN_NAV_ORNAMENT_MAX_LENGTH) {
        pushIssue(`${basePath}.ornament`, `导航项 ${item.id} 的点缀不能超过 ${ADMIN_NAV_ORNAMENT_MAX_LENGTH} 个字符`);
      }
    }
    if (
      !Number.isInteger(item.order) ||
      item.order < ADMIN_NAV_ORDER_MIN ||
      item.order > ADMIN_NAV_ORDER_MAX
    ) {
      pushIssue(`${basePath}.order`, `导航项 ${item.id} 的位置排序必须为 ${ADMIN_NAV_ORDER_MIN}-${ADMIN_NAV_ORDER_MAX} 的整数`);
    } else if (navId && navOrderIssues.get(navId) === 'duplicate') {
      pushIssue(`${basePath}.order`, `位置排序不能重复：${item.order}`);
    }
    if (typeof item.visible !== 'boolean') {
      pushIssue(`${basePath}.visible`, `导航项 ${item.id} 的 visible 必须是布尔值`);
    }
  });

  return issues;
};
