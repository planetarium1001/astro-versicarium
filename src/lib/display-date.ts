import type { ArticleDateDisplayMode, ArticleDateGranularity } from './theme-settings';
import { formatDateTimeInTimeZone, formatISODateInTimeZone } from '../utils/format';

export type DisplayDateItem = {
  kind: 'published' | 'updated' | 'version';
  label: string;
  date: Date;
  text: string;
  iso: string;
  hasTime: boolean;
  timeZone: string;
  timeZoneLabel: string;
};

type DateValue = {
  date: Date;
  text?: string | undefined;
  hasTime?: boolean | undefined;
};

/**
 * 站点时区短名：Asia/Shanghai 固定按 CST 展示（Intl 在部分环境返回 GMT+8），
 * 其余时区用 Intl 的 short 名称，GMT 前缀统一写成 UTC。
 */
export const getTimeZoneShortName = (timeZone: string, date: Date): string => {
  if (timeZone === 'Asia/Shanghai') return 'CST';

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short'
    }).formatToParts(date);
    const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    return name.replace(/^GMT/i, 'UTC');
  } catch {
    return 'UTC';
  }
};

export const getTimeZoneOffsetLabel = (timeZone: string, date: Date): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset'
    }).formatToParts(date);
    const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    if (name === 'GMT') return 'UTC';
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name);
    if (!match) return name.replace(/^GMT/i, 'UTC');
    const [, sign, hours, minutes] = match;
    return `UTC${sign}${Number(hours)}${minutes === '00' ? '' : `:${minutes}`}`;
  } catch {
    return 'UTC';
  }
};

const toDisplayDate = (
  kind: DisplayDateItem['kind'],
  label: string,
  value: DateValue,
  timeZone: string,
  granularity: ArticleDateGranularity
): DisplayDateItem => {
  // hasTime 反映「实际是否显示时分」：粒度是 date、或 frontmatter 本身没写时分，都不算。
  const hasTime = granularity === 'datetime' && value.hasTime === true;
  const dateText = value.text || formatISODateInTimeZone(value.date, timeZone);
  return {
    kind,
    label,
    date: value.date,
    // 服务端只输出站点时区的日期/时间，不拼时区名；访客时区的后缀由 article-dates.ts 补。
    text: hasTime ? formatDateTimeInTimeZone(value.date, timeZone) : dateText,
    iso: hasTime ? value.date.toISOString() : dateText,
    hasTime,
    timeZone,
    timeZoneLabel: getTimeZoneOffsetLabel(timeZone, value.date)
  };
};

export const resolveArticleDateItems = ({
  mode,
  timeZone,
  granularity = 'date',
  date,
  publishedAt,
  updatedAt,
  publishedLabel = '发布于：',
  forceVersionDate = false
}: {
  mode: ArticleDateDisplayMode;
  timeZone: string;
  granularity?: ArticleDateGranularity;
  date: DateValue;
  publishedAt?: DateValue | undefined;
  updatedAt?: DateValue | undefined;
  publishedLabel?: string;
  forceVersionDate?: boolean;
}): DisplayDateItem[] => {
  if (forceVersionDate) {
    // 旧版本的「版本日期」始终只到日期，不受粒度设置影响。
    return [toDisplayDate('version', '版本日期：', date, timeZone, 'date')];
  }

  const published = toDisplayDate('published', publishedLabel, publishedAt ?? date, timeZone, granularity);
  const updated = updatedAt
    ? toDisplayDate('updated', '更新于：', updatedAt, timeZone, granularity)
    : null;

  if (mode === 'published') return [published];
  if (mode === 'updated') return [updated ?? published];
  return updated ? [published, updated] : [published];
};
