/**
 * 资源台附件缩略图的纯函数映射。
 *
 * 只负责「扩展名 → 标签 / 色调 / 图标」，DOM 与 SVG 由调用方组装，
 * 这样在 Node 环境里可以直接断言映射结果。
 */

export type MediaFileIcon =
  | 'file'
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'archive'
  | 'text'
  | 'code'
  | 'data'
  | 'audio'
  | 'video'
  | 'font'
  | 'image';

export type MediaFileTone =
  | 'red'
  | 'blue'
  | 'green'
  | 'emerald'
  | 'amber'
  | 'violet'
  | 'cyan'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'teal'
  | 'slate'
  | 'stone';

export type MediaFileVisual = {
  label: string;
  tone: MediaFileTone;
  icon: MediaFileIcon;
};

type MediaFilePreset = Pick<MediaFileVisual, 'tone' | 'icon'>;

const PAGE_OUTLINE = [
  'M7 3.5h6.2l5.3 5.3V20.5H7z',
  'M13.2 3.5v5.3h5.3'
] as const;

const DOCUMENT_LINES = ['M9.7 12.2h5', 'M9.7 15h5', 'M9.7 17.8h3.2'] as const;

/** 24 × 24 视图框内的描边路径；图标独立绘制，便于按尺寸复用。 */
export const MEDIA_FILE_ICON_PATHS: Record<MediaFileIcon, readonly string[]> = {
  file: PAGE_OUTLINE,
  pdf: [...PAGE_OUTLINE, 'M9.7 17.5v-4.6h2.1a1.9 1.9 0 0 1 0 3.8H9.7'],
  doc: [...PAGE_OUTLINE, ...DOCUMENT_LINES],
  text: [...PAGE_OUTLINE, ...DOCUMENT_LINES],
  sheet: [
    'M5 4.5h14v15H5z',
    'M9.7 4.5v15',
    'M14.3 4.5v15',
    'M5 9.7h14',
    'M5 14.3h14'
  ],
  archive: [
    'M5 4.5h14v3.2H5z',
    'M6.3 7.7h11.4v12.8H6.3z',
    'M12 7.7v3',
    'M10.9 10.7h2.2v2.6h-2.2z',
    'M12 13.3v4'
  ],
  code: ['m9.2 7.4-4.7 4.6 4.7 4.6', 'm14.8 7.4 4.7 4.6-4.7 4.6'],
  data: [
    'M9.5 4.5H8.3A2.3 2.3 0 0 0 6 6.8v2.7c0 1.5-.9 2.5-2.3 2.5 1.4 0 2.3 1 2.3 2.5v2.7a2.3 2.3 0 0 0 2.3 2.3h1.2',
    'M14.5 4.5h1.2A2.3 2.3 0 0 1 18 6.8v2.7c0 1.5.9 2.5 2.3 2.5-1.4 0-2.3 1-2.3 2.5v2.7a2.3 2.3 0 0 1-2.3 2.3h-1.2'
  ],
  audio: [
    'M9.4 16.6V7.2l9-1.5v9.3',
    'M5.4 16.4a2 2 0 1 1 4 0 2 2 0 0 1-4 0',
    'M14.4 14.9a2 2 0 1 1 4 0 2 2 0 0 1-4 0'
  ],
  video: ['M4.5 6.2h11.2v11.6H4.5z', 'm15.7 10.2 4.3-2.4v8.4l-4.3-2.4z'],
  font: ['M5.8 19.2 11.2 5.2h1.6l5.4 14', 'M8.2 14.1h7.6'],
  image: [
    'M4.5 5h15v14h-15z',
    'm5.8 16.2 4.2-4.2 3.1 3.1 2.2-2.2 3.4 3.4',
    'M9.2 9.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0'
  ]
};

const EXTENSION_PRESETS: Record<string, MediaFilePreset> = {
  pdf: { tone: 'red', icon: 'pdf' },
  doc: { tone: 'blue', icon: 'doc' },
  docx: { tone: 'blue', icon: 'doc' },
  rtf: { tone: 'blue', icon: 'doc' },
  odt: { tone: 'blue', icon: 'doc' },
  pages: { tone: 'blue', icon: 'doc' },
  xls: { tone: 'green', icon: 'sheet' },
  xlsx: { tone: 'green', icon: 'sheet' },
  csv: { tone: 'green', icon: 'sheet' },
  ods: { tone: 'green', icon: 'sheet' },
  tsv: { tone: 'green', icon: 'sheet' },
  zip: { tone: 'amber', icon: 'archive' },
  rar: { tone: 'amber', icon: 'archive' },
  '7z': { tone: 'amber', icon: 'archive' },
  tar: { tone: 'amber', icon: 'archive' },
  gz: { tone: 'amber', icon: 'archive' },
  tgz: { tone: 'amber', icon: 'archive' },
  bz2: { tone: 'amber', icon: 'archive' },
  xz: { tone: 'amber', icon: 'archive' },
  txt: { tone: 'slate', icon: 'text' },
  log: { tone: 'slate', icon: 'text' },
  md: { tone: 'teal', icon: 'text' },
  markdown: { tone: 'teal', icon: 'text' },
  mdx: { tone: 'teal', icon: 'text' },
  json: { tone: 'cyan', icon: 'data' },
  yaml: { tone: 'cyan', icon: 'data' },
  yml: { tone: 'cyan', icon: 'data' },
  toml: { tone: 'cyan', icon: 'data' },
  xml: { tone: 'cyan', icon: 'data' },
  ini: { tone: 'cyan', icon: 'data' },
  env: { tone: 'cyan', icon: 'data' },
  js: { tone: 'violet', icon: 'code' },
  mjs: { tone: 'violet', icon: 'code' },
  cjs: { tone: 'violet', icon: 'code' },
  ts: { tone: 'violet', icon: 'code' },
  tsx: { tone: 'violet', icon: 'code' },
  jsx: { tone: 'violet', icon: 'code' },
  css: { tone: 'violet', icon: 'code' },
  scss: { tone: 'violet', icon: 'code' },
  less: { tone: 'violet', icon: 'code' },
  html: { tone: 'violet', icon: 'code' },
  htm: { tone: 'violet', icon: 'code' },
  sh: { tone: 'violet', icon: 'code' },
  bash: { tone: 'violet', icon: 'code' },
  zsh: { tone: 'violet', icon: 'code' },
  py: { tone: 'violet', icon: 'code' },
  go: { tone: 'violet', icon: 'code' },
  rs: { tone: 'violet', icon: 'code' },
  java: { tone: 'violet', icon: 'code' },
  c: { tone: 'violet', icon: 'code' },
  h: { tone: 'violet', icon: 'code' },
  cpp: { tone: 'violet', icon: 'code' },
  hpp: { tone: 'violet', icon: 'code' },
  cc: { tone: 'violet', icon: 'code' },
  cs: { tone: 'violet', icon: 'code' },
  php: { tone: 'violet', icon: 'code' },
  rb: { tone: 'violet', icon: 'code' },
  swift: { tone: 'violet', icon: 'code' },
  kt: { tone: 'violet', icon: 'code' },
  lua: { tone: 'violet', icon: 'code' },
  sql: { tone: 'violet', icon: 'code' },
  vue: { tone: 'violet', icon: 'code' },
  svelte: { tone: 'violet', icon: 'code' },
  mp3: { tone: 'pink', icon: 'audio' },
  wav: { tone: 'pink', icon: 'audio' },
  flac: { tone: 'pink', icon: 'audio' },
  ogg: { tone: 'pink', icon: 'audio' },
  m4a: { tone: 'pink', icon: 'audio' },
  aac: { tone: 'pink', icon: 'audio' },
  opus: { tone: 'pink', icon: 'audio' },
  mp4: { tone: 'purple', icon: 'video' },
  mov: { tone: 'purple', icon: 'video' },
  webm: { tone: 'purple', icon: 'video' },
  mkv: { tone: 'purple', icon: 'video' },
  avi: { tone: 'purple', icon: 'video' },
  m4v: { tone: 'purple', icon: 'video' },
  ogv: { tone: 'purple', icon: 'video' },
  woff: { tone: 'orange', icon: 'font' },
  woff2: { tone: 'orange', icon: 'font' },
  ttf: { tone: 'orange', icon: 'font' },
  otf: { tone: 'orange', icon: 'font' },
  eot: { tone: 'orange', icon: 'font' },
  png: { tone: 'emerald', icon: 'image' },
  jpg: { tone: 'emerald', icon: 'image' },
  jpeg: { tone: 'emerald', icon: 'image' },
  gif: { tone: 'emerald', icon: 'image' },
  webp: { tone: 'emerald', icon: 'image' },
  avif: { tone: 'emerald', icon: 'image' },
  svg: { tone: 'emerald', icon: 'image' },
  ico: { tone: 'emerald', icon: 'image' },
  bmp: { tone: 'emerald', icon: 'image' },
  tif: { tone: 'emerald', icon: 'image' },
  tiff: { tone: 'emerald', icon: 'image' },
  psd: { tone: 'emerald', icon: 'image' },
  ai: { tone: 'emerald', icon: 'image' },
  fig: { tone: 'emerald', icon: 'image' },
  sketch: { tone: 'emerald', icon: 'image' }
};

const LABEL_OVERRIDES: Record<string, string> = {
  markdown: 'MD',
  jpeg: 'JPG',
  tiff: 'TIF',
  yaml: 'YAML',
  yml: 'YML'
};

/** 取小写扩展名，忽略路径与查询串；没有扩展名时返回空串。 */
export const getMediaFileExtension = (fileName: string): string => {
  const baseName = fileName.split(/[\\/]/).pop() ?? '';
  const match = /\.([a-z0-9]+)$/i.exec(baseName);
  return (match?.[1] ?? '').toLowerCase();
};

/** 扩展名 → 缩略图标签、色调与图标；未知格式统一回退到中性文件图标。 */
export const resolveMediaFileVisual = (fileName: string): MediaFileVisual => {
  const extension = getMediaFileExtension(fileName);
  const preset = EXTENSION_PRESETS[extension];
  if (!preset) {
    return {
      label: extension ? extension.toUpperCase().slice(0, 5) : 'FILE',
      tone: 'stone',
      icon: 'file'
    };
  }
  return {
    label: LABEL_OVERRIDES[extension] ?? extension.toUpperCase().slice(0, 5),
    ...preset
  };
};

/**
 * 字节数 → 展示文案（B / KB / MB）。
 *
 * 全仓唯一的尺寸格式化实现：`admin-resources` 等控制台脚本一律 import，
 * 不要在各自模块里再复制一份，否则同一张图片在不同面板里会显示成不同字符串。
 */
export const formatSize = (size: number): string => {
  if (!size || size <= 0) return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * 修改时间（毫秒时间戳）→ `zh-CN` 年月日。
 *
 * `fallback` 是空值占位符：资源台用 `'—'`，其它面板若需要空串可显式传入。
 */
export const formatTime = (mtimeMs: number | null, fallback = '—'): string => {
  if (!mtimeMs) return fallback;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(mtimeMs));
};
