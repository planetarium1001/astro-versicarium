/* unicode-range 纯函数：码位 ↔ 连续区间 ↔ CSS 字符串。
   manifest 与生成 CSS 共用同一套实现，保证「声明范围 = 实际子集覆盖」不漂移。 */

/** 码位数组 → 连续闭区间数组，自动去重排序。 */
export const toRanges = (codePoints) => {
  const sorted = Array.from(new Set(codePoints.map(Number))).sort((a, b) => a - b);
  const ranges = [];
  for (const codePoint of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && codePoint === last[1] + 1) {
      last[1] = codePoint;
    } else {
      ranges.push([codePoint, codePoint]);
    }
  }
  return ranges;
};

/** 区间数组 → 去重升序码位数组。 */
export const toCodePoints = (ranges) => {
  const set = new Set();
  for (const [start, end] of ranges) {
    for (let codePoint = start; codePoint <= end; codePoint += 1) set.add(codePoint);
  }
  return Array.from(set).sort((a, b) => a - b);
};

const formatCodePoint = (codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

/** 区间数组 → CSS `unicode-range` 值（区间间用逗号分隔）。 */
export const formatRanges = (ranges) =>
  ranges
    .map(([start, end]) =>
      start === end ? formatCodePoint(start) : `U+${start.toString(16).toUpperCase().padStart(4, '0')}-${end
        .toString(16)
        .toUpperCase()
        .padStart(4, '0')}`
    )
    .join(', ');

/** 码位数组 → CSS `unicode-range` 字符串。 */
export const formatCodePoints = (codePoints) => formatRanges(toRanges(codePoints));

const RANGE_TOKEN = /^U\+([0-9A-Fa-f]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/;

/** 解析 CSS `unicode-range` 字符串（支持逗号/空格分隔与省略写法）→ 区间数组。 */
export const parseUnicodeRange = (text) => {
  const ranges = [];
  for (const token of String(text ?? '').split(/[,\s]+/)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const match = RANGE_TOKEN.exec(trimmed);
    if (!match) throw new Error(`Invalid unicode-range token: ${trimmed}`);
    const start = Number.parseInt(match[1], 16);
    const end = match[2] ? Number.parseInt(match[2], 16) : start;
    if (end < start) throw new Error(`Invalid unicode-range token (end < start): ${trimmed}`);
    ranges.push([start, end]);
  }
  return ranges;
};

/** 判断两个区间数组之间是否存在重叠。返回重叠区间列表（空数组 = 互斥）。 */
export const findRangeOverlaps = (left, right) => {
  const overlaps = [];
  let leftIndex = 0;
  let rightIndex = 0;
  const a = [...left].sort((x, y) => x[0] - y[0]);
  const b = [...right].sort((x, y) => x[0] - y[0]);
  while (leftIndex < a.length && rightIndex < b.length) {
    const start = Math.max(a[leftIndex][0], b[rightIndex][0]);
    const end = Math.min(a[leftIndex][1], b[rightIndex][1]);
    if (start <= end) overlaps.push([start, end]);
    if (a[leftIndex][1] < b[rightIndex][1]) leftIndex += 1;
    else rightIndex += 1;
  }
  return overlaps;
};

/** 区间数组并集（用于合并多个 face 的覆盖）。 */
export const unionRanges = (rangeLists) => toRanges(rangeLists.flatMap((ranges) => toCodePoints(ranges)));

/** 从区间集合中减去另一组区间，返回剩余码位（用于 DLC 规划与覆盖检查）。 */
export const subtractCodePoints = (codePoints, ranges) => {
  const set = new Set(toCodePoints(ranges));
  return codePoints.filter((codePoint) => !set.has(codePoint));
};

/** 区间数组的码位数。 */
export const countCodePoints = (ranges) =>
  ranges.reduce((total, [start, end]) => total + (end - start + 1), 0);

/** 校验同一 family/weight 下各 face 范围互斥；返回 HTML 可读的重叠描述。 */
export const findFaceOverlaps = (faces) => {
  const overlaps = [];
  for (let i = 0; i < faces.length; i += 1) {
    for (let j = i + 1; j < faces.length; j += 1) {
      const shared = findRangeOverlaps(faces[i].ranges, faces[j].ranges);
      if (shared.length) {
        overlaps.push({
          left: faces[i].id,
          right: faces[j].id,
          ranges: shared
        });
      }
    }
  }
  return overlaps;
};
