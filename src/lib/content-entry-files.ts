import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseMarkdownFrontmatterDocument, splitMarkdownFrontmatter } from './frontmatter';
import { isRecord } from './is-record';

export type ContentEntryFile = {
  entryId: string;
  filePath: string;
};

type CandidateFile = {
  fileName: string;
  filePath: string;
  rawFrontmatter: Record<string, unknown>;
};

const MARKDOWN_EXT_RE = /\.md$/i;
const ASSET_DIR_NAMES = new Set(['images', 'files', 'assets']);

export const readRawFrontmatter = (source: string): Record<string, unknown> => {
  const section = splitMarkdownFrontmatter(source);
  const document = parseMarkdownFrontmatterDocument(section.frontmatterText);
  const value = document.toJS();
  return isRecord(value) ? value : {};
};

const readCandidateFiles = async (directory: string): Promise<CandidateFile[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && MARKDOWN_EXT_RE.test(entry.name))
    .map((entry) => entry.name);

  const candidates: CandidateFile[] = [];
  for (const fileName of files) {
    const filePath = path.join(directory, fileName);
    const source = await readFile(filePath, 'utf8');
    let rawFrontmatter: Record<string, unknown> = {};
    try {
      rawFrontmatter = readRawFrontmatter(source);
    } catch {
      // 主文件选择不应因 frontmatter 损坏而丢弃条目；后台列表会单独显示解析错误。
    }
    candidates.push({
      fileName,
      filePath,
      rawFrontmatter
    });
  }
  return candidates;
};

/**
 * 每条目目录的主 Markdown：
 * 1. `index.md`；
 * 2. 目录内唯一的 `.md`；
 * 3. 唯一一个 `entry: true`。
 * 多个候选或没有候选时报错，避免 Astro 把同目录多个 md 都当成条目。
 */
const resolveMainMarkdown = (
  projectRoot: string,
  directory: string,
  candidates: readonly CandidateFile[]
): CandidateFile => {
  const indexFile = candidates.find((candidate) => candidate.fileName.toLowerCase() === 'index.md');
  if (indexFile) return indexFile;

  if (candidates.length === 1) return candidates[0]!;

  const flagged = candidates.filter((candidate) => candidate.rawFrontmatter.entry === true);
  if (flagged.length === 1) return flagged[0]!;

  const relativeDirectory = path.relative(projectRoot, directory).replace(/\\/g, '/');
  if (flagged.length > 1) {
    throw new Error(
      `条目目录存在多个 entry: true 主文件：${relativeDirectory}（${flagged
        .map((candidate) => candidate.fileName)
        .join(', ')}）`
    );
  }
  throw new Error(
    `无法确定条目主文件：${relativeDirectory}。请提供 index.md、保留唯一 .md，或给一个文件标记 entry: true。`
  );
};

const collectEntryDirectories = async (
  root: string,
  relativeDirectory = ''
): Promise<Array<{ entryId: string; directory: string }>> => {
  const directory = relativeDirectory ? path.join(root, ...relativeDirectory.split('/')) : root;
  if (!existsSync(directory)) return [];

  const directoryEntries = await readdir(directory, { withFileTypes: true });
  const candidates = await readCandidateFiles(directory);

  if (candidates.length > 0) {
    return [{
      entryId: relativeDirectory || path.basename(root),
      directory
    }];
  }

  const results: Array<{ entryId: string; directory: string }> = [];
  for (const entry of directoryEntries) {
    if (!entry.isDirectory() || ASSET_DIR_NAMES.has(entry.name)) continue;
    const childRelative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    results.push(...await collectEntryDirectories(root, childRelative));
  }
  return results;
};

export const resolveCollectionEntryFiles = async (
  projectRoot: string,
  collectionRoot: string,
  fixedPageSourcePath?: string
): Promise<ContentEntryFile[]> => {
  if (fixedPageSourcePath) {
    const filePath = path.join(projectRoot, ...fixedPageSourcePath.split('/'));
    if (!existsSync(filePath)) {
      throw new Error(`固定页面源文件不存在：${fixedPageSourcePath}`);
    }
    return [{ entryId: 'index', filePath }];
  }

  if (!existsSync(collectionRoot)) return [];
  const rootFiles = await readCandidateFiles(collectionRoot);
  if (rootFiles.length > 0) {
    throw new Error(
      `内容必须放在条目目录中：${path.relative(projectRoot, collectionRoot).replace(/\\/g, '/')} 下发现根级 Markdown 文件。`
    );
  }

  const directories = await collectEntryDirectories(collectionRoot);
  const resolved: ContentEntryFile[] = [];

  for (const entry of directories) {
    const candidates = await readCandidateFiles(entry.directory);
    if (candidates.length === 0) continue;
    const main = resolveMainMarkdown(projectRoot, entry.directory, candidates);
    resolved.push({ entryId: entry.entryId, filePath: main.filePath });
  }

  return resolved;
};
