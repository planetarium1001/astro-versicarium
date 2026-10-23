import path from 'node:path';
import {
  CJK_RANGES,
  FONT_FAMILIES,
  FONT_URL_PREFIX,
  LATIN_RANGES,
  PATHS,
  SAFETY_PRIOR_CHARS,
  TARGETS
} from './config.mjs';
import { codePointInRanges, uniqueSortedChars } from './characters.mjs';
import { rankChars, topPriorChars } from './frequency.mjs';
import { formatRanges } from './unicode-ranges.mjs';

/* 分片规划（纯函数）：把角色字符集 + 源字体清单转成 fontTools 作业描述。
   具体切分由 font_ops.py 按 targetBytes 实测完成（Node 无法预知每个字形的压缩后字节），
   本模块只负责「哪些字、什么顺序、什么目标、写到哪里」以及结果 → face 元数据。 */

const toRelative = (absolutePath) => path.relative(process.cwd(), absolutePath);

/** 从 font-sources.json 为 family/weight 解析源文件。 */
export const resolveSource = (fontSources, fontId, weight) => {
  const entry = fontSources?.fonts?.[fontId];
  if (!entry) {
    throw new Error(
      `[font] tools/font-sources.json 缺少字体 "${fontId}"。先运行 npm run font:fetch（或参考 Phase 0 research/source-fonts.md 补齐清单）。`
    );
  }
  const files = Array.isArray(entry.files) ? entry.files : [];
  const candidates = files.filter(
    (file) => !Array.isArray(file.weights) || file.weights.includes(weight)
  );
  const file = candidates[0] ?? files[0];
  if (!file?.path) {
    throw new Error(`[font] tools/font-sources.json 中 "${fontId}" 没有可用文件。`);
  }
  const isVariable = Boolean(file.variable || file.axes);
  return {
    key: `${fontId}@${weight}`,
    fontId,
    weight,
    family: entry.family ?? fontId,
    license: entry.license ?? null,
    version: entry.version ?? null,
    relativePath: file.path,
    absolutePath: path.isAbsolute(file.path) ? file.path : path.join(PATHS.fontsSrc, file.path),
    sha256: file.sha256 ?? null,
    axes: isVariable ? { ...(file.axes ?? {}), ...(file.fixedWeight ? {} : { wght: weight }) } : null
  };
};

const pushUniqueSource = (sources, source) => {
  if (!sources.has(source.key)) sources.set(source.key, source);
  return source.key;
};

/**
 * 规划 fontTools 作业。
 * @param {{
 *   fontSources: object,
 *   roleCharsets: { text: string, display: string, meta: string, brand: string },
 *   charsetCommon?: string,
 *   siteCounts?: Map<string, number>,
 *   prior?: Map<string, number>,
 *   families?: typeof FONT_FAMILIES,
 *   targets?: typeof TARGETS
 * }} input
 */
export const buildFontPlan = ({
  fontSources,
  roleCharsets,
  charsetCommon = '',
  siteCounts = new Map(),
  prior = new Map(),
  families = FONT_FAMILIES,
  targets = TARGETS
}) => {
  const sources = new Map();
  const series = [];
  const latin = [];
  const dlc = [];

  // 同一 family/weight 内 latin face 独占 LATIN_RANGES；CJK 角色面必须排除这些码位，否则范围重叠。
  const excludeLatin = (chars) =>
    chars.filter((ch) => !codePointInRanges(ch.codePointAt(0), LATIN_RANGES));
  const allSourceChars = uniqueSortedChars(
    roleCharsets.text ?? '',
    roleCharsets.brand ?? '',
    roleCharsets.display ?? '',
    roleCharsets.meta ?? '',
    charsetCommon
  );
  const latinChars = allSourceChars.filter((ch) => codePointInRanges(ch.codePointAt(0), LATIN_RANGES));
  const baseTextChars = excludeLatin(
    uniqueSortedChars(roleCharsets.text ?? '', roleCharsets.brand ?? '', charsetCommon)
  );
  const displayBase = excludeLatin(
    uniqueSortedChars(roleCharsets.display ?? '', topPriorChars(prior, SAFETY_PRIOR_CHARS.display).join(''))
  );
  const metaBase = excludeLatin(
    uniqueSortedChars(roleCharsets.meta ?? '', topPriorChars(prior, SAFETY_PRIOR_CHARS.meta).join(''))
  );

  for (const familySpec of families) {
    for (const weightSpec of familySpec.weights) {
      const source = resolveSource(fontSources, familySpec.id, weightSpec.weight);
      const sourceKey = pushUniqueSource(sources, source);
      const { weight, charRoles } = weightSpec;
      const outDir = 'public/fonts/base';
      const nameBase = `${familySpec.id}-${weight}`;

      if (charRoles.includes('meta')) {
        const metaChars = rankChars(metaBase, { siteCounts, prior });
        series.push({
          key: `${sourceKey}:meta`,
          fontId: familySpec.id,
          family: familySpec.family,
          weight,
          role: 'meta',
          source: sourceKey,
          chars: metaChars.map((ch) => ch.codePointAt(0)),
          partitions: [{ tier: 'meta', mode: 'split', targetBytes: targets.meta.targetBytes }],
          outDir,
          namePrefix: `${nameBase}-meta`
        });
      }

      if (charRoles.includes('text')) {
        const metaSet = charRoles.includes('meta') ? new Set(metaBase) : new Set();
        const textChars = baseTextChars.filter((ch) => !metaSet.has(ch));
        const ordered = rankChars(textChars, { siteCounts, prior });
        series.push({
          key: `${sourceKey}:text`,
          fontId: familySpec.id,
          family: familySpec.family,
          weight,
          role: 'text',
          source: sourceKey,
          chars: ordered.map((ch) => ch.codePointAt(0)),
          partitions: [
            {
              tier: 'core',
              mode: 'single-fit',
              targetBytes: targets.core.targetBytes,
              minBytes: targets.core.minBytes,
              maxBytes: targets.core.maxBytes
            },
            { tier: 'mid', mode: 'split', targetBytes: targets.mid.targetBytes }
          ],
          outDir,
          namePrefix: `${nameBase}-text`
        });
      }

      if (charRoles.includes('display')) {
        const displayChars = rankChars(displayBase, { siteCounts, prior });
        series.push({
          key: `${sourceKey}:display`,
          fontId: familySpec.id,
          family: familySpec.family,
          weight,
          role: 'display',
          source: sourceKey,
          chars: displayChars.map((ch) => ch.codePointAt(0)),
          partitions: [{ tier: 'display', mode: 'split', targetBytes: targets.display.targetBytes }],
          outDir,
          namePrefix: `${nameBase}-display`
        });
      }

      latin.push({
        key: `${sourceKey}:latin`,
        fontId: familySpec.id,
        family: familySpec.family,
        weight,
        role: 'latin',
        source: sourceKey,
        // 只覆盖实际用到的拉丁/符号字符：unicode-range 精确到用字，避免整段符号表进入首屏。
        chars: latinChars.map((ch) => ch.codePointAt(0)),
        outDir,
        namePrefix: `${nameBase}-latin`
      });

      dlc.push({
        key: `${sourceKey}:dlc`,
        fontId: familySpec.id,
        family: familySpec.family,
        weight,
        source: sourceKey,
        cjkRanges: CJK_RANGES,
        targetBytes: targets.dlc.targetBytes,
        outDir: 'public/fonts/dlc',
        namePrefix: `${nameBase}-dlc`
      });
    }
  }

  return {
    cacheDir: path.relative(process.cwd(), PATHS.fontsSrcCache),
    cjkRanges: CJK_RANGES,
    sources: Array.from(sources.values()).map((source) => ({
      key: source.key,
      fontId: source.fontId,
      weight: source.weight,
      family: source.family,
      license: source.license,
      version: source.version,
      path: toRelative(source.absolutePath),
      absolutePath: source.absolutePath,
      sha256: source.sha256,
      axes: source.axes
    })),
    series,
    latin,
    dlc
  };
};

const faceFromChunk = ({ chunk, meta, dlc }) => {
  const ranges = chunk.ranges ?? [];
  return {
    id: chunk.name.replace(/\.woff2$/, ''),
    fontId: meta.fontId,
    family: meta.family,
    weight: meta.weight,
    role: meta.role,
    tier: meta.tier,
    dlc,
    file: `${FONT_URL_PREFIX}/${dlc ? 'dlc' : 'base'}/${chunk.name}`,
    filePath: chunk.path,
    bytes: chunk.bytes,
    sha256: chunk.sha256,
    hash8: chunk.hash8 ?? String(chunk.sha256).slice(0, 8),
    chars: chunk.cmapCount,
    ranges,
    unicodeRange: ranges.length ? formatRanges(ranges) : '',
    unicodeRangeText: ranges.length ? formatRanges(ranges) : ''
  };
};

/**
 * font_ops.py 输出 → manifest face 列表。
 * @param {ReturnType<typeof buildFontPlan>} plan
 * @param {{ sources: Record<string, object>, series: object[], latin: object[], dlc: object[] }} result
 */
export const buildFacesFromResult = (plan, result) => {
  const faces = [];
  const seriesMeta = new Map(plan.series.map((entry) => [entry.key, entry]));
  for (const entry of result.series ?? []) {
    const meta = seriesMeta.get(entry.key);
    if (!meta) continue;
    for (const partition of entry.partitions ?? []) {
      for (const chunk of partition.chunks ?? []) {
        faces.push(faceFromChunk({ chunk, meta: { ...meta, role: meta.role, tier: partition.tier }, dlc: false }));
      }
    }
  }
  const latinMeta = new Map(plan.latin.map((entry) => [entry.key, entry]));
  for (const entry of result.latin ?? []) {
    const meta = latinMeta.get(entry.key);
    if (!meta) continue;
    for (const chunk of entry.chunks ?? []) {
      faces.push(faceFromChunk({ chunk, meta: { ...meta, tier: 'latin' }, dlc: false }));
    }
  }
  const dlcMeta = new Map(plan.dlc.map((entry) => [entry.key, entry]));
  for (const entry of result.dlc ?? []) {
    const meta = dlcMeta.get(entry.key);
    if (!meta) continue;
    for (const chunk of entry.chunks ?? []) {
      faces.push(faceFromChunk({ chunk, meta: { ...meta, role: 'dlc', tier: 'dlc' }, dlc: true }));
    }
  }
  return faces;
};

/** 按 family/weight 分组（manifest 与互斥校验共用）。 */
export const groupFacesByWeight = (faces) => {
  const groups = new Map();
  for (const face of faces) {
    const key = `${face.fontId}@${face.weight}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(face);
  }
  return groups;
};
