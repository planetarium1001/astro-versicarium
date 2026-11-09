import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  composeDateTimeText,
  formatSiteNowDateTimeText,
  splitDateTimeText
} from '../src/lib/admin-console/datetime-field';
import { parseContentDateInput } from '../src/utils/date-only';

/**
 * 动态（bits）发布时间条的时间契约：解析、格式化与「写入当前时间」都交给
 * `datetime-field.ts` 与站点时区，不再自带正则、也不再按浏览器本地时区写 `+08:00`。
 */

const BITS_PUBLISH_STRIP = 'src/components/admin/editor/bits/BitsPublishStrip.svelte';

describe('bits publish strip date time', () => {
  it('算时区只走 datetime-field 的纯函数', async () => {
    const source = await readFile(BITS_PUBLISH_STRIP, 'utf8');

    expect(source).not.toContain('BITS_DATETIME_RE');
    expect(source).not.toContain("'+08:00'");
    expect(source).not.toContain('getTimezoneOffset');
    expect(source).toContain("from '../../../../lib/admin-console/datetime-field'");
    expect(source).toMatch(/splitDateTimeText\(dateText\)/);
    expect(source).toMatch(/composeDateTimeText\(dateText, timeText \|\| DEFAULT_TIME_TEXT\)/);
    expect(source).toMatch(/formatSiteNowDateTimeText\(\)/);
  });

  it('把 UTC 原文显示成同一刻的站点时区时间', () => {
    expect(splitDateTimeText('2026-11-09T03:44:53Z', { timeZone: 'Asia/Shanghai' })).toEqual({
      date: '2026-11-09',
      time: '11:44',
      hasTime: true
    });
    // 时间条写回的是站点时区字面量（无偏移），不是带 Z 的 UTC 文本。
    expect(composeDateTimeText('2026-11-09', '11:44')).toBe('2026-11-09 11:44');
    expect(formatSiteNowDateTimeText(new Date('2026-11-09T03:44:53Z'), 'Asia/Shanghai'))
      .toBe('2026-11-09 11:44');
    // 写回的格式必须能被内容 schema 解析回同一刻（无时区写法按站点时区解释），否则保存即漂移。
    expect(
      parseContentDateInput('2026-11-09 11:44', { timeZone: 'Asia/Shanghai' })?.date.toISOString()
    ).toBe('2026-11-09T03:44:00.000Z');
  });
});
