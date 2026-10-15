const MORE_REGEX = /<!--\s*more\s*-->/i;

type DerivedMarkdownText = {
  plainText: string;
  excerptText: string;
};

function splitMore(md: string): string {
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

/** 空格回退的下限：回退后至少要保留这么多字符，否则切在词中间。 */
const WORD_BOUNDARY_KEEP_RATIO = 0.7;

const SENTENCE_END_PATTERN = /[。！？；…!?;]/;

/** 句子边界回退的下限：标点太靠前就不回退。 */
const SENTENCE_BOUNDARY_KEEP_RATIO = 0.6;

/**
 * 摘要截断：优先收在句末标点之后，其次回退到最后一个空白，最后按上限切片并补省略号。
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
