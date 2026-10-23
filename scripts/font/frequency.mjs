import { parseFrequencyText } from './characters.mjs';

/* 字符频率排序：站点内容频率优先，通用频率先验补位。
   - siteCounts：从 dist 可见文本统计的字符次数（Map<char, number>）
   - prior：Jun Da 现代汉语字频表顺序（tools/charset-frequency.txt）
   排序键：站点次数降序 → 通用频率名次升序 → 码位升序。
   这样「本站实际用到的字」进 core；从未在本站出现的常用字按通用频率先验补齐。 */

export const priorFromText = (text) => {
  const order = parseFrequencyText(text);
  const rank = new Map();
  order.forEach((ch, index) => rank.set(ch, index));
  return rank;
};

/**
 * 统计文本中的字符次数；默认只统计 CJK，避免 ASCII 出现在 core 排序里。
 * @param {string} text
 * @param {{ cjkOnly?: boolean, isCjk?: (codePoint: number) => boolean }} [options]
 */
export const countCharacters = (text, { cjkOnly = true, isCjk } = {}) => {
  const counts = new Map();
  for (const ch of String(text ?? '')) {
    if (cjkOnly && isCjk && !isCjk(ch.codePointAt(0))) continue;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
};

export const mergeCounts = (target, source) => {
  for (const [ch, count] of source) target.set(ch, (target.get(ch) ?? 0) + count);
  return target;
};

/**
 * 按频率排序字符。
 * @param {string[]} chars 待排序字符（输入顺序不参与排序，保证确定性）
 * @param {{ siteCounts?: Map<string, number>, prior?: Map<string, number> }} options
 * @returns {string[]}
 */
export const rankChars = (chars, { siteCounts = new Map(), prior = new Map() } = {}) => {
  const unique = Array.from(new Set(chars));
  const priorFallback = prior.size + 1;
  return unique.sort((a, b) => {
    const countA = siteCounts.get(a) ?? 0;
    const countB = siteCounts.get(b) ?? 0;
    if (countA !== countB) return countB - countA;
    const rankA = prior.get(a) ?? priorFallback;
    const rankB = prior.get(b) ?? priorFallback;
    if (rankA !== rankB) return rankA - rankB;
    return a.codePointAt(0) - b.codePointAt(0);
  });
};

/** 频率先验里的前 N 个字符（display/meta 安全余量）。 */
export const topPriorChars = (prior, count) => {
  if (!(prior instanceof Map) || count <= 0) return [];
  return Array.from(prior.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([ch]) => ch);
};
