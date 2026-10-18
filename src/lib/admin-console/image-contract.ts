export type AdminImageOrigin = 'public' | 'src/assets' | 'content' | 'cloud';
export type AdminImageBrowseGroup =
  | 'all'
  | 'blog'
  | 'projects'
  | 'bits'
  | 'devlog'
  | 'assets'
  | 'pages'
  | 'cloud'
  | 'uncategorized';
export type AdminImageScopeKey = 'recent';

export const ADMIN_IMAGE_DEFAULT_LIST_LIMIT = 20;

export const ADMIN_IMAGE_BROWSE_GROUP_LABELS = {
  all: '全部',
  blog: '博客',
  projects: '项目',
  bits: '动态',
  devlog: '更新',
  assets: '配置素材',
  pages: '页面插图',
  cloud: '云端图片',
  uncategorized: '未归类'
} as const satisfies Record<AdminImageBrowseGroup, string>;

export const ADMIN_IMAGE_BROWSE_GROUP_ORDER = [
  'all',
  'blog',
  'projects',
  'bits',
  'devlog',
  'assets',
  'pages',
  'cloud',
  'uncategorized'
] as const satisfies readonly AdminImageBrowseGroup[];

export const ADMIN_IMAGE_SCOPE_LABELS = {
  recent: '最新修改'
} as const satisfies Record<AdminImageScopeKey, string>;

export const isAdminImageOrigin = (value: unknown): value is AdminImageOrigin =>
  value === 'public' || value === 'src/assets' || value === 'content' || value === 'cloud';

export const isAdminImageBrowseGroup = (value: unknown): value is AdminImageBrowseGroup =>
  typeof value === 'string' && value in ADMIN_IMAGE_BROWSE_GROUP_LABELS;

export const isAdminImageScopeKey = (value: unknown): value is AdminImageScopeKey =>
  typeof value === 'string' && value in ADMIN_IMAGE_SCOPE_LABELS;
