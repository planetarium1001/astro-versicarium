import { existsSync } from 'node:fs';
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_ROOT } from '../../../site.config.mjs';
import { getProjectRoot } from '../project-root';
import { toAdminContentAbsoluteProjectPath } from './content-entry-source';

/**
 * 媒体批量操作：重命名 / 删除 / 移动。
 * 所有路径都必须落在 content/ 或 public/images/ 内；不处理 Markdown 主文件，
 * 避免误删条目。重命名/移动后会同步改写 content/ 里的引用。
 */

export type AdminMediaBatchAction = 'rename' | 'delete' | 'move';

export type AdminMediaBatchItemInput = {
  path: string;
  name?: string;
  to?: string;
};

export type AdminMediaBatchItemResult = {
  path: string;
  action: AdminMediaBatchAction;
  ok: boolean;
  to?: string;
  error?: string;
};

export type AdminMediaBatchResult = {
  ok: boolean;
  action: AdminMediaBatchAction;
  results: AdminMediaBatchItemResult[];
  okCount: number;
  failedCount: number;
};

export class AdminMediaBatchError extends Error {
  readonly status: number;

  readonly code: string;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'AdminMediaBatchError';
    this.code = code;
    this.status = status;
  }
}

const MARKDOWN_EXT_RE = /\.(?:md|mdx)$/i;
/** 规范化并校验媒体路径；只允许 content/ 或 public/images/ 下的文件。 */
export const normalizeAdminMediaPath = (value: string): string => {
  const normalized = (value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (
    !normalized
    || normalized.startsWith('/')
    || !/^(?:content|public\/images)\//.test(normalized)
  ) {
    throw new AdminMediaBatchError(
      'invalid-path',
      400,
      `只能操作 content/ 或 public/images/ 下的文件：${value}`
    );
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new AdminMediaBatchError('invalid-path', 400, `不支持的媒体路径：${value}`);
  }
  if (CONTENT_ROOT && normalized.startsWith(`${CONTENT_ROOT}/`) && MARKDOWN_EXT_RE.test(normalized)) {
    throw new AdminMediaBatchError('invalid-path', 400, '批量操作不允许修改 Markdown 主文件');
  }

  const absolutePath = path.join(getProjectRoot(), ...segments);
  const projectRoot = path.resolve(getProjectRoot());
  if (absolutePath !== projectRoot && !absolutePath.startsWith(`${projectRoot}${path.sep}`)) {
    throw new AdminMediaBatchError('invalid-path', 400, `媒体路径越界：${value}`);
  }
  return normalized;
};

const assertExistingFile = async (relativePath: string): Promise<void> => {
  const absolutePath = toAdminContentAbsoluteProjectPath(relativePath);
  if (!existsSync(absolutePath)) {
    throw new AdminMediaBatchError('not-found', 404, `文件不存在：${relativePath}`);
  }
  const fileStat = await stat(absolutePath);
  if (!fileStat.isFile()) {
    throw new AdminMediaBatchError('not-a-file', 400, `目标不是文件：${relativePath}`);
  }
};

const sanitizeTargetName = (value: string, currentFileName: string): string => {
  const trimmed = (value ?? '').normalize('NFKC').trim();
  if (!trimmed) {
    throw new AdminMediaBatchError('invalid-target', 400, '新文件名不能为空');
  }
  if (/[/\\]/.test(trimmed) || trimmed === '.' || trimmed === '..' || trimmed.startsWith('.')) {
    throw new AdminMediaBatchError('invalid-target', 400, '新文件名不能包含路径分隔符或以 . 开头');
  }
  if (/[<>:"|?*\u0000-\u001f]/.test(trimmed)) {
    throw new AdminMediaBatchError('invalid-target', 400, '新文件名不能包含 < > : " | ? * 等字符');
  }

  const currentExtension = path.extname(currentFileName).toLowerCase();
  const nextExtension = path.extname(trimmed).toLowerCase();
  if (!nextExtension) return `${trimmed}${currentExtension}`;
  if (nextExtension !== currentExtension) {
    throw new AdminMediaBatchError(
      'invalid-target',
      400,
      `扩展名必须保持不变（${currentExtension || '无扩展名'}）`
    );
  }
  return trimmed;
};

const normalizeTargetDirectory = (value: string): string => {
  const normalized = (value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!normalized || !/^(?:content|public\/images)(?:\/|$)/.test(normalized)) {
    throw new AdminMediaBatchError(
      'invalid-target',
      400,
      '移动目标必须是 content/ 或 public/images/ 下的目录'
    );
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new AdminMediaBatchError('invalid-target', 400, `不支持的移动目标目录：${value}`);
  }
  const absoluteTarget = path.join(getProjectRoot(), ...segments);
  const projectRoot = path.resolve(getProjectRoot());
  if (absoluteTarget !== projectRoot && !absoluteTarget.startsWith(`${projectRoot}${path.sep}`)) {
    throw new AdminMediaBatchError('invalid-target', 400, `移动目标越界：${value}`);
  }
  return normalized;
};

const assertTargetDirectory = async (relativePath: string): Promise<void> => {
  const absolutePath = toAdminContentAbsoluteProjectPath(relativePath);
  if (!existsSync(absolutePath)) {
    throw new AdminMediaBatchError('target-not-found', 404, `目标目录不存在：${relativePath}`);
  }
  const targetStat = await stat(absolutePath);
  if (!targetStat.isDirectory()) {
    throw new AdminMediaBatchError('target-not-directory', 400, `目标不是目录：${relativePath}`);
  }
};

const rewriteSourceFiles = async (): Promise<string[]> => {
  const contentRoot = path.join(getProjectRoot(), CONTENT_ROOT);
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    if (!existsSync(directory)) return;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && MARKDOWN_EXT_RE.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };
  await visit(contentRoot);
  return files.sort();
};

const findContentEntryRoot = async (relativePath: string): Promise<string | null> => {
  if (!relativePath.startsWith(`${CONTENT_ROOT}/`)) return null;
  let directory = path.posix.dirname(relativePath);
  while (directory.startsWith(`${CONTENT_ROOT}/`) && directory !== CONTENT_ROOT) {
    try {
      const entries = await readdir(toAdminContentAbsoluteProjectPath(directory), { withFileTypes: true });
      if (entries.some((entry) => entry.isFile() && MARKDOWN_EXT_RE.test(entry.name))) {
        return directory;
      }
    } catch {
      // 目录已不存在时继续向上找。
    }
    const parent = path.posix.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
};

const buildReferenceReplacements = (
  from: string,
  to: string,
  fromEntryRoot: string | null,
  toEntryRoot: string | null
): Array<[string, string]> => {
  const replacements: Array<[string, string]> = [];
  const add = (pattern: string, next: string) => {
    if (pattern && next && pattern !== next) replacements.push([pattern, next]);
  };

  add(from, to);
  add(`/${from}`, `/${to}`);
  if (from.startsWith('public/') && to.startsWith('public/')) {
    const fromWebPath = `/${from.slice('public/'.length)}`;
    const toWebPath = `/${to.slice('public/'.length)}`;
    add(fromWebPath, toWebPath);
    add(fromWebPath.slice(1), toWebPath.slice(1));
  }
  if (fromEntryRoot && toEntryRoot) {
    const fromRelative = from.slice(fromEntryRoot.length + 1);
    const toRelative = to.slice(toEntryRoot.length + 1);
    add(fromRelative, toRelative);
    add(`./${fromRelative}`, `./${toRelative}`);
  }

  return replacements.sort((left, right) => right[0].length - left[0].length);
};

const rewriteReferences = async (from: string, to: string): Promise<void> => {
  const [fromEntryRoot, toEntryRoot] = await Promise.all([
    findContentEntryRoot(from),
    findContentEntryRoot(to)
  ]);
  const replacements = buildReferenceReplacements(from, to, fromEntryRoot, toEntryRoot);
  if (replacements.length === 0) return;

  for (const file of await rewriteSourceFiles()) {
    let source = await readFile(file, 'utf8');
    let changed = false;
    for (const [variant, next] of replacements) {
      if (!source.includes(variant)) continue;
      source = source.split(variant).join(next);
      changed = true;
    }
    if (changed) {
      await writeFile(file, source, 'utf8');
    }
  }
};

const runBatchItem = async (
  action: AdminMediaBatchAction,
  item: AdminMediaBatchItemInput
): Promise<AdminMediaBatchItemResult> => {
  const sourcePath = normalizeAdminMediaPath(item.path);
  await assertExistingFile(sourcePath);
  const sourceFileName = path.posix.basename(sourcePath);
  const sourceDirectory = path.posix.dirname(sourcePath);

  if (action === 'delete') {
    await rm(toAdminContentAbsoluteProjectPath(sourcePath), { force: false });
    return { path: sourcePath, action, ok: true };
  }

  if (action === 'rename') {
    const fileName = sanitizeTargetName(item.name ?? '', sourceFileName);
    if (fileName === sourceFileName) {
      throw new AdminMediaBatchError('no-op', 400, `新文件名与原文件名相同：${sourcePath}`);
    }
    const targetPath = `${sourceDirectory}/${fileName}`;
    if (existsSync(toAdminContentAbsoluteProjectPath(targetPath))) {
      throw new AdminMediaBatchError('target-exists', 409, `目标文件已存在：${targetPath}`);
    }
    await rename(toAdminContentAbsoluteProjectPath(sourcePath), toAdminContentAbsoluteProjectPath(targetPath));
    await rewriteReferences(sourcePath, targetPath);
    return { path: sourcePath, action, ok: true, to: targetPath };
  }

  const targetDirectory = normalizeTargetDirectory(item.to ?? '');
  await assertTargetDirectory(targetDirectory);
  const targetPath = `${targetDirectory}/${sourceFileName}`;
  if (targetPath === sourcePath) {
    throw new AdminMediaBatchError('no-op', 400, `文件已经在该目录：${sourcePath}`);
  }
  if (existsSync(toAdminContentAbsoluteProjectPath(targetPath))) {
    throw new AdminMediaBatchError('target-exists', 409, `目标文件已存在：${targetPath}`);
  }
  await rename(toAdminContentAbsoluteProjectPath(sourcePath), toAdminContentAbsoluteProjectPath(targetPath));
  await rewriteReferences(sourcePath, targetPath);
  return { path: sourcePath, action, ok: true, to: targetPath };
};

export const runAdminMediaBatch = async ({
  action,
  items
}: {
  action: AdminMediaBatchAction;
  items: readonly AdminMediaBatchItemInput[];
}): Promise<AdminMediaBatchResult> => {
  if (action !== 'rename' && action !== 'delete' && action !== 'move') {
    throw new AdminMediaBatchError('invalid-action', 400, `不支持的批量操作：${String(action)}`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AdminMediaBatchError('empty-items', 400, '批量操作至少要选择一个文件');
  }
  if (items.length > 100) {
    throw new AdminMediaBatchError('too-many-items', 400, '单次批量操作最多 100 个文件');
  }

  const results: AdminMediaBatchItemResult[] = [];
  for (const item of items) {
    const itemPath = typeof item.path === 'string' ? item.path : '';
    try {
      results.push(await runBatchItem(action, { ...item, path: itemPath }));
    } catch (error) {
      results.push({
        path: itemPath,
        action,
        ok: false,
        error: error instanceof Error ? error.message : '批量操作失败'
      });
    }
  }

  const okCount = results.filter((result) => result.ok).length;
  return {
    ok: okCount === results.length,
    action,
    results,
    okCount,
    failedCount: results.length - okCount
  };
};
