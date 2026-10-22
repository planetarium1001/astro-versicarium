import { CJK_RANGES, FONT_FAMILIES, LATIN_RANGES, PATHS, SAFETY_PRIOR_CHARS, TARGETS } from './config.mjs';
import { readJson, readText, sha256Text } from './io.mjs';

/* manifest.inputs：字体资产与「字符集 / 源清单 / 管线配置」的绑定。
   font:check 重新计算同样的哈希，发现字符集或源清单变了但字体没重建时直接失败。 */

export const PIPELINE_SCHEMA_VERSION = 2;

export const pipelineSignature = () =>
  sha256Text(
    JSON.stringify({
      schemaVersion: PIPELINE_SCHEMA_VERSION,
      families: FONT_FAMILIES,
      targets: TARGETS,
      latinRanges: LATIN_RANGES,
      cjkRanges: CJK_RANGES,
      safetyPriorChars: SAFETY_PRIOR_CHARS
    })
  );

const INPUT_FILES = () => [
  ['charsetCommon', PATHS.charsetCommon],
  ['charsetBase', PATHS.charsetBase],
  ['charsetRoles', PATHS.charsetRoles],
  ['charsetFrequency', PATHS.charsetFrequency]
];

/** 源字体清单的语义摘要：只有 path/sha256/weights/variable 影响字形，URL/版本/镜像校正不应使资产过期。 */
export const fontSourcesDigest = (fontSources) => {
  const fonts = fontSources?.fonts ?? {};
  const entries = Object.keys(fonts)
    .sort()
    .map((fontId) => {
      const entry = fonts[fontId];
      const files = (entry.files ?? []).map((file) => ({
        path: file.path ?? null,
        sha256: file.sha256 ?? null,
        weights: file.weights ?? null,
        variable: Boolean(file.variable || file.axes)
      }));
      return { fontId, license: entry.license ?? null, files };
    });
  return sha256Text(JSON.stringify(entries));
};

export const collectInputHashes = async () => {
  const hashes = {};
  for (const [key, filePath] of INPUT_FILES()) {
    try {
      hashes[key] = sha256Text(await readText(filePath));
    } catch {
      hashes[key] = null;
    }
  }
  try {
    hashes.fontSourcesDigest = fontSourcesDigest(await readJson(PATHS.fontSources));
  } catch {
    hashes.fontSourcesDigest = null;
  }
  hashes.pipelineConfig = pipelineSignature();
  return hashes;
};

/** 比较 manifest.inputs 与当前输入；返回变化项（空数组 = 未过期）。 */
export const diffInputs = (recorded, current) => {
  const changed = [];
  for (const key of new Set([...Object.keys(recorded ?? {}), ...Object.keys(current ?? {})])) {
    if ((recorded?.[key] ?? null) !== (current?.[key] ?? null)) changed.push(key);
  }
  return changed;
};
