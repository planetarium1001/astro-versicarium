import { ROLE_PRIORITY, ROLE_SELECTORS, TEXT_EXCLUDE_SELECTORS } from './role-selectors.mjs';

/* dist HTML 角色字符集提取。传入 DOM document（jsdom 在 scripts/font-roles.mjs 构造），
   本模块不 import jsdom，便于用轻量 fixture 做单元测试。
   归属规则：文本节点向上找最近的匹配祖先，优先级 display > meta > brand > text；
   text 集合额外保留页面全部可见文本（含 display/meta），保证基础分片覆盖不因角色拆分漏字。 */

const SHOW_TEXT = 4;
const EXCLUDE_SELECTOR = TEXT_EXCLUDE_SELECTORS.join(',');

const roleSelectorGroups = (selectors) =>
  Object.fromEntries(ROLE_PRIORITY.map((role) => [role, selectors[role].selectors.join(',')]));

const isExcludedTextNode = (node) => {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest(EXCLUDE_SELECTOR));
};

const resolveRole = (element, groups) => {
  let current = element;
  while (current && current.nodeType === 1) {
    for (const role of ROLE_PRIORITY) {
      if (current.matches(groups[role])) return role;
    }
    current = current.parentElement;
  }
  return 'text';
};

export const createEmptyRoleCharsets = () => ({
  text: new Set(),
  textOnly: new Set(),
  display: new Set(),
  meta: new Set(),
  brand: new Set(),
  frequency: new Map()
});

/**
 * @param {Document} document
 * @param {{ selectors?: typeof ROLE_SELECTORS }} [options]
 * @returns {{ text: Set<string>, textOnly: Set<string>, display: Set<string>, meta: Set<string>, brand: Set<string>, frequency: Map<string, number> }}
 */
export const extractRoleCharsets = (document, { selectors = ROLE_SELECTORS } = {}) => {
  const result = createEmptyRoleCharsets();
  const body = document.body;
  if (!body) return result;
  const groups = roleSelectorGroups(selectors);
  const walker = document.createTreeWalker(body, SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!isExcludedTextNode(node)) {
      const value = node.nodeValue ?? '';
      const role = resolveRole(node.parentElement, groups);
      for (const ch of value) {
        if (ch === '\n' || ch === '\r' || ch === '\t') continue;
        result.text.add(ch);
        result.frequency.set(ch, (result.frequency.get(ch) ?? 0) + 1);
        if (role === 'display') result.display.add(ch);
        else if (role === 'meta') result.meta.add(ch);
        else if (role === 'brand') result.brand.add(ch);
        else if (ch.trim()) result.textOnly.add(ch);
      }
    }
    node = walker.nextNode();
  }
  return result;
};

/** 合并多页提取结果；frequency 累加。 */
export const mergeRoleCharsets = (target, source) => {
  for (const key of ['text', 'textOnly', 'display', 'meta', 'brand']) {
    for (const ch of source[key]) target[key].add(ch);
  }
  for (const [ch, count] of source.frequency) {
    target.frequency.set(ch, (target.frequency.get(ch) ?? 0) + count);
  }
  return target;
};

/** Set<string> → 码位升序字符串（写入 charset-roles.json 的稳定格式）。 */
export const setToSortedString = (set) =>
  Array.from(set).sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');

/** Set<string> → 码位升序数组（测试/报告用）。 */
export const setToSortedArray = (set) =>
  Array.from(set).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
