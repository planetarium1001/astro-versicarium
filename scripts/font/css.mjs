import { formatRanges } from './unicode-ranges.mjs';

/* 生成 @font-face CSS：manifest 是唯一事实来源。
   base CSS 只含 dlc:false 的 face；DLC CSS 只含 dlc:true 的 face（common 模式不引入 DLC CSS）。 */

const ROLE_ORDER = ['latin', 'meta', 'text', 'display', 'dlc'];

const faceSortKey = (face) => {
  const roleIndex = ROLE_ORDER.indexOf(face.role);
  return [face.fontId, face.weight, roleIndex === -1 ? ROLE_ORDER.length : roleIndex, face.id].join('|');
};

export const renderFontFace = (face) => {
  const unicodeRange = face.unicodeRange || formatRanges(face.ranges ?? []);
  const family = String(face.family).replace(/"/g, '\\"');
  return [
    '@font-face {',
    `  font-family: "${family}";`,
    `  src: url("${face.file}") format("woff2");`,
    `  font-weight: ${face.weight};`,
    '  font-style: normal;',
    '  font-display: swap;',
    `  unicode-range: ${unicodeRange};`,
    '}'
  ].join('\n');
};

const renderCssFile = ({ faces, description }) => {
  const sorted = [...faces].sort((a, b) => faceSortKey(a).localeCompare(faceSortKey(b)));
  const baseBytes = sorted.reduce((total, face) => total + face.bytes, 0);
  return [
    '/* 由 npm run font:subset 生成，请勿手改。',
    `   ${description}`,
    `   faces: ${sorted.length}；总字节: ${baseBytes}。 */`,
    '',
    sorted.map(renderFontFace).join('\n\n'),
    ''
  ].join('\n');
};

/** @param {object} manifest */
export const buildFontCss = (manifest) => {
  const baseFaces = manifest.faces.filter((face) => !face.dlc);
  const dlcFaces = manifest.faces.filter((face) => face.dlc);
  if (dlcFaces.length === 0) {
    throw new Error('[font:css] manifest 没有 DLC face：full 模式需要 DLC 分片；检查 font:subset 的 DLC 作业。');
  }
  return {
    baseCss: renderCssFile({
      faces: baseFaces,
      description: '基础分片（所有覆盖模式始终加载；浏览器按 unicode-range 只下载命中的分片）。'
    }),
    dlcCss: renderCssFile({
      faces: dlcFaces,
      description: 'DLC 分片（仅 ui.fontCoverage=full 时引入；生僻字按 unicode-range 按需下载）。'
    })
  };
};

const FONT_FACE_BLOCK = /@font-face\s*\{([^}]*)\}/g;

const readDeclaration = (block, name) => {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block);
  return match ? match[1].trim() : null;
};

/**
 * 解析 CSS 里的 @font-face（font:check 用来断言生成 CSS 与 manifest 一致）。
 * @returns {{ family: string, src: string, weight: number | null, unicodeRange: string }[]}
 */
export const parseCssFontFaces = (cssText) => {
  const faces = [];
  for (const match of String(cssText ?? '').matchAll(FONT_FACE_BLOCK)) {
    const block = match[1];
    const family = readDeclaration(block, 'font-family');
    const src = readDeclaration(block, 'src');
    const weight = readDeclaration(block, 'font-weight');
    const unicodeRange = readDeclaration(block, 'unicode-range');
    const urlMatch = /url\("([^"]+)"\)/.exec(src ?? '');
    faces.push({
      family: family ? family.replace(/^"|"$/g, '') : '',
      src: urlMatch ? urlMatch[1] : '',
      weight: weight ? Number(weight) : null,
      unicodeRange: unicodeRange ?? ''
    });
  }
  return faces;
};
