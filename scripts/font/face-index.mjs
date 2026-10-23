import { toCodePoints } from './unicode-ranges.mjs';

/* face 命中索引：码位 → 命中的 face。font:report 用它算「一个页面会下载哪些分片」。 */

export const indexFaces = (faces) => {
  const codePointToFaces = new Map();
  const faceBytes = new Map();
  for (const face of faces) {
    faceBytes.set(face.id, face.bytes);
    for (const codePoint of toCodePoints(face.ranges)) {
      let bucket = codePointToFaces.get(codePoint);
      if (!bucket) {
        bucket = [];
        codePointToFaces.set(codePoint, bucket);
      }
      bucket.push(face.id);
    }
  }
  return { codePointToFaces, faceBytes };
};

/** 给定字符集，返回命中的 face id 集合。 */
export const hitFaces = (index, chars) => {
  const ids = new Set();
  for (const ch of chars) {
    const bucket = index.codePointToFaces.get(ch.codePointAt(0));
    if (!bucket) continue;
    for (const id of bucket) ids.add(id);
  }
  return ids;
};

/** 命中 face 的总字节（同一 face 只计一次）。 */
export const bytesOfFaces = (index, faceIds) => {
  let total = 0;
  for (const id of faceIds) total += index.faceBytes.get(id) ?? 0;
  return total;
};
