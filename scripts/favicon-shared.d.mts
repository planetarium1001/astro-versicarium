/**
 * `scripts/favicon-shared.mjs` 的类型声明。
 *
 * 生成器脚本和 Astro 集成都以 `.mjs` 形式存在，TypeScript 无法从实现里读到
 * 稳定的导出签名；测试直接 import 这些辅助函数时，用这份声明锁定契约。
 */

/** `site.json` 里的 favicon 配置；实现只消费 svg / png / source。 */
export interface FaviconSettings {
  svg?: string | null;
  png?: string | null;
  appleTouchIcon?: string | null;
  source?: string | null;
  ico?: string | null;
  manifest?: string | null;
  [key: string]: unknown;
}

/** `site.json` 的最小形态：实现只读取 favicon，其余字段原样保留。 */
export interface SiteSettings {
  favicon?: FaviconSettings | null;
  [key: string]: unknown;
}

export declare const FAVICON_DEFAULT_PATHS: {
  readonly svg: '/favicon.svg';
  readonly png: '/favicon-32x32.png';
};

/** 生成目录，相对项目根目录。 */
export declare const FAVICON_GENERATED_DIR: string;

export declare const readSiteSettings: (projectRoot: string) => SiteSettings;

export declare const resolvePublicFile: (
  projectRoot: string,
  value: unknown
) => string | null;

export declare const resolveFaviconSourceImage: (
  projectRoot: string,
  favicon?: FaviconSettings | null
) => string | null;

export declare const isDefaultFaviconPath: (
  value: unknown,
  kind: 'svg' | 'png'
) => boolean;

export declare const isDefaultFaviconSource: (
  projectRoot: string,
  source: string | null | undefined
) => boolean;

export interface FaviconRootIcoState {
  currentHash: string | null;
  generatedHash: string;
  previousMarker: { rootIco?: boolean; rootIcoHash?: string } | null | undefined;
  sourceIsDefault: boolean;
}

export declare const shouldWriteRootIco: (state: FaviconRootIcoState) => boolean;

/** 用 public 下的文件覆盖根路径图标。 */
export interface FaviconProbeSourceEntry {
  type: string;
  source: string;
}

/** 用生成目录里的文件覆盖根路径图标。 */
export interface FaviconProbeGeneratedEntry {
  type: string;
  generated: string;
}

/** 从产物 / 开发服务里移除根路径图标。 */
export interface FaviconProbeRemoveEntry {
  remove: true;
}

export type FaviconProbePlanEntry =
  | FaviconProbeSourceEntry
  | FaviconProbeGeneratedEntry
  | FaviconProbeRemoveEntry;

export type FaviconProbePlan = Record<string, FaviconProbePlanEntry>;

export declare const resolveFaviconProbePlan: (
  projectRoot: string
) => FaviconProbePlan | null;
