import { describe, expect, it } from 'vitest';
import { getTimeZoneShortName, resolveArticleDateItems } from '../src/lib/display-date';

const firstItem = (items: ReturnType<typeof resolveArticleDateItems>[number][]) => {
  const item = items[0];
  if (!item) throw new Error('expected at least one date item');
  return item;
};

const TIME_ZONE = 'Asia/Shanghai';
// 2026-03-20T06:30:00Z = 上海 14:30
const DATE_WITH_TIME = new Date('2026-03-20T06:30:00.000Z');
const DATE_WITHOUT_TIME = new Date('2026-03-20T00:00:00.000Z');

describe('resolveArticleDateItems 日期粒度', () => {
  it('默认只显示到日期（即使 frontmatter 写了时分）', () => {
    const item = firstItem(resolveArticleDateItems({
      mode: 'updated',
      timeZone: TIME_ZONE,
      date: { date: DATE_WITH_TIME, text: '2026-03-20', hasTime: true }
    }));

    expect(item.text).toBe('2026-03-20');
    expect(item.iso).toBe('2026-03-20');
    expect(item.hasTime).toBe(false);
    expect(item.text).not.toContain('CST');
    expect(item.timeZoneLabel).toBe('UTC+8');
  });

  it('datetime 且字段有真实时分时才显示时分，且服务端不拼时区后缀', () => {
    const item = firstItem(resolveArticleDateItems({
      mode: 'updated',
      granularity: 'datetime',
      timeZone: TIME_ZONE,
      date: { date: DATE_WITH_TIME, text: '2026-03-20', hasTime: true }
    }));

    expect(item.text).toBe('2026-03-20 14:30');
    expect(item.text).not.toContain('CST');
    expect(item.text).not.toContain('UTC');
    expect(item.iso).toBe(DATE_WITH_TIME.toISOString());
    expect(item.hasTime).toBe(true);
  });

  it('datetime 但字段本身没有时分时回退到只显示日期', () => {
    const item = firstItem(resolveArticleDateItems({
      mode: 'updated',
      granularity: 'datetime',
      timeZone: TIME_ZONE,
      date: { date: DATE_WITHOUT_TIME, text: '2026-03-20', hasTime: false }
    }));

    expect(item.text).toBe('2026-03-20');
    expect(item.iso).toBe('2026-03-20');
    expect(item.hasTime).toBe(false);
  });

  it('同时显示发布与更新时按同一粒度渲染', () => {
    const items = resolveArticleDateItems({
      mode: 'both',
      granularity: 'datetime',
      timeZone: TIME_ZONE,
      date: { date: DATE_WITH_TIME, text: '2026-03-20', hasTime: true },
      publishedAt: { date: DATE_WITH_TIME, text: '2026-03-20', hasTime: true },
      updatedAt: { date: DATE_WITH_TIME, text: '2026-03-20', hasTime: true }
    });

    expect(items.map((item) => item.text)).toEqual(['2026-03-20 14:30', '2026-03-20 14:30']);
    expect(items.map((item) => item.kind)).toEqual(['published', 'updated']);
  });

  it('旧版本的版本日期始终只到日期，不受粒度影响', () => {
    const item = firstItem(resolveArticleDateItems({
      mode: 'updated',
      granularity: 'datetime',
      timeZone: TIME_ZONE,
      date: { date: DATE_WITH_TIME, text: '2026-03-20', hasTime: true },
      forceVersionDate: true
    }));

    expect(item.kind).toBe('version');
    expect(item.text).toBe('2026-03-20');
    expect(item.hasTime).toBe(false);
  });

  it('站点时区短名：上海固定 CST，其余用 UTC/GMT 归一化', () => {
    expect(getTimeZoneShortName('Asia/Shanghai', DATE_WITH_TIME)).toBe('CST');
    expect(getTimeZoneShortName('UTC', DATE_WITH_TIME)).toBe('UTC');
    expect(getTimeZoneShortName('Asia/Tokyo', DATE_WITH_TIME)).toBe('UTC+9');
  });
});
