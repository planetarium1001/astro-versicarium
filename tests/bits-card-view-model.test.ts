import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BITS_CARD_BODY_LINES,
  BITS_CARD_CHARS_PER_LINE,
  BITS_CARD_FULL_RENDER_LIMIT,
  BITS_CARD_VISIBLE_IMAGE_LIMIT,
  buildBitsCardViewModel,
  deriveBitsCardText,
  formatBitsDateLabel
} from '../src/lib/bits-card-view-model';
import { toTagKey } from '../src/lib/tags';
import { truncateTextAtWord } from '../src/utils/excerpt';

describe('bits card view model', () => {
  it('shares the full-render character budget with bits cards', () => {
    expect(BITS_CARD_FULL_RENDER_LIMIT).toBe(BITS_CARD_BODY_LINES * BITS_CARD_CHARS_PER_LINE);

    expect(deriveBitsCardText('短内容 **Markdown**')).toMatchObject({
      shouldRenderFull: true,
      truncated: false
    });
    expect(deriveBitsCardText('a'.repeat(BITS_CARD_FULL_RENDER_LIMIT + 1))).toMatchObject({
      shouldRenderFull: false,
      truncated: true,
      excerpt: `${'a'.repeat(BITS_CARD_FULL_RENDER_LIMIT)}…`
    });
  });

  it('keeps short bodies intact so a few lines render without truncation', () => {
    const body = '今天把卡片正文的截断重做了一遍，判定完整渲染的字数与可见行数的预算对上了。';

    expect(deriveBitsCardText(body)).toMatchObject({
      excerpt: body,
      shouldRenderFull: true,
      truncated: false
    });
  });

  it('truncates on a whitespace boundary instead of splitting a word', () => {
    const head = `${'word '.repeat(40)}tail`;
    const derived = deriveBitsCardText(head);

    expect(derived.truncated).toBe(true);
    // 仍是原正文的前缀，只是在空白处收尾，另接一个省略号
    expect(derived.excerpt.endsWith('…')).toBe(true);
    expect(head.startsWith(derived.excerpt.replace(/…$/, ''))).toBe(true);
    expect(derived.excerpt.replace(/…$/, '').trimEnd()).toBe(derived.excerpt.replace(/…$/, ''));
    expect(derived.excerpt).not.toContain('wor…');
  });

  it('treats a <!--more--> cut as author intent rather than truncation', () => {
    const derived = deriveBitsCardText(`摘要段落\n\n<!--more-->\n\n${'正文'.repeat(300)}`);

    expect(derived).toMatchObject({ shouldRenderFull: false, truncated: false });
    expect(derived.excerpt).toBe('摘要段落');
  });

  it('derives author, tags, date and media for preview cards', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'demo-bit',
      slug: 'demo',
      bodyText: 'Hello',
      tags: ['loc:Shanghai', 'daily'],
      // 固定 UTC 输入与站点时区，避免测试结果随运行环境的本地时区变化。
      date: new Date('2026-05-27T00:30:00.000Z'),
      timeZone: 'Asia/Shanghai',
      images: [
        { src: 'bits/a.webp', width: '800', height: 600, alt: 'A' },
        { src: 'https://example.com/b.webp', width: 'bad', height: '0' },
        { src: 'http://example.com/c.webp', width: 800, height: 600 }
      ],
      author: { name: 'Alice', avatar: 'author/alice.webp' },
      defaultAuthor: { name: 'Whono', avatar: 'author/default.webp' },
      base: '/blog/'
    });

    expect(viewModel.slug).toBe('demo');
    expect(viewModel.authorName).toBe('Alice');
    expect(viewModel.authorAvatar).toBe('/blog/author/alice.webp');
    expect(viewModel.placeTag).toEqual({
      label: 'Shanghai',
      key: toTagKey('loc:Shanghai'),
      href: '/blog/bits/?tags=loc%3Ashanghai'
    });
    expect(viewModel.normalTagItems).toEqual([
      { label: 'daily', key: 'daily', href: '/blog/bits/?tags=daily' }
    ]);
    expect(viewModel.dateLabel).toBe('2026-05-27 08:30');
    expect(viewModel.imageItems).toEqual([
      { src: '/blog/bits/a.webp', width: 800, height: 600, alt: 'A' },
      { src: 'https://example.com/b.webp', alt: '' }
    ]);
  });

  it('只写日期的条目只显示日期，带时分的条目保持日期 + 时分', () => {
    const dateOnly = buildBitsCardViewModel({
      id: 'date-only',
      bodyText: 'Hello',
      // 纯日期按站点时区解释为当日零点，按时间点格式化会带出 00:00。
      date: new Date('2026-10-19T16:00:00.000Z'),
      dateText: '2026-10-20',
      dateHasTime: false,
      timeZone: 'Asia/Shanghai'
    });
    expect(dateOnly.dateLabel).toBe('2026-10-20');
    expect(dateOnly.dateLabel).not.toContain('00:00');

    const withTime = buildBitsCardViewModel({
      id: 'with-time',
      bodyText: 'Hello',
      date: new Date('2026-10-20T00:30:00.000Z'),
      dateText: '2026-10-20T00:30:00+08:00',
      dateHasTime: true,
      timeZone: 'Asia/Shanghai'
    });
    expect(withTime.dateLabel).toBe('2026-10-20 08:30');
  });

  it('未传 dateHasTime 时保持原有时分格式，后台预览调用点不退化', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'admin-preview',
      bodyText: 'Hello',
      date: new Date('2026-10-20T00:30:00.000Z'),
      timeZone: 'Asia/Shanghai'
    });
    expect(viewModel.dateLabel).toBe('2026-10-20 08:30');
  });

  it('纯日期缺少 dateText 时按站点时区取日期部分，非法输入不编造时分', () => {
    const withoutDateText = buildBitsCardViewModel({
      id: 'no-date-text',
      bodyText: 'Hello',
      date: new Date('2026-10-19T16:00:00.000Z'),
      dateHasTime: false,
      timeZone: 'Asia/Shanghai'
    });
    expect(withoutDateText.dateLabel).toBe('2026-10-20');

    const rawDateOnly = buildBitsCardViewModel({
      id: 'raw-date-only',
      bodyText: 'Hello',
      date: '2026-10-20',
      dateHasTime: false
    });
    expect(rawDateOnly.dateLabel).toBe('2026-10-20');

    const invalid = buildBitsCardViewModel({
      id: 'invalid-date',
      bodyText: 'Hello',
      date: 'not-a-date',
      dateHasTime: false
    });
    expect(invalid.dateLabel).toBe('not-a-date');
    expect(formatBitsDateLabel(new Date('invalid'), 'Asia/Shanghai', { dateHasTime: false })).toBe('');
  });

  it('keeps every card tag filterable through /bits/?tags=<key>', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'tagged',
      bodyText: 'Hello',
      tags: ['Content Console', 'loc:New York'],
      base: '/'
    });

    expect(viewModel.normalTagItems).toEqual([
      { label: 'Content Console', key: 'content-console', href: '/bits/?tags=content-console' }
    ]);
    const placeKey = toTagKey('loc:New York');
    expect(viewModel.placeTag).toEqual({
      label: 'New York',
      key: placeKey,
      href: `/bits/?tags=${encodeURIComponent(placeKey)}`
    });
  });

  it('falls back to a plain tag when the key is not routable', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'demo-bit',
      bodyText: 'Hello',
      tags: ['..'],
      base: '/'
    });

    expect(viewModel.hasTags).toBe(true);
    expect(viewModel.normalTagItems).toEqual([{ label: '..', key: '', href: null }]);
  });

  it('folds images beyond the single visible row into moreCount', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'demo-bit',
      bodyText: 'Hello',
      images: Array.from({ length: 6 }, (_, index) => ({ src: `bits/${index}.webp` })),
      base: '/'
    });

    expect(BITS_CARD_VISIBLE_IMAGE_LIMIT).toBe(4);
    expect(viewModel.totalImages).toBe(6);
    expect(viewModel.visibleImages).toHaveLength(BITS_CARD_VISIBLE_IMAGE_LIMIT);
    expect(viewModel.moreCount).toBe(2);
    expect(viewModel.firstImage).toBeNull();
  });

  it('only uses firstImage when there is exactly one image', () => {
    const single = buildBitsCardViewModel({
      id: 'demo-bit',
      bodyText: 'Hello',
      images: [{ src: 'bits/only.webp' }],
      base: '/'
    });
    const pair = buildBitsCardViewModel({
      id: 'demo-bit',
      bodyText: 'Hello',
      images: [{ src: 'bits/a.webp' }, { src: 'bits/b.webp' }],
      base: '/'
    });

    expect(single.firstImage).toMatchObject({ src: '/bits/only.webp' });
    expect(single.moreCount).toBe(0);
    expect(pair.firstImage).toBeNull();
    expect(pair.moreCount).toBe(0);
  });

  it('uses the default author avatar when the editor author avatar is empty', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'demo-bit',
      bodyText: 'Hello',
      author: { name: '', avatar: '' },
      defaultAuthor: { name: 'Whono', avatar: 'author/default.webp' },
      base: '/blog/'
    });

    expect(viewModel.authorName).toBe('Whono');
    expect(viewModel.authorAvatar).toBe('/blog/author/default.webp');
  });
  it('摘要优先收在句末标点之后，否则回退到空白处', () => {
    // 句末标点足够靠后：收成完整句子，不补省略号
    expect(truncateTextAtWord('第一句。第二句。第三句。', 9)).toBe('第一句。第二句。');
    // 没有句末标点：回退到最后一个空白，避免把西文单词截成两半
    expect(truncateTextAtWord('hello world foo', 14)).toBe('hello world…');
    // 没超出预算时原样返回
    expect(truncateTextAtWord('短', 10)).toBe('短');
  });
});

describe('bits 卡片日期行样式', () => {
  it('日期与标签之间用全站 meta 行同款的 `·`，不再输出破折号', async () => {
    const css = await readFile(
      path.join(process.cwd(), 'src/styles/components/bits.css'),
      'utf8'
    );
    const separator = /\.bit-meta \.bit-tags::before\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(separator, '窄屏需要日期与标签之间的分隔点').not.toBe('');
    expect(separator).toContain('content: "·"');
    expect(separator).toContain('color: var(--faint)');
    expect(css).not.toContain('content: " - "');
  });
});
