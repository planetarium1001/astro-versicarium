import path from 'node:path';

import { FONT_FAMILIES, PATHS } from './font/config.mjs';
import { parseCharsetText, toCodePoints as charsToCodePoints } from './font/characters.mjs';
import { buildFontCss, parseCssFontFaces } from './font/css.mjs';
import { collectInputHashes, diffInputs } from './font/inputs.mjs';
import { exists, formatBytes, readJson, readText, sha256File } from './font/io.mjs';
import { MANIFEST_SCHEMA_VERSION, baseRangesForWeight, isFullyCovered } from './font/manifest.mjs';
import { findFaceOverlaps, toCodePoints } from './font/unicode-ranges.mjs';

/* font:check：只读 manifest / 生成 CSS / public/fonts，不依赖源字体与 dist（可放进 CI 的 check 阶段）。
   - 清单 schema、文件存在性、字节数、SHA-256、文件名哈希；
   - 生成 CSS 与 manifest 一一对应（base 不含 DLC，DLC CSS 只含 DLC）；
   - 同一 family/weight 下 base/DLC/latin face 的 unicode-range 精确互斥；
   - 服务 text 角色的 base face 覆盖 3500 常用字；
   - full 模式 DLC 覆盖 source cmap 全部 CJK（manifest 记录的 sourceCjkRanges）；
   - manifest.inputs 与当前字符集/源清单/管线配置一致（过期提示重跑 font:build）。 */

const errors = [];
const warnings = [];

const addError = (message) => errors.push(message);
const addWarning = (message) => warnings.push(message);

const readRequired = async (filePath, label) => {
  try {
    return await readText(filePath);
  } catch {
    addError(`缺少 ${label}: ${path.relative(process.cwd(), filePath)}`);
    return null;
  }
};

const checkFaceFiles = async (faces) => {
  for (const face of faces) {
    const filePath = path.join(process.cwd(), face.filePath);
    if (!exists(filePath)) {
      addError(`face 文件缺失: ${face.filePath}`);
      continue;
    }
    const stats = await import('node:fs').then(({ promises }) => promises.stat(filePath));
    if (stats.size !== face.bytes) {
      addError(`face 字节数不一致: ${face.filePath} manifest=${face.bytes} 实际=${stats.size}`);
    }
    const digest = await sha256File(filePath);
    if (digest !== face.sha256) {
      addError(`face SHA-256 不一致: ${face.filePath}`);
    }
    const basename = path.basename(face.filePath);
    if (!basename.includes(`.${face.hash8}.woff2`)) {
      addError(`face 文件名缺少内容哈希: ${basename}（期望 .${face.hash8}.woff2）`);
    }
    const expectedPrefix = `/fonts/${face.dlc ? 'dlc' : 'base'}/`;
    if (!face.file.startsWith(expectedPrefix)) {
      addError(`face URL 目录错误: ${face.file}（期望 ${expectedPrefix}...）`);
    }
    if (face.file !== `${expectedPrefix}${basename}`) {
      addError(`face URL 与文件不一致: ${face.file} vs ${basename}`);
    }
    if (!face.unicodeRange) {
      addError(`face 缺少 unicode-range: ${face.id}`);
    }
  }
};

const checkCssConsistency = async (manifest) => {
  const expected = buildFontCss(manifest);
  const baseCss = await readRequired(PATHS.baseCss, '生成 CSS (base)');
  const dlcCss = await readRequired(PATHS.dlcCss, '生成 CSS (DLC)');
  if (baseCss === null || dlcCss === null) return;
  if (baseCss !== expected.baseCss) {
    addError(`${path.relative(process.cwd(), PATHS.baseCss)} 与 manifest 不一致：运行 npm run font:subset 重新生成`);
  }
  if (dlcCss !== expected.dlcCss) {
    addError(`${path.relative(process.cwd(), PATHS.dlcCss)} 与 manifest 不一致：运行 npm run font:subset 重新生成`);
  }

  const parsed = {
    base: parseCssFontFaces(baseCss),
    dlc: parseCssFontFaces(dlcCss)
  };
  const faceKey = (family, weight, src, unicodeRange) => `${family}|${weight}|${src}|${unicodeRange}`;
  const compare = (parsedFaces, manifestFaces, label) => {
    const actual = new Set(parsedFaces.map((face) => faceKey(face.family, face.weight, face.src, face.unicodeRange)));
    const expectedKeys = new Set(
      manifestFaces.map((face) => faceKey(face.family, face.weight, face.file, face.unicodeRange))
    );
    for (const key of expectedKeys) {
      if (!actual.has(key)) addError(`${label} 缺少 face: ${key}`);
    }
    for (const key of actual) {
      if (!expectedKeys.has(key)) addError(`${label} 含 manifest 之外的 face: ${key}`);
    }
  };
  compare(parsed.base, manifest.faces.filter((face) => !face.dlc), 'base CSS');
  compare(parsed.dlc, manifest.faces.filter((face) => face.dlc), 'DLC CSS');
};

const checkRangeDisjoint = (faces) => {
  const groups = new Map();
  for (const face of faces) {
    const key = `${face.fontId}@${face.weight}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(face);
  }
  for (const [key, group] of groups) {
    for (const overlap of findFaceOverlaps(group)) {
      addError(
        `${key} unicode-range 重叠: ${overlap.left} ∩ ${overlap.right}（${overlap.ranges.length} 段）`
      );
    }
  }
};

const checkBaselineCoverage = (manifest, baselineChars) => {
  const baselineCodePoints = charsToCodePoints(baselineChars);
  for (const familySpec of FONT_FAMILIES) {
    for (const weightSpec of familySpec.weights) {
      if (!weightSpec.charRoles.includes('text')) continue;
      const ranges = baseRangesForWeight(manifest, familySpec.id, weightSpec.weight);
      const missing = baselineCodePoints.filter((codePoint) => !isFullyCovered([codePoint], ranges));
      if (missing.length > 0) {
        addError(
          `${familySpec.id}@${weightSpec.weight} base 未覆盖 ${missing.length} 个 3500 常用字: ` +
            `${missing.slice(0, 30).map((cp) => String.fromCodePoint(cp)).join('')}${missing.length > 30 ? '…' : ''}`
        );
      }
    }
  }
};

const checkDlcCompleteness = (manifest) => {
  for (const family of manifest.families ?? []) {
    for (const weight of family.weights ?? []) {
      const coverage = weight.coverage ?? {};
      if (coverage.uncoveredCjk !== 0) {
        addError(
          `${family.id}@${weight.weight} 有 ${coverage.uncoveredCjk ?? '?'} 个 source cmap CJK 字符未被 base/DLC 覆盖`
        );
      }
      if ((coverage.baseCjk ?? 0) + (coverage.dlcCjk ?? 0) !== coverage.sourceCjk) {
        addError(
          `${family.id}@${weight.weight} 覆盖计数不平: source=${coverage.sourceCjk} base=${coverage.baseCjk} dlc=${coverage.dlcCjk}`
        );
      }
      const sourceCjk = toCodePoints(coverage.sourceCjkRanges ?? []);
      const coveredRanges = [
        ...baseRangesForWeight(manifest, family.id, weight.weight),
        ...(manifest.faces ?? [])
          .filter((face) => face.dlc && face.fontId === family.id && face.weight === weight.weight)
          .flatMap((face) => face.ranges)
      ];
      const covered = new Set(toCodePoints(coveredRanges));
      const missing = sourceCjk.filter((codePoint) => !covered.has(codePoint));
      if (missing.length > 0) {
        addError(
          `${family.id}@${weight.weight} 有 ${missing.length} 个 source cmap CJK 字符不在任何 face 范围: ` +
            `${missing.slice(0, 20).map((cp) => String.fromCodePoint(cp)).join('')}${missing.length > 20 ? '…' : ''}`
        );
      }
    }
  }
};

const checkInputsFreshness = async (manifest) => {
  const current = await collectInputHashes();
  const changed = diffInputs(manifest.inputs, current);
  if (changed.length > 0) {
    addError(
      `字体资产已过期（变化项: ${changed.join(', ')}）：运行 npm run font:build 重新生成并提交产物`
    );
  }
};

const main = async () => {
  let manifest;
  try {
    manifest = await readJson(PATHS.fontManifest);
  } catch {
    console.error(`[font:check] 缺少 ${path.relative(process.cwd(), PATHS.fontManifest)}`);
    console.error('- fix: 运行 npm run font:build（需要 tools/font-sources.json 与 fontTools 环境）');
    process.exit(1);
  }

  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    addError(`manifest schemaVersion=${manifest.schemaVersion}，期望 ${MANIFEST_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(manifest.faces) || manifest.faces.length === 0) {
    addError('manifest 没有 faces');
  }

  const faces = manifest.faces ?? [];
  await checkFaceFiles(faces);
  await checkCssConsistency(manifest);
  checkRangeDisjoint(faces);
  const baselineText = await readRequired(PATHS.charsetBase, '3500 常用字基线');
  if (baselineText !== null) checkBaselineCoverage(manifest, parseCharsetText(baselineText));
  checkDlcCompleteness(manifest);
  await checkInputsFreshness(manifest);

  const baseFaces = faces.filter((face) => !face.dlc);
  const dlcFaces = faces.filter((face) => face.dlc);
  const totalBase = baseFaces.reduce((total, face) => total + face.bytes, 0);
  const totalDlc = dlcFaces.reduce((total, face) => total + face.bytes, 0);

  for (const warning of warnings) console.warn(`[font:check] warning: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[font:check] error: ${error}`);
    console.error(`[font:check] ${errors.length} 项失败`);
    process.exit(1);
  }

  console.log(
    `[font:check] OK: base ${baseFaces.length} faces / ${formatBytes(totalBase)}；` +
      `DLC ${dlcFaces.length} faces / ${formatBytes(totalDlc)}；` +
      `常用页估算 ${formatBytes(manifest.summary?.estimate?.commonPageBytes ?? 0)}`
  );
};

await main();
