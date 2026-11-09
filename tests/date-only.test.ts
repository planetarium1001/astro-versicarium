import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_CONTENT_DATE_FORMATS,
  formatContentDateError,
  parseDateOnlyInput,
  parseDateOnlyUtc,
  parseBlogDateInput,
  parseBlogPublishedAtInput,
  parseContentDateInput
} from '../src/utils/date-only';

describe('date-only utils', () => {
  it('accepts valid YYYY-MM-DD dates as UTC date-only values', () => {
    expect(parseDateOnlyUtc('2026-01-01')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps strict date-only parsing separate from blog datetime compatibility', () => {
    expect(parseDateOnlyUtc('2026-01-01T23:30:00-08:00')).toBeNull();
    expect(parseDateOnlyInput(new Date('2026-01-01T23:30:00-08:00'))).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateOnlyUtc('2026-02-31')).toBeNull();
    expect(parseContentDateInput('2026-02-31')).toBeNull();
  });

  it('accepts ISO 8601 datetime as blog date input', () => {
    const parsed = parseBlogDateInput('2024-11-23T18:00:00+08:00');

    expect(parsed?.dateText).toBe('2024-11-23');
    expect(parsed?.date.toISOString()).toBe('2024-11-23T10:00:00.000Z');
    expect(parsed?.publishedAtText).toBe('2024-11-23T10:00:00.000Z');
    expect(parsed?.publishedAt?.toISOString()).toBe('2024-11-23T10:00:00.000Z');
  });

  it('interprets a datetime without offset in the site timezone', () => {
    const parsed = parseBlogDateInput('2026-01-01 00:30:00');

    expect(parsed?.dateText).toBe('2026-01-01');
    expect(parsed?.date.toISOString()).toBe('2025-12-31T16:30:00.000Z');
  });

  it('keeps the site calendar date for an explicit-offset datetime', () => {
    const parsed = parseBlogDateInput('2026-01-01T00:30:00+08:00');

    expect(parsed?.dateText).toBe('2026-01-01');
    expect(parsed?.date.toISOString()).toBe('2025-12-31T16:30:00.000Z');
  });

  it('accepts Date values as absolute datetimes', () => {
    const parsed = parseBlogDateInput(new Date('2026-01-01T00:30:00+08:00'));

    expect(parsed?.dateText).toBe('2026-01-01');
    expect(parsed?.date.toISOString()).toBe('2025-12-31T16:30:00.000Z');
    expect(parsed?.publishedAtText).toBe('2025-12-31T16:30:00.000Z');
  });

  it('accepts slash-separated dates and rejects invalid inputs', () => {
    expect(parseContentDateInput('2026/01/02')?.dateText).toBe('2026-01-02');
    expect(parseContentDateInput('2026/01/02 03:04')?.dateText).toBe('2026-01-02');
    expect(parseBlogDateInput('2024-02-31')).toBeNull();
    expect(parseBlogDateInput('2024-02-31T18:00:00+08:00')).toBeNull();
    expect(parseBlogDateInput('11/23/2024')).toBeNull();
    expect(parseBlogPublishedAtInput('2024-11-23')?.toISOString()).toBe('2024-11-22T16:00:00.000Z');
    expect(parseBlogPublishedAtInput('2024-02-31T18:00:00+08:00')).toBeNull();
  });
});

describe('date-only author input formats', () => {
  // PRD R3 列出的五种写法必须解析到同一时刻（无时区按站点时区 Asia/Shanghai）。
  const SAME_INSTANT_INPUTS = [
    '2026-11-09 14:30',
    '2026-11-09T14:30',
    '2026-11-09T14:30:00',
    '2026-11-09T14:30+08:00',
    '2026-11-09T06:30Z'
  ] as const;

  it('parses every supported author format to the same instant', () => {
    for (const input of SAME_INSTANT_INPUTS) {
      const parsed = parseContentDateInput(input);
      expect(parsed, input).not.toBeNull();
      expect(parsed?.date.toISOString(), input).toBe('2026-11-09T06:30:00.000Z');
      expect(parsed?.dateText, input).toBe('2026-11-09');
      expect(parsed?.hasTime, input).toBe(true);
    }
  });

  it('accepts a space separator before an explicit offset', () => {
    const spaced = parseContentDateInput('2026-11-09 14:30:00+08:00');
    expect(spaced?.date.toISOString()).toBe('2026-11-09T06:30:00.000Z');
    expect(spaced?.dateText).toBe('2026-11-09');
    expect(spaced?.timeText).toBe('14:30:00');
  });

  it('accepts hour-minute only with T and slash-separated datetimes', () => {
    expect(parseContentDateInput('2026/11/09T14:30')?.date.toISOString()).toBe('2026-11-09T06:30:00.000Z');
    expect(parseContentDateInput('2026/11/09 14:30:15')?.timeText).toBe('14:30:15');
  });

  it('reports site-local time text and offset for each input', () => {
    const zoned = parseContentDateInput('2026-11-09T06:30Z');
    expect(zoned?.timeText).toBe('14:30:00');
    expect(zoned?.offsetText).toBe('+08:00');

    const local = parseContentDateInput('2026-11-09 14:30');
    expect(local?.timeText).toBe('14:30:00');
    expect(local?.offsetText).toBe('+08:00');

    const dateOnly = parseContentDateInput('2026-11-09');
    expect(dateOnly?.timeText).toBe('00:00:00');
    expect(dateOnly?.hasTime).toBe(false);
  });

  it('rejects out-of-range clock values instead of rolling them over', () => {
    expect(parseContentDateInput('2026-11-09T25:00Z')).toBeNull();
    expect(parseContentDateInput('2026-11-09T24:01')).toBeNull();
    expect(parseContentDateInput('2026-11-09 14:61')).toBeNull();
  });

  // 提示清单是给人看的，容易和解析器分叉：逐条按格式填上样例，确认每一种都真能解析。
  it('every format listed in SUPPORTED_CONTENT_DATE_FORMATS parses', () => {
    const sample: Record<string, string> = { YYYY: '2026', MM: '11', DD: '09', HH: '14', mm: '30', ss: '45' };
    for (const format of SUPPORTED_CONTENT_DATE_FORMATS) {
      const input = format.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => sample[token]!);
      expect(parseContentDateInput(input), format).not.toBeNull();
    }
  });

  it('describes the accepted formats in chinese', () => {
    const message = formatContentDateError('blog.publishedAt');

    expect(message).toContain('blog.publishedAt');
    expect(message).toContain('YYYY-MM-DD');
    expect(message).toContain('YYYY-MM-DD HH:mm');
    expect(message).toContain('YYYY-MM-DDTHH:mmZ');
    expect(message).toContain('Asia/Shanghai');
    expect(message).not.toContain('must be one of');
  });
});
