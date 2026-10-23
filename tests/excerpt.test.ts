import { describe, expect, it } from 'vitest';
import { cleanMarkdownToText, deriveMarkdownText } from '../src/utils/excerpt';

describe('markdown 纯文本派生', () => {
  it('保留内联代码文本，摘要不留断句空洞', () => {
    expect(cleanMarkdownToText('10-22 00:34 的 `185c2be` 只做一件事：重做字体。')).toBe(
      '10-22 00:34 的 185c2be 只做一件事：重做字体。'
    );
    expect(cleanMarkdownToText('用 `npm run theme:update` 同步，或者 `--check` 只报告。')).toBe(
      '用 npm run theme:update 同步，或者 --check 只报告。'
    );
  });

  it('图片与代码块留空格，链接保留文字', () => {
    expect(cleanMarkdownToText('![封面](/images/a.webp)\n\n这是正文。')).toBe('这是正文。');
    expect(
      cleanMarkdownToText(['```bash', 'npm ci', '```', '', '看 [文档](https://example.com/docs)。'].join('\n'))
    ).toBe('看 文档。');
  });

  it('deriveMarkdownText 同时产出纯文本与摘要', () => {
    const derived = deriveMarkdownText('## 标题\n\n10-20 凌晨 05:13，`7b8437f` 改仓库名。');
    expect(derived.plainText).toBe('标题 10-20 凌晨 05:13，7b8437f 改仓库名。');
    expect(derived.excerptText).toBe('标题 10-20 凌晨 05:13，7b8437f 改仓库名。');
  });

  it('表格整行丢弃，摘要不出现竖线与分隔行', () => {
    const body = [
      '内容根在 `content/`，下面五个集合。',
      '',
      '| 集合 | 装什么 |',
      '| --- | --- |',
      '| `blog` | 技术文章 |',
      '',
      '一条内容是一个目录。'
    ].join('\n');
    const text = cleanMarkdownToText(body);
    expect(text).not.toContain('|');
    expect(text).not.toContain('---');
    expect(text).toBe('内容根在 content/，下面五个集合。 一条内容是一个目录。');
  });

  it('强调标记与容器指令不进入摘要', () => {
    expect(cleanMarkdownToText('**重点**和*斜体*，还有 `代码`。')).toBe('重点和斜体，还有 代码。');
    expect(
      cleanMarkdownToText([':::tip[提示]', '标签可以省略。', ':::', '', '正文从这里开始。'].join('\n'))
    ).toBe('标签可以省略。 正文从这里开始。');
  });
});
