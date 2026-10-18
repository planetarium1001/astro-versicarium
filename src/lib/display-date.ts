import type { ArticleDateDisplayMode } from './theme-settings';
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

const getTimeZoneName = (timeZone: string, date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short'
  }).formatToParts(date);
  const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  if (timeZone === 'Asia/Shanghai' && /^(?:GMT\+8|UTC\+8|CST)$/i.test(name)) return 'CST';
  return name.replace(/^GMT/i, 'UTC');
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
  timeZone: string
): DisplayDateItem => {
  const hasTime = value.hasTime === true;
  const dateText = value.text || formatISODateInTimeZone(value.date, timeZone);
  return {
    kind,
    label,
    date: value.date,
    text: hasTime
      ? `${formatDateTimeInTimeZone(value.date, timeZone)} ${getTimeZoneName(timeZone, value.date)}`
      : dateText,
    iso: hasTime ? value.date.toISOString() : dateText,
    hasTime,
    timeZone,
    timeZoneLabel: getTimeZoneOffsetLabel(timeZone, value.date)
  };
};

export const resolveArticleDateItems = ({
  mode,
  timeZone,
  date,
  publishedAt,
  updatedAt,
  publishedLabel = '发布于：',
  forceVersionDate = false
}: {
  mode: ArticleDateDisplayMode;
  timeZone: string;
  date: DateValue;
  publishedAt?: DateValue | undefined;
  updatedAt?: DateValue | undefined;
  publishedLabel?: string;
  forceVersionDate?: boolean;
}): DisplayDateItem[] => {
  if (forceVersionDate) {
    return [toDisplayDate('version', '版本日期：', date, timeZone)];
  }

  const published = toDisplayDate('published', publishedLabel, publishedAt ?? date, timeZone);
  const updated = updatedAt
    ? toDisplayDate('updated', '更新于：', updatedAt, timeZone)
    : null;

  if (mode === 'published') return [published];
  if (mode === 'updated') return [updated ?? published];
  return updated ? [published, updated] : [published];
};
