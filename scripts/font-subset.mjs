import path from 'node:path';
import { promises as fs } from 'node:fs';

import { CJK_RANGES, FONT_FAMILIES, PATHS } from './font/config.mjs';
import { codePointInRanges, parseCharsetText, toCodePoints } from './font/characters.mjs';
import { buildFontCss } from './font/css.mjs';
import { priorFromText } from './font/frequency.mjs';
import { collectInputHashes } from './font/inputs.mjs';
import {
  ensureDir,
  formatBytes,
  listFiles,
  readJson,
  readText,
  removeDir,
  sha256Text,
  writeText
} from './font/io.mjs';
import {
  buildManifest,
  serializeManifest,
  baseRangesForWeight,
  isFullyCovered
} from './font/manifest.mjs';
import { buildFacesFromResult, buildFontPlan, groupFacesByWeight } from './font/plan.mjs';
import { runFontOps } from './font/python.mjs';
import { findFaceOverlaps, toRanges } from './font/unicode-ranges.mjs';

/* font:subset：按角色字符集 + 源字体生成 base/DLC WOFF2、CSS 与字体清单。
   前置：tools/font-sources.json（font:fetch）、tools/charset-common.txt（font:charset）、
   tools/charset-roles.json（font:roles，需要 dist）。
   staging：先删 public/fonts/base|dlc 再生成，避免旧哈希文件残留。 */

const args = new Set(process.argv.slice(2));
const PLAN_ONLY = args.has('--plan-only');
// --from-result：复用上一次 plan/result（tools/fonts-src/.cache/build），只重建 CSS/manifest/stamp。
// 用于调整 manifest 结构或 inputs 语义而字体分片未变的情况，避免重复 7 分钟 subset。
const FROM_RESULT = args.has('--from-result');

const fail = (message, hint) => {
  console.error(`[font:subset] ${message}`);
  if (hint) console.error(`- ${hint}`);
  process.exit(1);
};

const readRequiredJson = async (filePath, hint) => {
  try {
    return await readJson(filePath);
  } catch (error) {
    fail(`缺少或无法解析 ${path.relative(process.cwd(), filePath)}`, hint);
  }
};

const readRequiredText = async (filePath, hint) => {
  try {
    return await readText(filePath);
  } catch {
    fail(`缺少 ${path.relative(process.cwd(), filePath)}`, hint);
  }
};

const validateFaces = ({ faces, plan, result, baselineCodePoints }) => {
  const warnings = [];
  const errors = [];

  const weights = groupFacesByWeight(faces);
  for (const [weightKey, weightFaces] of weights) {
    const overlaps = findFaceOverlaps(weightFaces);
    for (const overlap of overlaps) {
      errors.push(
        `${weightKey} 的 face 范围重叠：${overlap.left} ∩ ${overlap.right} = ${overlap.ranges
          .map(([start, end]) => `U+${start.toString(16)}+${end - start + 1}`)
          .join(', ')}`
      );
    }
  }

  // 3500 常用字：每个服务 text 角色的 family/weight 的 base face 并集必须全覆盖。
  for (const familySpec of FONT_FAMILIES) {
    for (const weightSpec of familySpec.weights) {
      if (!weightSpec.charRoles.includes('text')) continue;
      const ranges = baseRangesForWeight({ faces }, familySpec.id, weightSpec.weight);
      const missing = baselineCodePoints.filter((codePoint) => !isFullyCovered([codePoint], ranges));
      if (missing.length > 0) {
        warnings.push(
          `${familySpec.id}@${weightSpec.weight} base 未覆盖 ${missing.length} 个 3500 常用字：` +
            `${missing.slice(0, 40).map((cp) => String.fromCodePoint(cp)).join('')}${missing.length > 40 ? '…' : ''}`
        );
      }
    }
  }

  // DLC 完整性：source cmap CJK 必须被 base ∪ DLC 覆盖。
  for (const entry of result.dlc ?? []) {
    if (entry.uncoveredCount > 0) {
      warnings.push(
        `${entry.key} 有 ${entry.uncoveredCount} 个 source cmap CJK 字符未进入 base/DLC（回退系统字体）`
      );
    }
    if (entry.dlcCoveredCjkCount + entry.baseCoveredCjkCount !== entry.sourceCmapCjkCount) {
      errors.push(
        `${entry.key} 覆盖计数不平：source=${entry.sourceCmapCjkCount} base=${entry.baseCoveredCjkCount} dlc=${entry.dlcCoveredCjkCount}`
      );
    }
  }

  // 每个 family/weight 必须有 base + DLC face。
  for (const familySpec of FONT_FAMILIES) {
    for (const weightSpec of familySpec.weights) {
      const weightFaces = weights.get(`${familySpec.id}@${weightSpec.weight}`) ?? [];
      if (!weightFaces.some((face) => !face.dlc)) {
        errors.push(`${familySpec.id}@${weightSpec.weight} 缺少 base face`);
      }
      if (!weightFaces.some((face) => face.dlc)) {
        errors.push(`${familySpec.id}@${weightSpec.weight} 缺少 DLC face`);
      }
    }
  }

  // 每个请求字符都应落在某个 face（series 未覆盖 + serialized uncovered 计数匹配）。
  for (const entry of result.series ?? []) {
    const covered = entry.partitions.reduce((total, partition) => total + partition.charsCount, 0);
    if (covered + entry.uncoveredCount !== entry.requestedCount) {
      errors.push(
        `${entry.key} 字符数不平：requested=${entry.requestedCount} covered=${covered} uncovered=${entry.uncoveredCount}`
      );
    }
  }

  return { warnings, errors };
};

const describeFaces = (faces) => {
  const base = faces.filter((face) => !face.dlc);
  const dlc = faces.filter((face) => face.dlc);
  const byTier = {};
  for (const face of base) {
    byTier[face.tier] ??= { faces: 0, bytes: 0 };
    byTier[face.tier].faces += 1;
    byTier[face.tier].bytes += face.bytes;
  }
  return {
    base: { faces: base.length, bytes: base.reduce((total, face) => total + face.bytes, 0) },
    dlc: { faces: dlc.length, bytes: dlc.reduce((total, face) => total + face.bytes, 0) },
    byTier
  };
};

const main = async () => {
  const fontSourcesText = await readRequiredText(
    PATHS.fontSources,
    '先运行 npm run font:fetch（或按 Phase 0 research/source-fonts.md 补齐 tools/font-sources.json）。'
  );
  const fontSources = JSON.parse(fontSourcesText);

  const charsetCommonText = await readRequiredText(
    PATHS.charsetCommon,
    '先运行 npm run font:charset。'
  );
  const baselineText = await readRequiredText(PATHS.charsetBase, '缺少 3500 常用字基线文件。');
  const frequencyText = await readRequiredText(
    PATHS.charsetFrequency,
    '缺少 tools/charset-frequency.txt（通用字频先验）。'
  );
  const rolesText = await readRequiredText(
    PATHS.charsetRoles,
    '先运行 npm run build && npm run font:roles（角色字符集从 dist HTML 提取）。'
  );
  const roles = JSON.parse(rolesText);

  const isCjk = (codePoint) => codePointInRanges(codePoint, CJK_RANGES);
  const siteCounts = new Map(
    Object.entries(roles.frequency ?? {}).filter(([ch]) => isCjk(ch.codePointAt(0)))
  );
  const prior = priorFromText(frequencyText);
  const baselineCodePoints = parseCharsetText(baselineText).map((ch) => ch.codePointAt(0));

  const plan = buildFontPlan({
    fontSources,
    charsetCommon: parseCharsetText(charsetCommonText).join(''),
    roleCharsets: {
      text: roles.charsets?.text ?? '',
      display: roles.charsets?.display ?? '',
      meta: roles.charsets?.meta ?? '',
      brand: roles.charsets?.brand ?? ''
    },
    siteCounts,
    prior
  });

  const workDir = path.join(PATHS.fontsSrcCache, 'build');
  await ensureDir(workDir);
  const planPath = path.join(workDir, 'plan.json');
  const resultPath = path.join(workDir, 'result.json');
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');

  const plannedChars = plan.series.reduce((total, series) => total + series.chars.length, 0);
  console.log(
    `[font:subset] plan: sources=${plan.sources.length} series=${plan.series.length} latin=${plan.latin.length} dlc=${plan.dlc.length} chars=${plannedChars}`
  );

  if (PLAN_ONLY) {
    console.log(`[font:subset] plan written: ${path.relative(process.cwd(), planPath)}`);
    return;
  }

  let effectivePlan = plan;
  let result;
  if (FROM_RESULT) {
    try {
      effectivePlan = await readJson(planPath);
      result = await readJson(resultPath);
    } catch {
      fail(
        '--from-result 需要上一次构建的 plan.json / result.json',
        '先完整运行一次 npm run font:subset。'
      );
    }
    console.log('[font:subset] --from-result: 复用已有字体分片，只重建 CSS / manifest / stamp');
  } else {
    await removeDir(PATHS.baseFonts);
    await removeDir(PATHS.dlcFonts);
    await ensureDir(PATHS.baseFonts);
    await ensureDir(PATHS.dlcFonts);
    const { elapsedMs, python } = runFontOps({
      fontOpsPath: PATHS.fontOps,
      planPath,
      resultPath,
      cwd: process.cwd()
    });
    console.log(`[font:subset] font_ops.py 完成：${python}，耗时 ${(elapsedMs / 1000).toFixed(1)}s`);
    result = await readJson(resultPath);
  }

  const faces = buildFacesFromResult(effectivePlan, result);
  const { warnings, errors } = validateFaces({ faces, plan: effectivePlan, result, baselineCodePoints });

  for (const warning of warnings) console.warn(`[font:subset] warning: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[font:subset] error: ${error}`);
    fail('字体分片校验失败，未写入 CSS/manifest。');
  }

  const inputs = await collectInputHashes();
  const manifest = buildManifest({
    faces,
    plan: effectivePlan,
    result,
    generatedAt: new Date().toISOString(),
    inputs
  });

  const { baseCss, dlcCss } = buildFontCss(manifest);
  await writeText(PATHS.baseCss, baseCss);
  await writeText(PATHS.dlcCss, dlcCss);
  await writeText(PATHS.fontManifest, serializeManifest(manifest));
  await writeText(PATHS.charsetCommonStamp, `${sha256Text(charsetCommonText)}\n`);

  const split = describeFaces(faces);
  const estimate = manifest.summary.estimate;
  console.log('[font:subset] 生成完成:');
  console.log(`- base: ${split.base.faces} faces / ${formatBytes(split.base.bytes)}`);
  console.log(`- dlc:  ${split.dlc.faces} faces / ${formatBytes(split.dlc.bytes)}`);
  for (const [tier, stats] of Object.entries(split.byTier)) {
    console.log(`  - ${tier}: ${stats.faces} faces / ${formatBytes(stats.bytes)}`);
  }
  console.log(
    `- 常用页估算: ${formatBytes(estimate.commonPageBytes)}；单个 DLC 分片上界: ${formatBytes(estimate.maxDlcChunkBytes)}`
  );
  console.log(`- CSS: ${path.relative(process.cwd(), PATHS.baseCss)} / ${path.relative(process.cwd(), PATHS.dlcCss)}`);
  console.log(`- manifest: ${path.relative(process.cwd(), PATHS.fontManifest)}`);

  // --clean-legacy 只清理 public/fonts 顶层的历史扁平 woff2 残留，默认保留；当前仓库已无此类文件。
  if (args.has('--clean-legacy')) {
    const legacy = (await listFiles(PATHS.publicFonts, ['.woff2'])).filter((filePath) => {
      const relative = path.relative(PATHS.publicFonts, filePath);
      return !relative.startsWith(`base${path.sep}`) && !relative.startsWith(`dlc${path.sep}`);
    });
    for (const filePath of legacy) await fs.rm(filePath, { force: true });
    console.log(`[font:subset] 已删除 ${legacy.length} 个旧扁平 woff2 文件`);
  }
};

await main();
