import { existsSync } from 'node:fs';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 图片重命名：只在原目录内改名，并同步改写全部内容源里的引用。
 * 替换按「目录限定 + 文件名」字面匹配，同时覆盖百分号编码变体。
 */

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.svg'
]);

/** 会被扫描并改写引用的源（与 `scripts/check-image-references.mjs` 的 SOURCE_DIRS 对齐）。 */
const SOURCE_DIRS: readonly { dir: string; exts: readonly string[] }[] = [
  { dir: 'content', exts: ['.md'] },
  { dir: 'src/test-fixtures', exts: ['.md'] },
  { dir: 'src/data/settings', exts: ['.json'] },
  { dir: 'src/pages', exts: ['.astro'] },
  { dir: 'src/components', exts: ['.astro'] },
  { dir: 'src/layouts', exts: ['.astro'] }
];

export class AdminImageRenameError extends Error {
  readonly status: number;

  readonly code: string;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'AdminImageRenameError';
    this.code = code;
    this.status = status;
  }
}

type AdminImageRenameRewrite = {
  file: string;
  count: number;
};

type AdminImageRenameResult = {
  /** 旧的公开路径（以 `images/` 开头、不含前导斜杠） */
  from: string;
  /** 新的公开路径 */
  to: string;
  /** 新文件名 */
  fileName: string;
  rewritten: AdminImageRenameRewrite[];
};

const getProjectRoot = (projectRoot?: string): string =>
  projectRoot?.trim()
  || process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim()
  || process.cwd();

/**
 * 把控制台给出的路径归一为 `images/...`（public 图片）或 `content/...`（条目图片）。
 * 去前导斜杠、统一分隔符、去 `public/` 前缀。
 */
export const normalizeAdminImageRenamePath = (value: string): string => {
  const normalized = (value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^public\//, '')
    .replace(/\/+$/, '');

  if (!normalized.startsWith('images/') && !normalized.startsWith('content/')) {
    throw new AdminImageRenameError(
      'invalid-source',
      400,
      `只能重命名 public/images/ 或 content/ 下的图片：${value}`
    );
  }
  if (normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new AdminImageRenameError('invalid-source', 400, `不支持的图片路径：${value}`);
  }
  return normalized;
};

/**
 * 清洗用户输入的新文件名：允许 CJK，不允许路径分隔符、`..` 与空名；
 * 扩展名必须是受支持的图片类型，改名不移动位置。
 */
export const sanitizeAdminImageRenameTarget = (value: string, currentFileName: string): string => {
  const trimmed = (value ?? '').normalize('NFKC').trim();
  if (!trimmed) {
    throw new AdminImageRenameError('invalid-target', 400, '新文件名不能为空');
  }
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    throw new AdminImageRenameError('invalid-target', 400, '新文件名不能包含路径分隔符');
  }
  if (trimmed === '.' || trimmed === '..' || trimmed.startsWith('.')) {
    throw new AdminImageRenameError('invalid-target', 400, '新文件名不能以 . 开头');
  }
  if (/[<>:"|?*\u0000-\u001f]/.test(trimmed)) {
    throw new AdminImageRenameError('invalid-target', 400, '新文件名不能包含 < > : " | ? * 等字符');
  }

  const currentExt = path.extname(currentFileName).toLowerCase();
  const nextExt = path.extname(trimmed).toLowerCase();
  if (!nextExt) {
    return `${trimmed}${currentExt}`;
  }
  if (!IMAGE_EXTENSIONS.has(nextExt)) {
    throw new AdminImageRenameError('invalid-target', 400, `不支持的图片扩展名：${nextExt}`);
  }
  if (nextExt !== currentExt) {
    throw new AdminImageRenameError(
      'invalid-target',
      400,
      `扩展名必须保持不变（${currentExt}），避免改变文件类型`
    );
  }
  return trimmed;
};

const walkSources = async (root: string, dir: string, exts: readonly string[], out: string[]) => {
  const full = path.join(root, dir);
  if (!existsSync(full)) return;
  for (const entry of await readdir(full, { withFileTypes: true })) {
    const entryPath = path.join(full, entry.name);
    if (entry.isDirectory()) {
      await walkSources(root, path.relative(root, entryPath), exts, out);
      continue;
    }
    if (exts.includes(path.extname(entry.name).toLowerCase())) out.push(entryPath);
  }
};

/** 需要改写引用的全部源文件（内容 + 设置 + 引用图片的页面/组件）。 */
const collectAdminImageRenameSources = async (projectRoot?: string): Promise<string[]> => {
  const root = getProjectRoot(projectRoot);
  const out: string[] = [];
  for (const source of SOURCE_DIRS) {
    await walkSources(root, source.dir, source.exts, out);
  }
  return out.sort();
};

/**
 * 重命名一张图片并同步改写全部引用。
 * 不覆盖已存在的目标文件，不跨目录移动，不处理云端图片。
 */
export const renameAdminImage = async (
  input: { from: string; to: string },
  options: { projectRoot?: string } = {}
): Promise<AdminImageRenameResult> => {
  const root = getProjectRoot(options.projectRoot);
  const from = normalizeAdminImageRenamePath(input.from);
  const isContentPath = from.startsWith('content/');
  const sourceAbsolute = isContentPath
    ? path.join(root, ...from.split('/'))
    : path.join(root, 'public', from);

  if (!existsSync(sourceAbsolute)) {
    throw new AdminImageRenameError('source-not-found', 404, `图片不存在：${from}`);
  }

  const currentFileName = path.basename(from);
  const fileName = sanitizeAdminImageRenameTarget(input.to, currentFileName);
  if (fileName === currentFileName) {
    throw new AdminImageRenameError('no-op', 400, '新文件名与原文件名相同');
  }

  const fromDir = from.slice(0, from.length - currentFileName.length);
  const to = `${fromDir}${fileName}`;
  const targetAbsolute = isContentPath
    ? path.join(root, ...to.split('/'))
    : path.join(root, 'public', to);
  if (existsSync(targetAbsolute)) {
    throw new AdminImageRenameError('target-exists', 409, `目标文件已存在，未做任何改动：${to}`);
  }

  await rename(sourceAbsolute, targetAbsolute);

  // 引用改写：同一目录下两种写法 + 百分号编码变体
  const encodedFrom = encodeURI(from);
  const encodedTo = encodeURI(to);
  const candidates: [pattern: string, next: string][] = [
    [`/${from}`, `/${to}`],
    [from, to],
    // 百分号编码的写法保持同样的风格
    [`/${encodedFrom}`, `/${encodedTo}`],
    [encodedFrom, encodedTo]
  ];
  if (isContentPath) {
    const fromSegments = from.split('/');
    const toSegments = to.split('/');
    const ownerDepth = Math.min(3, fromSegments.length);
    const relativeFrom = fromSegments.slice(ownerDepth).join('/');
    const relativeTo = toSegments.slice(ownerDepth).join('/');
    if (relativeFrom && relativeTo && relativeFrom !== relativeTo) {
      candidates.push([relativeFrom, relativeTo]);
      candidates.push([`./${relativeFrom}`, `./${relativeTo}`]);
    }
  }

  const replacements = candidates.filter(([pattern, next]) => pattern !== next);

  const rewritten: AdminImageRenameRewrite[] = [];
  for (const file of await collectAdminImageRenameSources(root)) {
    let text = await readFile(file, 'utf8');
    let count = 0;
    for (const [pattern, next] of replacements) {
      if (!text.includes(pattern)) continue;
      count += text.split(pattern).length - 1;
      text = text.split(pattern).join(next);
    }
    if (count === 0) continue;
    await writeFile(file, text, 'utf8');
    rewritten.push({ file: path.relative(root, file), count });
  }

  return { from, to, fileName, rewritten };
};
