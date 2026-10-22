/* 码位与字符集工具：只处理 Unicode 码位，不做任何 IO。 */

/** 把任意文本拆成字符数组（按码位，正确处理代理对）。 */
export const splitChars = (text) => Array.from(text ?? '');

/** 去重并按码位升序返回字符数组。 */
export const uniqueSortedChars = (...texts) => {
  const set = new Set();
  for (const text of texts) {
    for (const ch of splitChars(text)) set.add(ch);
  }
  return Array.from(set).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
};

/** 字符数组/字符串 → 去重升序码位数组。 */
export const toCodePoints = (...inputs) => {
  const set = new Set();
  for (const input of inputs) {
    if (typeof input === 'string') {
      for (const ch of splitChars(input)) set.add(ch.codePointAt(0));
    } else if (input) {
      for (const value of input) {
        set.add(typeof value === 'string' ? value.codePointAt(0) : Number(value));
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b);
};

/** 码位数组 → 字符串。 */
export const fromCodePoints = (codePoints) => String.fromCodePoint(...codePoints);

/**
 * 读取字符集文本文件内容：忽略空行与 `#` 注释行，按码位去重升序返回字符数组。
 * charset-base.txt 一行一字；charset-common.txt 是单行字符串，同样适用。
 */
export const parseCharsetText = (text) => {
  const chars = [];
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    for (const ch of trimmed) {
      if (ch.trim() === '') continue; // 字符集文件里不记录空白字符（latin face 负责）
      chars.push(ch);
    }
  }
  return Array.from(new Set(chars)).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
};

/** 读取频率先验文件：忽略注释/空行，字符按出现顺序（频率降序）返回。 */
export const parseFrequencyText = (text) => {
  const chars = [];
  const seen = new Set();
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    for (const ch of trimmed) {
      if (ch.trim() === '') continue;
      if (seen.has(ch)) continue;
      seen.add(ch);
      chars.push(ch);
    }
  }
  return chars;
};

/** 判断码位是否落在区间集合内（闭区间数组 [start,end]）。 */
export const codePointInRanges = (codePoint, ranges) =>
  ranges.some(([start, end]) => codePoint >= start && codePoint <= end);

export const isCjkCodePoint = (codePoint, cjkRanges) => codePointInRanges(codePoint, cjkRanges);

export const filterCodePointsByRanges = (codePoints, ranges) =>
  codePoints.filter((codePoint) => codePointInRanges(codePoint, ranges));

/** 按码位集合过滤字符数组，保持原有顺序（用于频率排序后的字符列表）。 */
export const filterCharsByCodePoints = (chars, codePointSet) =>
  chars.filter((ch) => codePointSet.has(ch.codePointAt(0)));
