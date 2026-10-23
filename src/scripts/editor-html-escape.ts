/**
 * HTML 转义：全仓唯一的实现。
 *
 * 三个上下文分开导出，是因为转义字符集不同——把属性用的版本当成文本用会漏掉引号，
 * 反过来则会把文本里的 `'` 变成实体。此前 `bits-search` / `about-contact-links` /
 * `trailing-links` / 编辑器插入面板各有一份替换链，现已全部改为 import 这里。
 *
 * 只做字符串替换，不依赖 DOM，服务端渲染与浏览器脚本共用。
 */

export const normalizeInlineText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

/** 文本节点：只转义 `& < >`，引号在文本里没有特殊含义。 */
export const escapeHtmlText = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** 属性值：文本转义 + 双引号。用双引号包裹的属性只需这一档。 */
export const escapeHtmlAttribute = (value: string): string =>
  escapeHtmlText(value).replace(/"/g, '&quot;');

/** 文本与属性混用：额外转义单引号，覆盖单引号包裹属性的场景。 */
export const escapeHtmlQuoted = (value: string): string =>
  escapeHtmlAttribute(value).replace(/'/g, '&#39;');
