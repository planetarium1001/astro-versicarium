import type {
  ArchiveVersionMode,
  ArticleDateDisplayMode,
  ArticleDateGranularity,
  FontCoverage,
  HeroPresetId,
  HomeIntroLinkKey,
  SidebarDividerVariant,
  SidebarNavId,
  SiteFilingsScope,
  SiteSocialIconKey,
  SiteSocialPresetId,
  TypographySettings
} from '../../theme-settings';
import {
  THEME_TYPOGRAPHY_DEFAULT,
  getThemeFontOptionsForRole,
  isThemeFontIdForRole
} from '../../fonts/registry';
import type { SiteFaviconSlot } from '../../../utils/format';

export const ADMIN_SITE_FAVICON_SLOTS = ['svg', 'png', 'appleTouchIcon'] as const satisfies readonly SiteFaviconSlot[];
export const ADMIN_SITE_FAVICON_SLOT_LABELS: Record<SiteFaviconSlot, string> = {
  svg: '站点图标（SVG）',
  png: '标签页图标（PNG）',
  appleTouchIcon: '触摸图标（PNG）'
};

export const ADMIN_NAV_IDS = [
  'blog',
  'projects',
  'bits',
  'devlog',
  'archive',
  'about'
] as const satisfies readonly SidebarNavId[];
export const ADMIN_SOCIAL_CUSTOM_LIMIT = 8;

export const ADMIN_HERO_PRESETS = ['default', 'none'] as const satisfies readonly HeroPresetId[];
export const ADMIN_HERO_PRESET_SET: ReadonlySet<HeroPresetId> = new Set(ADMIN_HERO_PRESETS);
export const ADMIN_HERO_IMAGE_ALT_DEFAULT = 'Versicarium 主题预览';
export const ADMIN_HERO_IMAGE_ALT_MAX_LENGTH = 120;

export const ADMIN_SITE_TIMEZONE_DEFAULT = 'Asia/Shanghai';

export const ADMIN_ARTICLE_DATE_DISPLAY_OPTIONS = [
  { id: 'published', label: '发布于' },
  { id: 'updated', label: '更新于' },
  { id: 'both', label: '同时显示' }
] as const satisfies readonly { id: ArticleDateDisplayMode; label: string }[];
export const ADMIN_ARTICLE_DATE_DISPLAY_DEFAULT: ArticleDateDisplayMode = 'updated';
export const ADMIN_ARTICLE_DATE_DISPLAY_SET = new Set<ArticleDateDisplayMode>(
  ADMIN_ARTICLE_DATE_DISPLAY_OPTIONS.map((option) => option.id)
);

/** 日期粒度与「显示模式（published/updated/both）」是两个维度：粒度只管是否带时分。 */
export const ADMIN_ARTICLE_DATE_GRANULARITY_OPTIONS = [
  { id: 'date', label: '仅日期' },
  { id: 'datetime', label: '日期 + 时间' }
] as const satisfies readonly { id: ArticleDateGranularity; label: string }[];
export const ADMIN_ARTICLE_DATE_GRANULARITY_DEFAULT: ArticleDateGranularity = 'date';
export const ADMIN_ARTICLE_DATE_GRANULARITY_SET = new Set<ArticleDateGranularity>(
  ADMIN_ARTICLE_DATE_GRANULARITY_OPTIONS.map((option) => option.id)
);

export const ADMIN_ARCHIVE_VERSION_MODE_OPTIONS = [
  { id: 'all', label: '显示全部版本' },
  { id: 'latest', label: '仅显示最新版' }
] as const satisfies readonly { id: ArchiveVersionMode; label: string }[];
export const ADMIN_ARCHIVE_VERSION_MODE_DEFAULT: ArchiveVersionMode = 'all';
export const ADMIN_ARCHIVE_VERSION_MODE_SET = new Set<ArchiveVersionMode>(
  ADMIN_ARCHIVE_VERSION_MODE_OPTIONS.map((option) => option.id)
);

export const ADMIN_ARTICLE_META_DATE_LABEL_DEFAULT = '发布于：';
export const ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH = 20;

export const ADMIN_PAGINATION_SCOPES = ['home', 'blog', 'bits', 'devlog', 'archive'] as const;
export type AdminPaginationScope = (typeof ADMIN_PAGINATION_SCOPES)[number];
export const ADMIN_PAGINATION_PAGE_SIZE_MIN = 1;
export const ADMIN_PAGINATION_PAGE_SIZE_MAX = 100;
export const ADMIN_PAGINATION_DEFAULTS = {
  home: { enabled: true, pageSize: 12 },
  blog: { enabled: true, pageSize: 12 },
  bits: { enabled: true, pageSize: 20 },
  devlog: { enabled: false, pageSize: 10 },
  // 归档是完整时间线：默认一次展示全部条目，避免分页把较早的 devlog 藏到第二页。
  archive: { enabled: false, pageSize: 20 }
} as const satisfies Record<AdminPaginationScope, { enabled: boolean; pageSize: number }>;
export const ADMIN_PAGINATION_PAGE_OPTIONS: ReadonlyArray<{
  id: AdminPaginationScope;
  label: string;
  path: string | null;
}> = [
  { id: 'home', label: '首页', path: null },
  { id: 'blog', label: '博客', path: '/blog/' },
  { id: 'bits', label: '动态', path: '/bits/' },
  { id: 'devlog', label: '开发日志', path: '/devlog/' },
  { id: 'archive', label: '归档', path: '/archive/' }
];

export const ADMIN_FILINGS_NUMBER_MAX_LENGTH = 40;
export const ADMIN_ICP_FILING_HOSTS = ['beian.miit.gov.cn'] as const;
export const ADMIN_POLICE_FILING_HOSTS = ['beian.mps.gov.cn', 'beian.gov.cn'] as const;
/**
 * 备案信息显示范围：'all' 渲染到所有公开页面（默认，保证既有实例升级后行为不变），
 * 'root' 只在站点根目录（首页）渲染。
 */
export const ADMIN_FILINGS_SCOPES = ['all', 'root'] as const satisfies readonly SiteFilingsScope[];
export const ADMIN_FILINGS_SCOPE_DEFAULT: SiteFilingsScope = 'all';
export const ADMIN_FILINGS_SCOPE_SET: ReadonlySet<SiteFilingsScope> = new Set(ADMIN_FILINGS_SCOPES);
export const ADMIN_FILINGS_SCOPE_OPTIONS = [
  { id: 'all', label: '所有页面显示' },
  { id: 'root', label: '仅在首页显示' }
] as const satisfies readonly {
  id: SiteFilingsScope;
  label: string;
}[];

export const ADMIN_VIEW_STATS_PV_LABEL_DEFAULT = '浏览';
export const ADMIN_VIEW_STATS_UV_LABEL_DEFAULT = '访客';
export const ADMIN_VIEW_STATS_LABEL_MAX_LENGTH = 8;

export const ADMIN_SIDEBAR_DIVIDER_VARIANTS = [
  'default',
  'subtle',
  'none'
] as const satisfies readonly SidebarDividerVariant[];
export const ADMIN_SIDEBAR_DIVIDER_DEFAULT: SidebarDividerVariant = 'default';
export const ADMIN_SIDEBAR_DIVIDER_SET: ReadonlySet<SidebarDividerVariant> = new Set(ADMIN_SIDEBAR_DIVIDER_VARIANTS);
export const ADMIN_SIDEBAR_DIVIDER_OPTIONS = [
  { id: 'default', label: '默认' },
  { id: 'subtle', label: '弱化' },
  { id: 'none', label: '隐藏' }
] as const satisfies readonly {
  id: SidebarDividerVariant;
  label: string;
}[];

export const ADMIN_TYPOGRAPHY_DEFAULT: TypographySettings = THEME_TYPOGRAPHY_DEFAULT;
export const getAdminTypographyFontOptions = getThemeFontOptionsForRole;
export const isAdminTypographyFontId = isThemeFontIdForRole;

/** 全局字体覆盖策略：默认完整覆盖；常用覆盖只加载 base 分片，生僻字回退系统字体。 */
export const ADMIN_FONT_COVERAGES = ['full', 'common'] as const satisfies readonly FontCoverage[];
export const ADMIN_FONT_COVERAGE_DEFAULT: FontCoverage = 'full';
export const ADMIN_FONT_COVERAGE_SET: ReadonlySet<FontCoverage> = new Set(ADMIN_FONT_COVERAGES);

export const ADMIN_FONT_COVERAGE_OPTIONS = [
  { id: 'full', label: '完整覆盖（默认）' },
  { id: 'common', label: '常用覆盖' }
] as const satisfies readonly {
  id: FontCoverage;
  label: string;
}[];

export const ADMIN_HOME_INTRO_LINK_KEYS = [
  'archive',
  'blog',
  'projects',
  'bits',
  'devlog',
  'about',
  'tag',
  'blogTag'
] as const satisfies readonly HomeIntroLinkKey[];
export const ADMIN_HOME_INTRO_LINK_DEFAULT = ['archive', 'blog'] as const satisfies readonly HomeIntroLinkKey[];
export const ADMIN_HOME_INTRO_LINK_LIMIT = 2;
export const ADMIN_HOME_INTRO_LINK_KEY_SET: ReadonlySet<HomeIntroLinkKey> = new Set(ADMIN_HOME_INTRO_LINK_KEYS);
export const ADMIN_HOME_INTRO_LINK_OPTIONS = [
  { id: 'archive', label: '归档', href: '/archive/' },
  { id: 'blog', label: '博客', href: '/blog/' },
  { id: 'projects', label: '项目', href: '/projects/' },
  { id: 'bits', label: '动态', href: '/bits/' },
  { id: 'devlog', label: '更新', href: '/devlog/' },
  { id: 'about', label: '关于', href: '/about/' },
  { id: 'tag', label: '#归档标签', href: '/archive/?picker=tag' },
  { id: 'blogTag', label: '#博客标签', href: '/blog/?picker=tag' }
] as const satisfies readonly {
  id: HomeIntroLinkKey;
  label: string;
  href: string;
}[];

export const ADMIN_SOCIAL_PRESET_IDS = ['github', 'x', 'email'] as const satisfies readonly SiteSocialPresetId[];
export const ADMIN_SOCIAL_PRESET_ORDER_DEFAULT: Record<SiteSocialPresetId, number> = {
  github: 1,
  x: 2,
  email: 3
};
export const ADMIN_SOCIAL_ORDER_MIN = 1;
export const ADMIN_SOCIAL_ORDER_MAX = ADMIN_SOCIAL_PRESET_IDS.length + ADMIN_SOCIAL_CUSTOM_LIMIT;
export const ADMIN_NAV_ORDER_MIN = 1;
export const ADMIN_NAV_ORDER_MAX = 999;

export const ADMIN_SOCIAL_ICON_KEYS = [
  'github',
  'x',
  'email',
  'weibo',
  'facebook',
  'instagram',
  'telegram',
  'mastodon',
  'bilibili',
  'youtube',
  'linkedin',
  'website'
] as const satisfies readonly SiteSocialIconKey[];
export const ADMIN_SOCIAL_ICON_KEY_SET: ReadonlySet<SiteSocialIconKey> = new Set(ADMIN_SOCIAL_ICON_KEYS);

export const ADMIN_GITHUB_HOSTS = ['github.com'] as const;
export const ADMIN_X_HOSTS = ['x.com', 'twitter.com'] as const;

export const ADMIN_HOME_INTRO_MAX_LENGTH = 240;
export const ADMIN_PAGE_TITLE_MAX_LENGTH = 60;
export const ADMIN_PAGE_SUBTITLE_MAX_LENGTH = 120;
export const ADMIN_NAV_ORNAMENT_DEFAULT = '·';
export const ADMIN_NAV_ORNAMENT_MAX_LENGTH = 4;
export const ADMIN_FOOTER_START_YEAR_MIN = 1900;
export const ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH = 120;
/**
 * 窄屏顶栏里「站点标题」可渲染宽度的上限（占页面宽度的百分比）。
 * 默认 35%，后台「主题 → 站点设置」可改，取值范围 10%–100%。
 */
export const ADMIN_SITE_TITLE_PERCENT_DEFAULT = 35;
export const ADMIN_SITE_TITLE_PERCENT_MIN = 10;
export const ADMIN_SITE_TITLE_PERCENT_MAX = 100;
/** 窄屏标题（`shell.titleNarrow`）的长度上限；留空表示与侧栏站点名一致。 */
export const ADMIN_SHELL_TITLE_NARROW_MAX_LENGTH = 60;
/**
 * 页面外缘间隙（内容盒到浏览器边缘的视觉距离，px）。
 * 默认与下限都是 32：再小会让右下角浮动列与正文的净空不足（几何下限 30），上限 160。
 */
export const ADMIN_SITE_PAGE_GAP_DEFAULT = 32;
export const ADMIN_SITE_PAGE_GAP_MIN = 32;
export const ADMIN_SITE_PAGE_GAP_MAX = 160;
/** 「页面外缘间隙」的提示文案，与表单校验共用。 */
export const ADMIN_SITE_PAGE_GAP_HINT = `（px，最小 ${ADMIN_SITE_PAGE_GAP_MIN}；仅 901px 以上生效）`;
/**
 * 窄屏浮动列到屏幕右侧的距离（px）。
 * 默认 6（与桌面一致的视觉间距）；0–32 可调，让使用者绕开部分浏览器
 * （华为 ArkWeb）把右侧滚动条判定区划走导致的点按不灵敏。
 * 仅 ≤900px 的公开页面生效，桌面始终使用 :root 的 6px。
 */
export const ADMIN_SITE_RAIL_OFFSET_DEFAULT = 6;
export const ADMIN_SITE_RAIL_OFFSET_MIN = 0;
export const ADMIN_SITE_RAIL_OFFSET_MAX = 32;
/** 「窄屏浮动列右侧距离」的提示文案，与表单校验共用。 */
export const ADMIN_SITE_RAIL_OFFSET_HINT =
  `（px，默认 ${ADMIN_SITE_RAIL_OFFSET_DEFAULT}，范围 0–${ADMIN_SITE_RAIL_OFFSET_MAX}；仅 900px 以下生效）`;
export const ADMIN_OVERVIEW_HIDDEN_MESSAGE_DEFAULT = '作者暂未公开此页面。';
export const ADMIN_OVERVIEW_HIDDEN_MESSAGE_MAX_LENGTH = 120;

export const ADMIN_LOCALE_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
export const ADMIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

