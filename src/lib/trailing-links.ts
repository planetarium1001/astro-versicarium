/**
 * 「正文末尾链接组」的共享机制：正文与链接之间至少一个空行，链接组是末尾连续若干行、
 * 每行只由 markdown 链接（可含 `·|、,，/` 与空白分隔）构成。projects 与 devlog 共用，
 * 后台预览也据此输出同一套标记；blog 不使用。
 */

export type TrailingLink = {
  label: string;
  href: string;
};

/** 一行只由 markdown 链接 + 分隔符组成。 */
const LINK_ONLY_LINE_RE = /^(?:\[[^\]]*\]\((?:[^()\s]|\([^()\s]*\))+\)[\s·|、,，/]*)+$/;

/** 从已判定为纯链接行的行里按出现顺序取出每个链接。 */
const LINK_TOKEN_RE = /\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

/**
 * 链接行是手工拼的标记，不经过 rehype-sanitize，因此这里按同一份协议白名单挡一次，
 * 丢弃带其它协议（如 javascript:）的链接。
 */
const ALLOWED_HREF_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

const hasDisallowedScheme = (href: string): boolean => {
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(href.trim())?.[1];
  return scheme !== undefined && !ALLOWED_HREF_SCHEMES.has(scheme.toLowerCase());
};

/** 统一按 LF 拆行，避免 CRLF 影响末尾行判定。 */
const toLines = (body: string): string[] => body.replace(/\r\n?/g, '\n').split('\n');

/** 末尾链接组的行区间（闭区间）；不满足「连续纯链接行 + 前置空行」时返回 null。 */
const findTrailingLinkRange = (lines: readonly string[]): { start: number; end: number } | null => {
  let end = lines.length - 1;
  while (end >= 0 && (lines[end] ?? '').trim() === '') end -= 1;
  if (end < 0) return null;

  let start = end;
  while (start >= 0) {
    const line = (lines[start] ?? '').trim();
    if (!line || !LINK_ONLY_LINE_RE.test(line)) break;
    start -= 1;
  }
  start += 1;
  if (start > end) return null;

  // 必须独立成段：链接组前一行是空行，或正文本身只有链接组。
  if (start > 0 && (lines[start - 1] ?? '').trim() !== '') return null;

  return { start, end };
};

const parseLineLinks = (line: string): TrailingLink[] => {
  const links: TrailingLink[] = [];
  for (const match of line.matchAll(LINK_TOKEN_RE)) {
    const href = match[2] ?? '';
    if (hasDisallowedScheme(href)) continue;
    links.push({ label: match[1] ?? '', href });
  }
  return links;
};

/** 按书写顺序返回末尾链接组；不满足条件返回 `[]`。支持一行多个链接。 */
export const parseTrailingLinks = (body: string | null | undefined): TrailingLink[] => {
  const lines = toLines(body ?? '');
  const range = findTrailingLinkRange(lines);
  if (!range) return [];

  const links: TrailingLink[] = [];
  for (let index = range.start; index <= range.end; index += 1) {
    links.push(...parseLineLinks(lines[index] ?? ''));
  }
  return links;
};

/** 去掉末尾链接组及其前置空行，供派生摘要与渲染正文使用，避免链接出现两次。 */
export const stripTrailingLinks = (body: string | null | undefined): string => {
  const source = body ?? '';
  const lines = toLines(source);
  const range = findTrailingLinkRange(lines);
  if (!range) return source;

  let cutEnd = range.start;
  while (cutEnd > 0 && (lines[cutEnd - 1] ?? '').trim() === '') cutEnd -= 1;
  return lines.slice(0, cutEnd).join('\n');
};

/** 链接行的统一 class：项目卡片/弹窗、更新展开面板与后台预览复用同一份样式。 */
const TRAILING_LINKS_CLASS = 'trailing-links';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 链接行标记：右对齐、按书写顺序排列，链接之间只留等距间隔，不输出 `·` 等分隔符。 */
export const renderTrailingLinksHtml = (links: readonly TrailingLink[]): string => {
  if (links.length === 0) return '';
  const items = links
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join('');
  return `<p class="${TRAILING_LINKS_CLASS}">${items}</p>`;
};
