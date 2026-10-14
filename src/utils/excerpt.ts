const MORE_REGEX = /<!--\s*more\s*-->/i;

export type DerivedMarkdownText = {
  plainText: string;
  excerptText: string;
};

export function splitMore(md: string): string {
  if (!md) return '';
  const match = md.match(MORE_REGEX);
  if (!match) return md;
  const index = match.index ?? -1;
  return index >= 0 ? md.slice(0, index) : md;
}

export function cleanMarkdownToText(md: string): string {
  if (!md) return '';
  let text = md;

  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/~~~[\s\S]*?~~~/g, ' ');
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, ' ');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`[^`]*`/g, ' ');

  text = text.replace(/^\s*#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+[\.\)]\s+/gm, '');

  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\r?\n+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function truncateText(text: string, maxChars = 120): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars))}…`;
}

/** 空格回退的下限：回退后至少要保留这么多字符，否则宁可切在词中间。 */
const WORD_BOUNDARY_KEEP_RATIO = 0.7;

/** 句子结束标点：摘要优先收在这些标点之后，读者看到的是完整句子而不是半句话。 */
const SENTENCE_END_PATTERN = /[。！？；…!?;]/;

/** 句子边界回退的下限：标点太靠前就不回退，否则摘要会明显短于预算。 */
const SENTENCE_BOUNDARY_KEEP_RATIO = 0.6;

/**
 * 摘要用的字符截断：不做样式兜底，也不从行中间切。
 *
 * 超出上限时依次尝试：收在最后一句的句末标点之后（不再补省略号）→ 回退到最后一个空白
 * （避免把西文单词截成两半）→ 按上限切片并补省略号。
 */
export function truncateTextAtWord(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  const clipped = text.slice(0, Math.max(0, maxChars));
  for (let index = clipped.length - 1; index >= 0; index -= 1) {
    if (index + 1 < clipped.length * SENTENCE_BOUNDARY_KEEP_RATIO) break;
    if (SENTENCE_END_PATTERN.test(clipped[index] ?? '')) return clipped.slice(0, index + 1);
  }
  const lastSpace = Math.max(clipped.lastIndexOf(' '), clipped.lastIndexOf('\n'));
  if (lastSpace >= 0 && lastSpace + 1 >= clipped.length * WORD_BOUNDARY_KEEP_RATIO) {
    return `${clipped.slice(0, lastSpace).trimEnd()}…`;
  }
  return `${clipped}…`;
}

export function deriveMarkdownText(md: string): DerivedMarkdownText {
  if (!md) {
    return {
      plainText: '',
      excerptText: ''
    };
  }

  const excerptMarkdown = splitMore(md);
  const plainText = cleanMarkdownToText(md);

  return {
    plainText,
    excerptText: excerptMarkdown === md ? plainText : cleanMarkdownToText(excerptMarkdown)
  };
}
