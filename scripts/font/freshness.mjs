/* dist 角色字符集与 tools/charset-roles.json 快照的一致性检查（纯函数，供 font:coverage 与单测复用）。

   tools/charset-roles.json 是 font:build 里 font:roles 从「构建产物 dist」提取的角色字符集快照；
   字体分片（base/DLC）与 manifest 都以它为输入。内容编辑后 dist 变了但没重跑 font:build 时，
   分片会继续服务旧快照里的字形集合。font:coverage --strict 用本模块把它变成真实门禁。 */

export const ROLE_KEYS = ['text', 'textOnly', 'display', 'meta', 'brand'];

const byCodePoint = (left, right) => left.codePointAt(0) - right.codePointAt(0);

/** 把 string / Set / 数组统一成按码位排序的去重字符数组。 */
export const toSortedChars = (value) => {
  if (!value) return [];
  return [...new Set(value)].sort(byCodePoint);
};

/**
 * 比较记录在 charset-roles.json 里的角色字符集与当前 dist 的角色字符集。
 * @param {Record<string, string|Iterable<string>>} recorded 快照的 charsets
 * @param {Record<string, Iterable<string>>} current mergePageRoleCharsets() 的结果
 * @returns {{ role: string, added: string[], removed: string[] }[]} 仅返回有差异的角色（按 ROLE_KEYS 顺序）
 */
export const diffRoleCharsets = (recorded = {}, current = {}) => {
  const diffs = [];
  for (const role of ROLE_KEYS) {
    const recordedSet = new Set(toSortedChars(recorded?.[role]));
    const currentSet = new Set(toSortedChars(current?.[role]));
    const added = [...currentSet].filter((ch) => !recordedSet.has(ch));
    const removed = [...recordedSet].filter((ch) => !currentSet.has(ch));
    if (added.length > 0 || removed.length > 0) diffs.push({ role, added, removed });
  }
  return diffs;
};

const sampleChars = (chars, limit) =>
  `${chars.slice(0, limit).join('')}${chars.length > limit ? '…' : ''}`;

/** 单角色差异的人类可读摘要（font:coverage 输出用）。 */
export const formatRoleCharsetDiff = (diff, limit = 30) => {
  const parts = [];
  if (diff.added.length > 0) parts.push(`dist 新增 ${diff.added.length} 字: ${sampleChars(diff.added, limit)}`);
  if (diff.removed.length > 0) parts.push(`dist 移除 ${diff.removed.length} 字: ${sampleChars(diff.removed, limit)}`);
  return `${diff.role}（${parts.join('；')}）`;
};
