import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* 字体分片管线配置：唯一常量来源。
   本文件只放数据与路径；纯算法在 unicode-ranges.mjs / plan.mjs / frequency.mjs，
   构建编排在 scripts/font-*.mjs，fontTools 调用在 font_ops.py。 */

export const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const PATHS = {
  charsetBase: path.join(PROJECT_ROOT, 'tools', 'charset-base.txt'),
  charsetCommon: path.join(PROJECT_ROOT, 'tools', 'charset-common.txt'),
  charsetCommonStamp: path.join(PROJECT_ROOT, 'tools', 'charset-common.sha256'),
  charsetFrequency: path.join(PROJECT_ROOT, 'tools', 'charset-frequency.txt'),
  charsetRoles: path.join(PROJECT_ROOT, 'tools', 'charset-roles.json'),
  fontSources: path.join(PROJECT_ROOT, 'tools', 'font-sources.json'),
  fontSourcesLock: path.join(PROJECT_ROOT, 'tools', 'font-sources.lock.json'),
  fontManifest: path.join(PROJECT_ROOT, 'tools', 'font-manifest.json'),
  fontsSrc: path.join(PROJECT_ROOT, 'tools', 'fonts-src'),
  fontsSrcCache: path.join(PROJECT_ROOT, 'tools', 'fonts-src', '.cache'),
  publicFonts: path.join(PROJECT_ROOT, 'public', 'fonts'),
  baseFonts: path.join(PROJECT_ROOT, 'public', 'fonts', 'base'),
  dlcFonts: path.join(PROJECT_ROOT, 'public', 'fonts', 'dlc'),
  baseCss: path.join(PROJECT_ROOT, 'src', 'styles', 'fonts.generated.css'),
  dlcCss: path.join(PROJECT_ROOT, 'src', 'styles', 'fonts.dlc.generated.css'),
  dist: path.join(PROJECT_ROOT, 'dist'),
  fontOps: path.join(PROJECT_ROOT, 'scripts', 'font', 'font_ops.py')
};

/* 字体清单文件里每个 family 的 build 角色分配：
   - charRoles 决定该字重从哪些角色字符集取字；meta 优先于 text（同一 family/weight 内互斥）。
   - text 拆 core + mid；display 单独；latin/符号单独 face；dlc 覆盖 source cmap 剩余 CJK。
   noto-serif-sc 600 只服务 display（标题/加粗）；400 服务 text（正文/品牌）。
   lxgw / noto-sans 同时可被选为 readable 与 copy，所以 400 需要 text + meta 两套面。 */
export const FONT_FAMILIES = [
  {
    id: 'noto-serif-sc',
    family: 'Noto Serif SC',
    weights: [
      { weight: 400, charRoles: ['text'] },
      { weight: 600, charRoles: ['display'] }
    ]
  },
  {
    id: 'lxgw-wenkai-lite',
    family: 'LXGW WenKai Lite',
    weights: [{ weight: 400, charRoles: ['text', 'meta'] }]
  },
  {
    id: 'noto-sans-sc',
    family: 'Noto Sans SC',
    weights: [{ weight: 400, charRoles: ['text', 'meta'] }]
  }
];

export const FAMILY_IDS = FONT_FAMILIES.map((entry) => entry.id);

/* 分片目标（字节）。core 单文件落在 [min,max]，mid/meta/display 按 target 切分，DLC 按 target 切分。
   数值来自 design.md 5.1/5.2：core 150-200KB、mid 60-80KB、DLC 200KB；meta/display 取 mid 档。 */
export const TARGETS = {
  // 首屏预算收敛（Lead 2026-10-21 实测后调整）：core 150KB、mid 60KB、meta 50KB、display 40KB。
  core: { targetBytes: 150_000, minBytes: 145_000, maxBytes: 165_000 },
  mid: { targetBytes: 60_000 },
  meta: { targetBytes: 50_000 },
  display: { targetBytes: 40_000 },
  // 每块还要带 GSUB/GPOS 等表开销（约 10-20KB）。DLC target 从 180KB 提到 240KB：
  // 用户同意「单文件略大」换取更少分片（当前内容 121 → 82 faces）与更少的逐字 miss；
  // 实测单块 177-312KB（中位约 254KB），验收上限为单文件 ≤330KB。
  // 单个 miss 的最坏字节上升是显式取舍，首屏 base 体积不受影响。
  dlc: { targetBytes: 240_000 }
};

/* core 从频率排序后的 text 字符里单文件拟合；mid 只处理 core 之后剩余字符，
   所以 core 候选数要大于目标容量。按 Noto Serif 约 180 B/字估算，2500 字足够达到 200KB。 */
export const CORE_CANDIDATE_CHARS = 2500;

/* display/meta 在 dist 提取结果之外补 top-N 高频字作为安全余量（design.md 4.2：建议 200-300）。
   display 取上限 300：标题用字随内容编辑漂移最敏感，余量从 100 提到 300 后新标题字更可能直接落在
   display base（当前内容实测 35KB → 57KB），而不是每次 miss 都拉一个 177-312KB 的 DLC 分片；
   这是「单文件略大、避免频繁下载」的显式取舍。meta 保持 100，首屏体积不变。 */
export const SAFETY_PRIOR_CHARS = {
  display: 300,
  meta: 100
};

/* 拉丁/符号 face 的固定码位范围（design.md 4.2）。实际 unicode-range 取 source cmap 交集。 */
export const LATIN_RANGES = [
  [0x0000, 0x00ff],
  [0x0100, 0x024f],
  [0x2000, 0x206f],
  [0x2190, 0x22ff],
  [0x3000, 0x303f],
  [0xff00, 0xffef]
];

/* DLC 覆盖的 CJK/Ext 范围；完整模式只对这些范围做 DLC，避免把符号表也搬进 200KB 分片。 */
export const CJK_RANGES = [
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0x20000, 0x2a6df], // Extension B
  [0x2a700, 0x2b73f], // Extension C
  [0x2b740, 0x2b81f], // Extension D
  [0x2b820, 0x2ceaf], // Extension E/F
  [0x2ceb0, 0x2ebef], // Extension F/I
  [0x2f800, 0x2fa1f], // CJK Compatibility Ideographs Supplement
  [0x30000, 0x3134f] // Extension G/H
];

/* 基础覆盖的 3500 常用字基线从 charset-base.txt 读取；font:check 用同一常量断言。 */
export const BASELINE_CHARSET_PATH = PATHS.charsetBase;

/* 生成 CSS 的字体 URL 前缀。当前 public 资产按站点根绝对路径引用（与历史 global.css 一致）；
   子路径部署由 Lead 在页面接线阶段验证/调整。 */
export const FONT_URL_PREFIX = '/fonts';
