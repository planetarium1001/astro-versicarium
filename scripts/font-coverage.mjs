import { CJK_RANGES, FONT_FAMILIES, LATIN_RANGES, PATHS } from './font/config.mjs';
import { codePointInRanges } from './font/characters.mjs';
import { readDistPages, mergePageRoleCharsets } from './font/dist-pages.mjs';
import { formatBytes, readJson } from './font/io.mjs';
import { toCodePoints } from './font/unicode-ranges.mjs';

/* font:coverage：构建后、字体资产已生成时运行。
   扫描 dist 页面字符，判断 full / common 两种覆盖模式下的实际覆盖与系统回退：
   - common 模式缺字（需要 DLC 或源字体缺字）的页面统计；
   - full 模式仍缺字：区分「源字体本来没有」与「管线漏覆盖」（--strict 时后者失败）；
   - 设计范围（CJK + 拉丁/符号）之外的字单独列出，不计入管线错误。 */

const STRICT = process.argv.includes('--strict');
const IN_SCOPE_RANGES = [...CJK_RANGES, ...LATIN_RANGES];

const fail = (message, hint) => {
  console.error(`[font:coverage] ${message}`);
  if (hint) console.error(`- ${hint}`);
  process.exit(1);
};

const unionFaceCodePoints = (faces) => {
  const set = new Set();
  for (const face of faces) for (const codePoint of toCodePoints(face.ranges)) set.add(codePoint);
  return set;
};

const relevantCharsForWeight = (weight, merged) => {
  const chars = new Set();
  if (weight.charRoles.includes('text')) for (const ch of merged.text) chars.add(ch);
  if (weight.charRoles.includes('meta')) for (const ch of merged.meta) chars.add(ch);
  if (weight.charRoles.includes('display')) for (const ch of merged.display) chars.add(ch);
  return chars;
};

const countPagesNeedingDlc = (pages, coverageByWeight) => {
  let pageCount = 0;
  for (const page of pages) {
    let needsDlc = false;
    for (const entry of coverageByWeight) {
      for (const ch of page.roles[entry.roleKey]) {
        if (!entry.baseSet.has(ch.codePointAt(0))) {
          needsDlc = true;
          break;
        }
      }
      if (needsDlc) break;
    }
    if (needsDlc) pageCount += 1;
  }
  return pageCount;
};

const main = async () => {
  let manifest;
  try {
    manifest = await readJson(PATHS.fontManifest);
  } catch {
    fail('缺少 tools/font-manifest.json', '先运行 npm run font:subset（或 npm run font:build）。');
  }
  if (!manifest.faces?.length) fail('manifest 没有 faces。');

  const { fileCount, pages } = await readDistPages(PATHS.dist, {
    onProgress: (done, total) => console.log(`[font:coverage] 解析 ${done}/${total} 页`)
  });
  if (fileCount === 0) {
    fail('dist 中没有 HTML', '覆盖率检查在构建之后运行：先 npm run build。');
  }
  const merged = mergePageRoleCharsets(pages);

  const reports = [];
  const pipelineGaps = [];
  for (const family of manifest.families) {
    for (const weight of family.weights) {
      const faces = manifest.faces.filter(
        (face) => face.fontId === family.id && face.weight === weight.weight
      );
      const baseSet = unionFaceCodePoints(faces.filter((face) => !face.dlc));
      const dlcSet = unionFaceCodePoints(faces.filter((face) => face.dlc));
      const fullSet = new Set([...baseSet, ...dlcSet]);
      const sourceCjk = new Set(toCodePoints(weight.coverage?.sourceCjkRanges ?? []));
      const chars = relevantCharsForWeight(weight, merged);

      const missingBase = [];
      const missingFull = [];
      for (const ch of chars) {
        const codePoint = ch.codePointAt(0);
        if (!baseSet.has(codePoint)) missingBase.push(ch);
        if (!fullSet.has(codePoint)) missingFull.push(ch);
      }
      const dlcCovered = missingBase.filter((ch) => fullSet.has(ch.codePointAt(0)));
      // 设计范围内（CJK + 拉丁/符号）且 source cmap 有该字的，必须被 base/DLC 覆盖；否则是管线漏覆盖。
      const inScopeGaps = missingFull.filter((ch) => sourceCjk.has(ch.codePointAt(0)));
      const fallback = missingFull.filter(
        (ch) =>
          !sourceCjk.has(ch.codePointAt(0)) &&
          (codePointInRanges(ch.codePointAt(0), CJK_RANGES) ||
            codePointInRanges(ch.codePointAt(0), LATIN_RANGES))
      );
      const outOfScope = missingFull.filter(
        (ch) => !sourceCjk.has(ch.codePointAt(0)) && !codePointInRanges(ch.codePointAt(0), IN_SCOPE_RANGES)
      );

      reports.push({
        family: family.id,
        weight: weight.weight,
        chars: chars.size,
        missingBase,
        missingFull,
        dlcCovered,
        fallback,
        outOfScope,
        inScopeGaps
      });
      if (inScopeGaps.length > 0) {
        pipelineGaps.push({ family: family.id, weight: weight.weight, chars: inScopeGaps });
      }
    }
  }

  const pagesNeedingDlc = countPagesNeedingDlc(
    pages,
    reports.map((report) => {
      const weightSpec = FONT_FAMILIES.find((family) => family.id === report.family)?.weights.find(
        (weight) => weight.weight === report.weight
      );
      return {
        roleKey: weightSpec?.charRoles.includes('display') ? 'display' : 'text',
        baseSet: unionFaceCodePoints(
          manifest.faces.filter(
            (face) => !face.dlc && face.fontId === report.family && face.weight === report.weight
          )
        )
      };
    })
  );

  console.log(`[font:coverage] dist 页面: ${fileCount}`);
  for (const report of reports) {
    console.log(
      `- ${report.family}@${report.weight}: 字符 ${report.chars}；` +
        `common 需 DLC ${report.dlcCovered.length}；` +
        `full 仍缺 ${report.missingFull.length}` +
        `（源字体缺字 ${report.fallback.length}，设计范围外 ${report.outOfScope.length}，管线漏覆盖 ${report.inScopeGaps.length}）`
    );
  }
  console.log(
    `[font:coverage] common 模式需要额外 DLC 分片的页面: ${pagesNeedingDlc}/${fileCount}` +
      `（其余页面既不请求 DLC，也不需要多列分片）`
  );

  const allOutOfScope = reports.reduce((total, report) => total + report.outOfScope.length, 0);
  if (allOutOfScope > 0) {
    const sample = reports.flatMap((report) => report.outOfScope).slice(0, 40).join('');
    console.log(`[font:coverage] 设计范围外的可用字形（不生成分片，回退系统字体）: ${allOutOfScope} 个，示例: ${sample}`);
  }
  const allFallback = reports.reduce((total, report) => total + report.fallback.length, 0);
  if (allFallback > 0) {
    const sample = reports
      .flatMap((report) => report.fallback)
      .slice(0, 40)
      .join('');
    console.log(`[font:coverage] 源字体缺字（完整模式也回退系统字体）: ${allFallback} 个，示例: ${sample}`);
  }

  if (pipelineGaps.length > 0) {
    for (const gap of pipelineGaps) {
      console.error(
        `[font:coverage] 管线漏覆盖: ${gap.family}@${gap.weight} 有 ${gap.chars.length} 个字在 source cmap 与设计范围内，但没有 base/DLC face 覆盖: ` +
          `${gap.chars.slice(0, 40).join('')}`
      );
    }
    if (STRICT) {
      console.error('[font:coverage] --strict 失败：修复分片范围后重跑 npm run font:subset。');
      process.exit(1);
    }
  }

  if (STRICT && pagesNeedingDlc > fileCount) {
    process.exit(1);
  }
  console.log('[font:coverage] 完成（默认仅报告；加 --strict 将管线漏覆盖视为失败）');
  console.log(`[font:coverage] manifest base+dlc 总量: ${formatBytes(manifest.summary?.totalBytes ?? 0)}`);
};

await main();
