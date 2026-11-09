import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  composeDateTimeText,
  describeInstant,
  formatSiteNowDateTimeText,
  formatSiteTodayDateText,
  formatSiteTodayDateTimeText,
  resolveDateTimeWriteText,
  splitDateTimeText,
  SUPPORTED_DATE_TIME_HINTS
} from '../src/lib/admin-console/datetime-field';

describe('admin datetime field helpers', () => {
  it('splits any supported text into site-local date and time', () => {
    expect(splitDateTimeText('2026-11-09')).toEqual({
      date: '2026-11-09',
      time: '',
      hasTime: false
    });
    expect(splitDateTimeText('2026-11-09 14:30')).toEqual({
      date: '2026-11-09',
      time: '14:30',
      hasTime: true
    });
    // 原文是 UTC 字面量时，控件展示站点时区的等价时刻。
    expect(splitDateTimeText('2026-11-09T03:44:53Z')).toEqual({
      date: '2026-11-09',
      time: '11:44',
      hasTime: true
    });
    expect(splitDateTimeText('2026/11/09 14:30:15')?.time).toBe('14:30');
  });

  it('returns null for empty or unsupported text', () => {
    expect(splitDateTimeText('')).toBeNull();
    expect(splitDateTimeText('   ')).toBeNull();
    expect(splitDateTimeText('2026-11-09T25:00Z')).toBeNull();
    expect(splitDateTimeText('下周一')).toBeNull();
  });

  it('composes date and time into the site timezone literal', () => {
    expect(composeDateTimeText('2026-11-09', '14:30')).toBe('2026-11-09 14:30');
    expect(composeDateTimeText('2026-11-09', '')).toBe('2026-11-09');
    expect(composeDateTimeText('2026-11-09', '14:30:15')).toBe('2026-11-09 14:30');
    expect(composeDateTimeText('', '14:30')).toBe('');
    expect(composeDateTimeText(' 2026-11-09 ', ' 09:05 ')).toBe('2026-11-09 09:05');
  });

  it('describes the equivalent site-local instant of a text', () => {
    expect(describeInstant('2026-11-09T03:44:53Z')).toEqual({
      hasTime: true,
      localDateTimeText: '2026-11-09 11:44:53',
      timeZoneLabel: 'Asia/Shanghai',
      offsetText: '+08:00',
      isUtcLiteral: true
    });
    expect(describeInstant('2026-11-09T06:30Z')?.localDateTimeText).toBe('2026-11-09 14:30');
    expect(describeInstant('2026-11-09 14:30')).toEqual({
      hasTime: true,
      localDateTimeText: '2026-11-09 14:30',
      timeZoneLabel: 'Asia/Shanghai',
      offsetText: '+08:00',
      isUtcLiteral: false
    });
    expect(describeInstant('2026-11-09')).toEqual({
      hasTime: false,
      localDateTimeText: '2026-11-09',
      timeZoneLabel: 'Asia/Shanghai',
      offsetText: '+08:00',
      isUtcLiteral: false
    });
    expect(describeInstant('')).toBeNull();
  });

  it('formats now and today in the site timezone', () => {
    // 2026-11-09T03:30:00Z = 站点时区 11:30；浏览器本地时区不参与。
    const instant = new Date('2026-11-09T03:30:00Z');

    expect(formatSiteNowDateTimeText(instant)).toBe('2026-11-09 11:30');
    expect(formatSiteTodayDateText(instant)).toBe('2026-11-09');
    expect(formatSiteTodayDateTimeText('', instant)).toBe('2026-11-09');
    expect(formatSiteTodayDateTimeText('2026-03-20', instant)).toBe('2026-11-09');
    // 已有时间时只换日期，避免「设为今日」静默丢掉作者写的时刻。
    expect(formatSiteTodayDateTimeText('2026-03-20 22:30', instant)).toBe('2026-11-09 22:30');
  });

  it('keeps the original text when the instant did not change', () => {
    expect(
      resolveDateTimeWriteText({
        nextText: '2026-11-09T03:44:53Z',
        originalText: '2026-11-09T03:44:53Z'
      })
    ).toBe('2026-11-09T03:44:53Z');

    // 同一时刻的等价写法也算没改，避免无意义 diff。
    expect(
      resolveDateTimeWriteText({
        nextText: '2026-11-09 11:44',
        originalText: '2026-11-09T03:44:00Z'
      })
    ).toBe('2026-11-09T03:44:00Z');
  });

  it('normalizes only when the instant really changed', () => {
    expect(
      resolveDateTimeWriteText({
        nextText: '2026-11-10 08:05',
        originalText: '2026-11-09T03:44:53Z'
      })
    ).toBe('2026-11-10 08:05');

    expect(
      resolveDateTimeWriteText({
        nextText: '2026-11-10T08:05+08:00',
        originalText: '2026-11-09T03:44:53Z'
      })
    ).toBe('2026-11-10 08:05');

    expect(
      resolveDateTimeWriteText({ nextText: '2026-11-10', originalText: '2026-11-09 08:05' })
    ).toBe('2026-11-10');
  });

  it('falls back to the original text when the next text is empty', () => {
    expect(resolveDateTimeWriteText({ nextText: '', originalText: '2026-11-09 08:05' })).toBe(
      '2026-11-09 08:05'
    );
    expect(resolveDateTimeWriteText({ nextText: '  ', originalText: '2026-11-09' })).toBe('2026-11-09');
    expect(resolveDateTimeWriteText({ nextText: '', originalText: '' })).toBe('');
  });

  it('keeps unparseable next text untouched so validation can report it', () => {
    expect(resolveDateTimeWriteText({ nextText: '下周一', originalText: '2026-11-09' })).toBe('下周一');
  });

  it('lists human readable hints for the editor', () => {
    const hints = SUPPORTED_DATE_TIME_HINTS.join('');

    expect(hints).toContain('2026-11-09');
    expect(hints).toContain('14:30');
    expect(hints).toContain('+08:00');
    expect(hints).toContain('Z');
  });
});

describe('frontmatter sidebar datetime wiring', () => {
  const SIDEBAR = 'src/components/admin/editor/frontmatter/FrontmatterSidebar.svelte';

  it('picks current date and time from the site timezone instead of the browser timezone', async () => {
    const source = await readFile(path.join(process.cwd(), SIDEBAR), 'utf8');

    // 浏览器本地时区取值会把 `...T...+08:00` 这类机器写法带进正文，必须走站点时区助手。
    expect(source).not.toContain('getTimezoneOffset');
    expect(source).not.toContain('getHours(');
    expect(source).toContain('formatSiteNowDateTimeText');
    expect(source).toContain('formatSiteTodayDateText');
    expect(source).toContain('formatSiteTodayDateTimeText');
  });

  it('renders the dual date/time control for both optional time fields', async () => {
    const source = await readFile(path.join(process.cwd(), SIDEBAR), 'utf8');

    expect(source.match(/<AdminDateTimeField/g)).toHaveLength(2);
    expect(source).toContain('name="publishedAt"');
    expect(source).toContain('name="updatedAt"');
  });
});
