import { createHash } from 'node:crypto';
import { FONT_FAMILIES, PATHS, TARGETS } from './config.mjs';
import { formatRanges, toCodePoints } from './unicode-ranges.mjs';

/* 字体清单：由 font:subset 生成，供 CSS 生成、font:check、font:coverage、font:report
   与管理台预算共用。所有字节数/范围都来自实际构建产物，不手写。 */

export const MANIFEST_SCHEMA_VERSION = 2;

const sumBytes = (faces) => faces.reduce((total, face) => total + face.bytes, 0);

const groupBy = (items, keyFn) => {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
};

const sortedChunks = (faces) => [...faces].sort((a, b) => a.id.localeCompare(b.id));

const chunkTotal = (faces) => sumBytes(faces);

const sourceLookup = (plan, result, sourceKey) => {
  const planned = plan.sources.find((entry) => entry.key === sourceKey);
  const scanned = result.sources?.[sourceKey] ?? {};
  return {
    planned,
    scanned
  };
};

/** 计算默认配置（readable=serif 400/600、copy=wenkai 400）下的一页预算估算。 */
export const estimateDefaultBudget = (faces) => {
  const pick = (fontId, weight, role, tier) =>
    sortedChunks(
      faces.filter(
        (face) =>
          face.fontId === fontId &&
          face.weight === weight &&
          face.role === role &&
          face.tier === tier &&
          !face.dlc
      )
    );
  const latinTotal = (fontId, weight) =>
    chunkTotal(faces.filter((face) => face.fontId === fontId && face.weight === weight && face.tier === 'latin'));
  const first = (list) => (list.length ? list[0].bytes : 0);

  const core = pick('noto-serif-sc', 400, 'text', 'core');
  const mid = pick('noto-serif-sc', 400, 'text', 'mid');
  const display = pick('noto-serif-sc', 600, 'display', 'display');
  const meta = pick('lxgw-wenkai-lite', 400, 'meta', 'meta');

  const commonPageBytes =
    first(core) +
    first(mid) +
    latinTotal('noto-serif-sc', 400) +
    first(display) +
    latinTotal('noto-serif-sc', 600) +
    first(meta) +
    latinTotal('lxgw-wenkai-lite', 400);

  const dlcFaces = faces.filter((face) => face.dlc);
  const maxDlcChunkBytes = dlcFaces.reduce((max, face) => Math.max(max, face.bytes), 0);
  const averageDlcChunkBytes =
    dlcFaces.length > 0 ? Math.round(sumBytes(dlcFaces) / dlcFaces.length) : 0;

  return {
    commonPageBytes,
    rarePageExtraBytes: maxDlcChunkBytes,
    maxDlcChunkBytes,
    averageDlcChunkBytes,
    assumptions: [
      '常用页 = serif 400 core+1 个 mid、serif 600 首个 display 分片、wenkai meta 首个分片，以及上述 face 的 latin 分片',
      '生僻字页增量 = 单个 DLC 分片的最大字节（一个生僻字至少命中一个分片）',
      '未计浏览器缓存命中；未计系统字体 brand/mono'
    ]
  };
};

/**
 * 生成 tools/font-manifest.json 内容。
 * @param {{ faces: object[], plan: object, result: object, generatedAt: string, inputs: object }} input
 */
export const buildManifest = ({ faces, plan, result, generatedAt, inputs }) => {
  const baseFaces = faces.filter((face) => !face.dlc);
  const dlcFaces = faces.filter((face) => face.dlc);
  const byFamily = FONT_FAMILIES.map((familySpec) => {
    const firstWeightSource = plan.sources.find(
      (entry) => entry.key === `${familySpec.id}@${familySpec.weights[0].weight}`
    );
    return {
      id: familySpec.id,
      family: familySpec.family,
      license: firstWeightSource?.license ?? null,
      version: firstWeightSource?.version ?? null,
      weights: familySpec.weights.map((weightSpec) => {
        const sourceKey = `${familySpec.id}@${weightSpec.weight}`;
        const { planned, scanned } = sourceLookup(plan, result, sourceKey);
        const dlcEntry = (result.dlc ?? []).find((entry) => entry.key === `${sourceKey}:dlc`);
        const facesForWeight = faces.filter(
          (face) => face.fontId === familySpec.id && face.weight === weightSpec.weight
        );
        return {
          weight: weightSpec.weight,
          charRoles: [...weightSpec.charRoles],
          source: {
            file: planned?.path ?? null,
            sha256: planned?.sha256 ?? null,
            axes: planned?.axes ?? null
          },
          coverage: {
            sourceCmap: scanned.cmapCount ?? 0,
            sourceCjk: scanned.cjkCount ?? 0,
            baseCjk: dlcEntry?.baseCoveredCjkCount ?? 0,
            dlcCjk: dlcEntry?.dlcCoveredCjkCount ?? 0,
            uncoveredCjk: dlcEntry?.uncoveredCount ?? 0,
            sourceCjkRanges: scanned.cjkRanges ?? []
          },
          baseBytes: sumBytes(facesForWeight.filter((face) => !face.dlc)),
          dlcBytes: sumBytes(facesForWeight.filter((face) => face.dlc)),
          baseFaces: facesForWeight.filter((face) => !face.dlc).length,
          dlcFaces: facesForWeight.filter((face) => face.dlc).length
        };
      })
    };
  });

  /** @type {Record<string, { baseBytes: number, dlcBytes: number, baseFaces: number, dlcFaces: number }>} */
  const roleSummary = {};
  for (const face of faces) {
    if (!roleSummary[face.role]) roleSummary[face.role] = { baseBytes: 0, dlcBytes: 0, baseFaces: 0, dlcFaces: 0 };
    const bucket = roleSummary[face.role];
    if (face.dlc) {
      bucket.dlcBytes += face.bytes;
      bucket.dlcFaces += 1;
    } else {
      bucket.baseBytes += face.bytes;
      bucket.baseFaces += 1;
    }
  }

  /** @type {Record<string, { bytes: number, faces: number }>} */
  const tierSummary = {};
  for (const face of faces) {
    if (face.dlc) continue;
    if (!tierSummary[face.tier]) tierSummary[face.tier] = { bytes: 0, faces: 0 };
    tierSummary[face.tier].bytes += face.bytes;
    tierSummary[face.tier].faces += 1;
  }

  /** @type {Record<string, { baseBytes: number, dlcBytes: number }>} */
  const byFont = {};
  for (const face of faces) {
    if (!byFont[face.fontId]) byFont[face.fontId] = { baseBytes: 0, dlcBytes: 0 };
    if (face.dlc) byFont[face.fontId].dlcBytes += face.bytes;
    else byFont[face.fontId].baseBytes += face.bytes;
  }

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt,
    generator: 'scripts/font-subset.mjs',
    targets: TARGETS,
    inputs,
    families: byFamily,
    faces: [...baseFaces, ...dlcFaces],
    summary: {
      baseBytes: sumBytes(baseFaces),
      dlcBytes: sumBytes(dlcFaces),
      totalBytes: sumBytes(faces),
      baseFaces: baseFaces.length,
      dlcFaces: dlcFaces.length,
      byFont,
      byRole: roleSummary,
      byTier: tierSummary,
      estimate: estimateDefaultBudget(faces)
    }
  };
};

/** 读取文件 hash，用于 manifest.inputs 的过期检测。 */
export const hashFileContents = (contents) => {
  const hash = createHash('sha256');
  for (const content of contents) hash.update(content);
  return hash.digest('hex');
};

/** 序列化为稳定的 JSON 文本（faces 按固定顺序、2 空格缩进、结尾换行）。 */
export const serializeManifest = (manifest) => {
  const ordered = {
    ...manifest,
    faces: [...manifest.faces].sort((a, b) => a.id.localeCompare(b.id)),
    families: manifest.families
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
};

/** 码位集合是否被区间列表完全覆盖。 */
export const isFullyCovered = (codePoints, ranges) => {
  const covered = new Set(toCodePoints(ranges));
  return codePoints.every((codePoint) => covered.has(codePoint));
};

/** 汇总一个 face 列表的 unicode-range 覆盖。 */
export const coverageRanges = (faces) => {
  const points = [];
  for (const face of faces) for (const range of face.ranges) points.push(range);
  return points;
};

/** 从 manifest 的 faces 找 family/weight 的全部 base 范围。 */
export const baseRangesForWeight = (manifest, fontId, weight) => {
  const points = [];
  for (const face of manifest.faces) {
    if (face.dlc || face.fontId !== fontId || face.weight !== weight) continue;
    for (const range of face.ranges) points.push(range);
  }
  return points;
};

export { formatRanges, sumBytes };
