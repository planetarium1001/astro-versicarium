import { describe, expect, it } from 'vitest';
import {
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
