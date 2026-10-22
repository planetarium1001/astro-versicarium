import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { PATHS } from './font/config.mjs';
import { formatBytes, readJson, writeText } from './font/io.mjs';

/* font:fetch：按 tools/font-sources.json 下载源字体到 tools/fonts-src/。
   - 本地文件存在且 SHA-256 匹配 → 命中缓存，不联网；
   - 缺失/哈希不符 → 多镜像测速（Range 请求测首字节延迟），按延迟顺序尝试下载；
   - 每个文件下载后校验 SHA-256，写 tools/font-sources.lock.json（实际 URL/时间/哈希/字节）。
   源字体不入库（.gitignore 已忽略 tools/fonts-src/）。 */

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const FORCE = args.has('--force');
const SPEED_TIMEOUT_MS = 4_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

const fail = (message, hint) => {
  console.error(`[font:fetch] ${message}`);
  if (hint) console.error(`- ${hint}`);
  process.exit(1);
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const fileMatches = async (filePath, expectedSha) => {
  try {
    const buffer = await fs.readFile(filePath);
    if (expectedSha && sha256(buffer) !== expectedSha) return { exists: true, ok: false, bytes: buffer.length };
    return { exists: true, ok: true, bytes: buffer.length };
  } catch {
    return { exists: false, ok: false, bytes: 0 };
  }
};

/** 用 Range 请求测镜像首字节延迟；失败返回 null。 */
const measureMirror = async (url) => {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-65535' },
      signal: AbortSignal.timeout(SPEED_TIMEOUT_MS)
    });
    if (!response.ok) return null;
    const firstByteMs = Date.now() - startedAt;
    // 只读取一小段用于确认可下载，不下载完整文件。
    if (response.body) {
      const reader = response.body.getReader();
      await reader.read();
      await reader.cancel();
    }
    return firstByteMs;
  } catch {
    return null;
  }
};

const rankMirrors = async (urls) => {
  const ranked = [];
  for (const [index, url] of urls.entries()) {
    const latency = await measureMirror(url);
    ranked.push({ url, index, latency });
    console.log(
      latency === null
        ? `[font:fetch]   mirror #${index + 1} 不可达: ${url}`
        : `[font:fetch]   mirror #${index + 1} 首字节 ${latency}ms: ${url}`
    );
  }
  return ranked
    .filter((entry) => entry.latency !== null)
    .sort((a, b) => a.latency - b.latency || a.index - b.index)
    .concat(ranked.filter((entry) => entry.latency === null));
};

const download = async (url, targetPath) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error('empty response body');
  const handle = await fs.open(targetPath, 'w');
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      hash.update(chunk);
      await handle.write(chunk);
      bytes += chunk.length;
    }
  } finally {
    await handle.close();
  }
  return { digest: hash.digest('hex'), bytes };
};

const fetchFile = async ({ fontId, file }) => {
  const targetPath = path.join(PATHS.fontsSrc, path.basename(file.path));
  const expectedSha = file.sha256 ?? null;
  const existing = await fileMatches(targetPath, expectedSha);
  if (!OFFLINE && !FORCE && existing.ok) {
    console.log(`[font:fetch] 命中缓存: ${path.relative(process.cwd(), targetPath)} (${formatBytes(existing.bytes)})`);
    return {
      ...file,
      localPath: targetPath,
      bytes: existing.bytes,
      sourceUrl: null,
      mirrorLatencyMs: null,
      fetchedAt: null,
      cached: true
    };
  }
  if (OFFLINE) {
    if (existing.ok) {
      console.log(`[font:fetch] 离线校验通过: ${path.relative(process.cwd(), targetPath)} (${formatBytes(existing.bytes)})`);
      return {
        ...file,
        localPath: targetPath,
        bytes: existing.bytes,
        sourceUrl: null,
        mirrorLatencyMs: null,
        fetchedAt: null,
        cached: true
      };
    }
    if (existing.exists) {
      fail(
        `离线模式下本地文件哈希不匹配: ${path.relative(process.cwd(), targetPath)}`,
        `期望 ${expectedSha ?? '(未记录)'}；删除后重新在线运行 npm run font:fetch`
      );
    }
    fail(
      `离线模式缺少源字体: ${path.relative(process.cwd(), targetPath)}`,
      '先在线运行 npm run font:fetch，或手工放入 tools/fonts-src/'
    );
  }

  const urls = Array.isArray(file.urls) ? file.urls.filter(Boolean) : [];
  if (urls.length === 0) {
    fail(`tools/font-sources.json 中 ${fontId} / ${file.path} 没有镜像 URL`, '补充 urls 后重试。');
  }
  await fs.mkdir(PATHS.fontsSrc, { recursive: true });
  const tempPath = `${targetPath}.download-${process.pid}`;
  console.log(`[font:fetch] 下载 ${fontId} / ${path.basename(file.path)}`);
  const ranked = await rankMirrors(urls);
  const failures = [];
  for (const mirror of ranked) {
    try {
      console.log(`[font:fetch]   尝试 ${mirror.url}`);
      const { digest, bytes } = await download(mirror.url, tempPath);
      if (expectedSha && digest !== expectedSha) {
        throw new Error(`SHA-256 不匹配（期望 ${expectedSha}，实际 ${digest}）`);
      }
      await fs.rename(tempPath, targetPath);
      console.log(
        `[font:fetch]   完成 ${formatBytes(bytes)} sha256=${digest}${expectedSha ? '' : '（清单未记录哈希，已写入 lock）'}`
      );
      return {
        ...file,
        localPath: targetPath,
        bytes,
        sha256: digest,
        sourceUrl: mirror.url,
        mirrorLatencyMs: mirror.latency,
        fetchedAt: new Date().toISOString(),
        cached: false
      };
    } catch (error) {
      failures.push(`${mirror.url}: ${error.message}`);
      await fs.rm(tempPath, { force: true });
      console.warn(`[font:fetch]   失败: ${error.message}`);
    }
  }
  fail(`所有镜像均失败: ${fontId} / ${path.basename(file.path)}`, failures.join(' | '));
};

const main = async () => {
  let sources;
  try {
    sources = await readJson(PATHS.fontSources);
  } catch {
    fail(
      `缺少或无法解析 ${path.relative(process.cwd(), PATHS.fontSources)}`,
      '先按 Phase 0 research/source-fonts.md 建立源字体清单（OFL 字体 + SHA-256 + 镜像 URL）。'
    );
  }
  const fonts = sources.fonts ?? {};
  const fontIds = Object.keys(fonts);
  if (fontIds.length === 0) fail('tools/font-sources.json 没有 fonts 条目。');

  console.log(`[font:fetch] 清单 ${fontIds.length} 个字体，模式=${OFFLINE ? 'offline' : 'online'}${FORCE ? '（强制重新下载）' : ''}`);
  const lock = { schemaVersion: 1, generatedAt: new Date().toISOString(), fonts: {} };

  for (const fontId of fontIds) {
    const entry = fonts[fontId];
    const files = Array.isArray(entry.files) ? entry.files : [];
    if (files.length === 0) fail(`${fontId} 没有 files 条目。`);
    const resolved = [];
    for (const file of files) {
      resolved.push(await fetchFile({ fontId, file }));
    }
    lock.fonts[fontId] = {
      family: entry.family ?? null,
      license: entry.license ?? null,
      version: entry.version ?? null,
      files: resolved.map((file) => ({
        path: path.basename(file.path),
        bytes: file.bytes,
        sha256: file.sha256 ?? null,
        sourceUrl: file.sourceUrl,
        mirrorLatencyMs: file.mirrorLatencyMs,
        fetchedAt: file.fetchedAt,
        cached: file.cached
      }))
    };
  }

  await writeText(PATHS.fontSourcesLock, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`[font:fetch] 完成，lock: ${path.relative(process.cwd(), PATHS.fontSourcesLock)}`);
};

await main();
