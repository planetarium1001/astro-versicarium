/**
 * `/devlog/` 的「链接行」判定：外链写在正文 markdown 末尾的独立段落，而不是 frontmatter `links`。
 * 这里只做判定，不改写 markdown；页面据此给正文容器加类名，由 CSS 把最后一个段落右对齐成链接行。
 */

/** 一行只由 markdown 链接 + 分隔符组成。 */
const LINK_ONLY_LINE_RE = /^(?:\[[^\]]*\]\((?:[^()\s]|\([^()\s]*\))+\)[\s·|、,，/]*)+$/;

export const hasTrailingLinkLine = (body: string | null | undefined): boolean => {
  const lines = (body ?? '').replace(/\r\n?/g, '\n').split('\n');
  let end = lines.length - 1;
  while (end >= 0 && (lines[end] ?? '').trim() === '') end -= 1;
  if (end < 0) return false;

  const lastLine = (lines[end] ?? '').trim();
  if (!LINK_ONLY_LINE_RE.test(lastLine)) return false;

  // 必须是独立成段的：上一行为空行或不存在，否则它只是某个段落中的一行
  return end === 0 || (lines[end - 1] ?? '').trim() === '';
};
