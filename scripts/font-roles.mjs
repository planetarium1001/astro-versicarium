import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

import { PATHS } from './font/config.mjs';
import { formatBytes, listFiles, readText, writeText } from './font/io.mjs';
import {
  createEmptyRoleCharsets,
  extractRoleCharsets,
  mergeRoleCharsets,
  setToSortedString
} from './font/roles.mjs';

/* font:roles：从构建产物 dist 下的全部 HTML 提取 text/display/meta/brand 角色字符集。
   输出 tools/charset-roles.json（确定性内容：无时间戳，便于 manifest.inputs 做过期校验）。
   前置：npm run build（font:build 会先构建一次以取得 dist）。 */

const ROLE_KEYS = ['text', 'textOnly', 'display', 'meta', 'brand'];

const fail = (message, hint) => {
  console.error(`[font:roles] ${message}`);
  if (hint) console.error(`- ${hint}`);
  process.exit(1);
};

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});

const countObject = (frequency) => {
  const entries = Array.from(frequency.entries()).sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0].codePointAt(0) - b[0].codePointAt(0);
  });
  return Object.fromEntries(entries);
};

const main = async () => {
  const htmlFiles = await listFiles(PATHS.dist, ['.html']);
  if (htmlFiles.length === 0) {
    fail(
      `dist 中没有 HTML（${path.relative(process.cwd(), PATHS.dist)}）。`,
      '角色字符集从构建产物提取：先运行 npm run build（或直接运行 npm run font:build 由它编排）。'
    );
  }

  const merged = createEmptyRoleCharsets();
  let bytes = 0;
  for (const [index, filePath] of htmlFiles.entries()) {
    const html = await readText(filePath);
    bytes += Buffer.byteLength(html);
    const dom = new JSDOM(html, { virtualConsole });
    mergeRoleCharsets(merged, extractRoleCharsets(dom.window.document));
    dom.window.close();
    if ((index + 1) % 50 === 0) {
      console.log(`[font:roles] 已解析 ${index + 1}/${htmlFiles.length} 页`);
    }
  }

  const charsets = Object.fromEntries(ROLE_KEYS.map((key) => [key, setToSortedString(merged[key])]));
  const counts = Object.fromEntries(ROLE_KEYS.map((key) => [key, merged[key].size]));
  const frequency = countObject(merged.frequency);

  const payload = {
    schemaVersion: 1,
    generator: 'scripts/font-roles.mjs',
    pageCount: htmlFiles.length,
    htmlBytes: bytes,
    charsets,
    counts,
    frequency
  };

  await writeText(PATHS.charsetRoles, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`[font:roles] 解析 ${htmlFiles.length} 页 / ${formatBytes(bytes)} -> ${path.relative(process.cwd(), PATHS.charsetRoles)}`);
  for (const key of ROLE_KEYS) {
    console.log(`- ${key}: ${counts[key]} 字符`);
  }
  const top = Object.entries(frequency)
    .filter(([ch]) => {
      const cp = ch.codePointAt(0);
      return cp >= 0x4e00 && cp <= 0x9fff;
    })
    .slice(0, 20)
    .map(([ch]) => ch)
    .join('');
  console.log(`- 站点高频字（top 20）：${top}`);
};

await main();
