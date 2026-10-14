import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const walk = async (dir, exts, results) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, exts, results);
      continue;
    }
    if (exts.includes(path.extname(entry.name))) results.push(full);
  }
};

// 按 dirs/files 顺序收集文件；缺失的目录与文件跳过，便于脚本在部分 checkout 下可用。
// dirs: [{ dir, exts }]（相对 root 或绝对路径）；files: 相对 root 或绝对路径的可选单文件。
export const collectSourceFiles = async (root, { dirs = [], files = [] } = {}) => {
  const results = [];
  for (const { dir, exts } of dirs) {
    await walk(path.isAbsolute(dir) ? dir : path.join(root, dir), exts, results);
  }
  for (const file of files) {
    const full = path.isAbsolute(file) ? file : path.join(root, file);
    if (existsSync(full)) results.push(full);
  }
  return results;
};
