#!/usr/bin/env node
/**
 * check-deployment-base：校验 dist 产物里的部署 base 使用是否正确。
 *
 * 1. 禁止 `${base}${base}` 形式的重复前缀：内容集合 image() 返回的 ImageMetadata.src
 *    已带 base，再经 createWithBase() 补一次会产出 /<base>/<base>/... 的 404 URL。
 * 2. 所有以 base 开头的本地 URL（去掉 query/hash）必须能映射到 dist 内文件；
 *    目录按 index.html 解析。
 *
 * 用法：
 *   node ./scripts/check-deployment-base.mjs
 *   ASTRO_VERSICARIUM_BASE_PATH=/astro-versicarium/ node ./scripts/check-deployment-base.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_DIST_DIR = path.resolve('dist');
const SCAN_EXTENSIONS = new Set(['.html', '.json', '.xml', '.css']);
const MAX_REPORTED_PROBLEMS = 20;

export const normalizeDeploymentBase = (value) => {
  const segment = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  return segment ? `/${segment}/` : '/';
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripDecorations = (value) => {
  let out = value.trim();
  out = out.replace(/^<|>$/g, '').replace(/^["']|["']$/g, '').trim();
  return (out.split(/[?#]/, 1)[0] ?? '').trim();
};

// HTML/XML 属性、JSON 字符串与 CSS url() 都使用引号包裹；先取引号内 token，
// 再按 srcset 的空白/逗号分隔拆成候选 URL，避免误把 </script> 这类标签当路径。
const collectUrlCandidates = (content) => {
  const tokens = new Set();

  for (const match of content.matchAll(/"([^"\n]*)"/g)) tokens.add(match[1]);
  for (const match of content.matchAll(/'([^'\n]*)'/g)) tokens.add(match[1]);
  for (const match of content.matchAll(/url\(\s*(['"]?)([^)"'\s]+)\1\s*\)/g)) tokens.add(match[2]);

  const candidates = new Set();
  for (const token of tokens) {
    for (const part of token.split(/[\s,]+/)) {
      const decorated = stripDecorations(part);
      if (decorated) candidates.add(decorated);
    }
  }
  return candidates;
};

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isInside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

// 目录按 index.html 解析；无扩展名的路径再尝试 `<path>.html` 与 `<path>/index.html`。
const resolvesToArtifact = (target) => {
  if (existsSync(target)) {
    const stat = statSync(target);
    if (stat.isFile()) return true;
    if (stat.isDirectory() && existsSync(path.join(target, 'index.html'))) return true;
  }
  if (!path.extname(target)) {
    return existsSync(`${target}.html`) || existsSync(path.join(target, 'index.html'));
  }
  return false;
};

// 正文/摘录里可能夹带「/blog/。」这类以中文或英文标点收尾的站内路径，
// 去掉尾随标点后再解析一次，避免把自然语言标点当成 URL 的一部分。
const TRAILING_PUNCTUATION_RE = /[)\]}>.,;:!?'"`。，、；：！？）」』】》]+$/u;
const resolveCandidate = (distDir, candidate) => {
  const attempt = (value) => {
    const decoded = safeDecodeURIComponent(value).replace(/^\/+/, '');
    const target = path.resolve(distDir, decoded);
    return isInside(distDir, target) && resolvesToArtifact(target);
  };

  if (attempt(candidate)) return true;
  const trimmed = candidate.replace(TRAILING_PUNCTUATION_RE, '');
  return trimmed !== candidate && attempt(trimmed);
};


const collectDistFiles = (distDir) => {
  const files = [];
  const walk = (dirPath) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  };

  walk(distDir);
  return files;
};

const findDuplicateBaseUrls = (content, base) => {
  if (base === '/') return [];

  // 正常 URL 形如 /<base>/_astro/...；重复 base 后紧接的是下一段路径，
  // 因此带尾斜杠的标记不需要边界判断。另一个变体是 createWithBase 收到
  // 恰好等于 base 目录（无尾斜杠）的输入时拼出的 /<base>/<base>（结尾或紧跟分隔符）。
  const duplicateWithSlash = `${base}${base.slice(1)}`;
  const duplicateWithoutSlash = `${base}${base.slice(1, -1)}`;
  const results = [];

  for (const match of content.matchAll(new RegExp(escapeRegExp(duplicateWithSlash), 'g'))) {
    results.push(match[0]);
  }

  const withoutSlashPattern = new RegExp(
    `${escapeRegExp(duplicateWithoutSlash)}(?=[?#"'\\s<>&\\\\]|$)`,
    'g'
  );
  for (const match of content.matchAll(withoutSlashPattern)) {
    results.push(match[0]);
  }

  return results;
};

/**
 * @param {{ base?: string, distDir?: string, quiet?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, base: string, filesScanned: number, urlsChecked: number, duplicateUrls: string[], unresolvedUrls: string[] }>}
 */
export const checkDeploymentBase = async (options = {}) => {
  const base = normalizeDeploymentBase(options.base ?? process.env.ASTRO_VERSICARIUM_BASE_PATH ?? '/');
  const distDir = path.resolve(options.distDir ?? DEFAULT_DIST_DIR);
  const quiet = options.quiet === true;

  if (!existsSync(distDir)) {
    const message = `[check-deployment-base] dist 目录不存在：${distDir}，请先运行 npm run build`;
    if (!quiet) console.error(message);
    return {
      ok: false,
      base,
      filesScanned: 0,
      urlsChecked: 0,
      duplicateUrls: [],
      unresolvedUrls: [message]
    };
  }

  const baseWithoutSlash = base === '/' ? '' : base.replace(/\/+$/, '');
  const files = collectDistFiles(distDir);
  const duplicateUrls = [];
  const unresolvedUrls = [];
  let urlsChecked = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const relativeFile = path.relative(distDir, filePath) || filePath;

    for (const duplicate of findDuplicateBaseUrls(content, base)) {
      duplicateUrls.push(`${relativeFile}: ${duplicate}`);
    }

    for (const candidate of collectUrlCandidates(content)) {
      const isBasePath = candidate === baseWithoutSlash || candidate === base;
      if (!isBasePath && !candidate.startsWith(base)) continue;
      urlsChecked += 1;

      const withoutBase = isBasePath ? '' : candidate.slice(base.length);
      if (!resolveCandidate(distDir, withoutBase)) {
        unresolvedUrls.push(`${relativeFile}: ${candidate}`);
      }
    }
  }

  const ok = duplicateUrls.length === 0 && unresolvedUrls.length === 0;
  if (!quiet) {
    console.log(`[check-deployment-base] base=${base}，扫描 ${files.length} 个产物文件、${urlsChecked} 个本地 URL`);
    if (duplicateUrls.length > 0) {
      console.error(`[check-deployment-base] 发现 ${duplicateUrls.length} 处重复 base 前缀：`);
      for (const item of duplicateUrls.slice(0, MAX_REPORTED_PROBLEMS)) console.error(`  - ${item}`);
      if (duplicateUrls.length > MAX_REPORTED_PROBLEMS) {
        console.error(`  ...另有 ${duplicateUrls.length - MAX_REPORTED_PROBLEMS} 处未列出`);
      }
    }
    if (unresolvedUrls.length > 0) {
      console.error(`[check-deployment-base] 发现 ${unresolvedUrls.length} 个本地 URL 无法映射到 dist 文件：`);
      for (const item of unresolvedUrls.slice(0, MAX_REPORTED_PROBLEMS)) console.error(`  - ${item}`);
      if (unresolvedUrls.length > MAX_REPORTED_PROBLEMS) {
        console.error(`  ...另有 ${unresolvedUrls.length - MAX_REPORTED_PROBLEMS} 个未列出`);
      }
    }
    if (ok) console.log('[check-deployment-base] OK：无重复 base，全部本地 URL 均可解析');
  }

  return { ok, base, filesScanned: files.length, urlsChecked, duplicateUrls, unresolvedUrls };
};

const isDirectExecution = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isDirectExecution) {
  const result = await checkDeploymentBase();
  if (!result.ok) process.exit(1);
}
