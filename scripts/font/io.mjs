import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const readText = async (filePath) => fs.readFile(filePath, 'utf8');

export const readJson = async (filePath) =>
  JSON.parse(await fs.readFile(filePath, 'utf8'));

export const exists = (filePath) => existsSync(filePath);

export const ensureDir = (dirPath) => fs.mkdir(dirPath, { recursive: true });

export const removeDir = async (dirPath) => {
  await fs.rm(dirPath, { recursive: true, force: true });
};

export const writeText = async (filePath, contents) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, 'utf8');
};

export const sha256Text = (text) => createHash('sha256').update(text).digest('hex');

export const sha256Buffer = (buffer) => createHash('sha256').update(buffer).digest('hex');

export const sha256File = async (filePath) => sha256Buffer(await fs.readFile(filePath));

/** 递归列出目录下匹配扩展名的文件（不存在时返回空数组）。 */
export const listFiles = async (dirPath, extensions) => {
  const results = [];
  const walk = async (current) => {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (extensions.includes(path.extname(entry.name))) {
        results.push(full);
      }
    }
  };
  await walk(dirPath);
  return results.sort();
};

/** 人类可读字节数（报告用）。 */
export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/** 解析 `paths` 中不存在的文件，返回缺失列表（检查脚本共用）。 */
export const findMissingFiles = (paths) => paths.filter((filePath) => !existsSync(filePath));
