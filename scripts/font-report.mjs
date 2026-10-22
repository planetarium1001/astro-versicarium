import path from 'node:path';

import { PATHS } from './font/config.mjs';
import { readDistPages } from './font/dist-pages.mjs';
import { indexFaces } from './font/face-index.mjs';
import { formatBytes, readJson, readText } from './font/io.mjs';

/* font:report：按页面估算字体下载字节（调试/验收工具，不阻塞构建）。
   默认配置来自 src/data/settings/ui.json 的 typography，缺省回退主题默认值：
   readable=noto-serif-sc、copy=lxgw-wenkai-lite、brand=serif-georgia（系统字体）。
   支持 --readable=<id> / --copy=<id> / --brand=<id> / --limit=<n>。 */

const argValue = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
};

const LIMIT = Number(argValue('limit') ?? 20);
const DETAIL = process.argv.includes('--detail');
const DETAIL_PAGE = argValue('page');
const DEFAULT_TYPOGRAPHY = {
  readable: 'noto-serif-sc',
  copy: 'lxgw-wenkai-lite',
  mono: 'system-mono',
  brand: 'serif-georgia'
};

const fail = (message, hint) => {
  console.error(`[font:report] ${message}`);
  if (hint) console.error(`- ${hint}`);
  process.exit(1);
};

const percentile = (values, ratio) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
};

const readTypography = async (manifest) => {
  const known = new Set(manifest.families.map((family) => family.id));
  let raw = null;
  try {
    raw = JSON.parse(await readText(path.join(process.cwd(), 'src', 'data', 'settings', 'ui.json')));
  } catch {
    raw = null;
  }
  const typography = { ...DEFAULT_TYPOGRAPHY };
  for (const role of ['readable', 'copy', 'mono', 'brand']) {
    const override = argValue(role);
    const value = override ?? raw?.typography?.[role];
    if (typeof value === 'string' && (known.has(value) || value.startsWith('system-'))) {
      typography[role] = value;
    }
  }
  return typography;
};

const hasWeight = (manifest, fontId, weight) =>
  manifest.families.some((family) => family.id === fontId && family.weights.some((entry) => entry.weight === weight));

const main = async () => {
  let manifest;
  try {
    manifest = await readJson(PATHS.fontManifest);
  } catch {
    fail('缺少 tools/font-manifest.json', '先运行 npm run font:build。');
  }
  const { fileCount, pages } = await readDistPages(PATHS.dist, {
    onProgress: (done, total) => console.log(`[font:report] 解析 ${done}/${total} 页`)
  });
  if (fileCount === 0) fail('dist 中没有 HTML', '先 npm run build（或 npm run font:build）。');

  const typography = await readTypography(manifest);
  const familyIds = new Set(manifest.families.map((family) => family.id));

  // face 索引按 family/weight 分组，避免不同字族之间重复匹配。
  const groupIndexes = new Map();
  const groupFaces = new Map();
  for (const family of manifest.families) {
    for (const weight of family.weights) {
      const key = `${family.id}@${weight.weight}`;
      const faces = manifest.faces.filter(
        (face) => face.fontId === family.id && face.weight === weight.weight
      );
      groupFaces.set(key, faces);
      groupIndexes.set(key, indexFaces(faces));
    }
  }

  const faceById = new Map(manifest.faces.map((face) => [face.id, face]));
  const pagesBytes = [];
  for (const page of pages) {
    const hitBase = new Set();
    const hitFull = new Set();
    const addHits = (fontId, weight, chars) => {
      const key = `${fontId}@${weight}`;
      const index = groupIndexes.get(key);
      if (!index) return;
      for (const ch of chars) {
        const bucket = index.codePointToFaces.get(ch.codePointAt(0));
        if (!bucket) continue;
        for (const id of bucket) {
          hitFull.add(id);
          if (!faceById.get(id)?.dlc) hitBase.add(id);
        }
      }
    };

    const readable = familyIds.has(typography.readable) ? typography.readable : null;
    const copy = familyIds.has(typography.copy) ? typography.copy : null;
    const brand = familyIds.has(typography.brand) ? typography.brand : null;

    if (readable) {
      const displayWeight = hasWeight(manifest, readable, 600) ? 600 : 400;
      addHits(readable, 400, page.roles.textOnly);
      if (displayWeight !== 400) addHits(readable, displayWeight, page.roles.display);
      else addHits(readable, 400, page.roles.display);
    }
    if (copy) addHits(copy, 400, page.roles.meta);
    if (brand) addHits(brand, 400, page.roles.brand);

    const bytesFor = (ids) => {
      let total = 0;
      for (const id of ids) total += faceById.get(id)?.bytes ?? 0;
      return total;
    };
    const commonBytes = bytesFor(hitBase);
    const fullBytes = bytesFor(hitFull);
    pagesBytes.push({
      file: page.file,
      commonBytes,
      fullBytes,
      dlcBytes: fullBytes - commonBytes,
      chars: page.counts.text,
      hitBase: [...hitBase],
      hitFull: [...hitFull]
    });
  }

  pagesBytes.sort((a, b) => b.fullBytes - a.fullBytes);
  const commonList = pagesBytes.map((page) => page.commonBytes);
  const fullList = pagesBytes.map((page) => page.fullBytes);
  const dlcPages = pagesBytes.filter((page) => page.dlcBytes > 0);

  console.log(`[font:report] dist 页面: ${fileCount}`);
  console.log(
    `[font:report] typography: readable=${typography.readable} copy=${typography.copy} brand=${typography.brand}`
  );
  console.log(
    `[font:report] common 模式: p50=${formatBytes(percentile(commonList, 0.5))} ` +
      `p90=${formatBytes(percentile(commonList, 0.9))} max=${formatBytes(percentile(commonList, 1))}`
  );
  console.log(
    `[font:report] full 模式:   p50=${formatBytes(percentile(fullList, 0.5))} ` +
      `p90=${formatBytes(percentile(fullList, 0.9))} max=${formatBytes(percentile(fullList, 1))}`
  );
  console.log(
    `[font:report] 生僻字页（full 触发 DLC）: ${dlcPages.length}/${fileCount}` +
      (dlcPages.length > 0
        ? `；单页 DLC 增量 max=${formatBytes(Math.max(...dlcPages.map((page) => page.dlcBytes)))}`
        : '')
  );
  console.log(`[font:report] Top ${LIMIT} 页面（full / common / DLC 增量）:`);
  for (const page of pagesBytes.slice(0, LIMIT)) {
    console.log(
      `  ${formatBytes(page.fullBytes).padStart(9)} / ${formatBytes(page.commonBytes).padStart(9)} / ` +
        `${formatBytes(page.dlcBytes).padStart(8)}  ${page.file}（${page.chars} 字符）`
    );
  }

  if (DETAIL) {
    const target = DETAIL_PAGE
      ? pagesBytes.find((page) => page.file === DETAIL_PAGE || page.file.includes(DETAIL_PAGE))
      : pagesBytes.find((page) => page.file === 'index.html') ?? pagesBytes[0];
    if (!target) return;
    console.log(`[font:report] 明细 ${target.file}（角色分配：readable=${typography.readable} copy=${typography.copy} brand=${typography.brand}）`);
    const rows = [...target.hitFull]
      .map((id) => faceById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id));
    const roleTotals = new Map();
    for (const face of rows) {
      const roleKey = `${face.fontId}@${face.weight} ${face.role}/${face.tier}`;
      roleTotals.set(roleKey, (roleTotals.get(roleKey) ?? 0) + face.bytes);
    }
    for (const face of rows) {
      const mode = face.dlc ? 'DLC ' : 'base';
      console.log(
        `  ${mode} ${formatBytes(face.bytes).padStart(8)}  ${face.fontId}@${face.weight} ${face.role}/${face.tier}  ${face.id}`
      );
    }
    console.log('[font:report] 按 face 分组:');
    for (const [key, bytes] of [...roleTotals.entries()].sort()) {
      console.log(`  ${formatBytes(bytes).padStart(8)}  ${key}`);
    }
    console.log(`[font:report] 合计: full=${formatBytes(target.fullBytes)} common=${formatBytes(target.commonBytes)}`);
  }
};

await main();
