import { visit } from 'unist-util-visit';

/**
 * about 页支持的文本指令。其余文本指令视为正文内容，还原成原始文本。
 * `:friend[...]`、`:faq[...]`、`:contact-links[...]`、`:site-info[...]` 由
 * about-directives 处理，必须在还原之前排除。
 */
const supportedTextDirectives = new Set(['contact-links', 'site-info', 'friend', 'faq']);

const nodeText = (node) => {
  if (typeof node.value === 'string') return node.value;
  if (Array.isArray(node.children)) return node.children.map(nodeText).join('');
  return '';
};

/** 优先按原文位置切片，能保留 `[...]` 与属性写法；没有源文件时按节点内容重建。 */
const directiveSource = (node, source) => {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (source && typeof start === 'number' && typeof end === 'number' && start < end) {
    const sliced = source.slice(start, end);
    if (sliced.startsWith(`:${node.name}`)) return sliced;
  }
  const label = node.children?.length ? `[${node.children.map(nodeText).join('')}]` : '';
  return `:${node.name}${label}`;
};

/**
 * remark-directive 会把正文里的时间写法（如 `00:34`）解析成名为 `34` 的文本指令，
 * 渲染成空元素，导致段落被拆开、时间丢失。这里把主题不认识的文本指令还原成原文，
 * 已知指令保持原样交给 about-directives 处理。
 */
export const remarkLiteralTextDirectives = () => (tree, file) => {
  const source = typeof file === 'string' ? file : file?.value;
  const pending = [];

  visit(tree, 'textDirective', (node, index, parent) => {
    if (!parent || typeof index !== 'number') return;
    if (supportedTextDirectives.has(String(node.name))) return;
    pending.push({ parent, index, node });
  });

  for (const { parent, index, node } of pending) {
    parent.children[index] = { type: 'text', value: directiveSource(node, source) };
  }
};
