import { getSiteTimezone } from './site-timezone';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_ONLY_SLASH_RE = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const LOCAL_DATETIME_RE =
  /^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;
const ZONED_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;

export const SUPPORTED_CONTENT_DATE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD HH:mm:ss',
  'YYYY/MM/DD HH:mm',
  'YYYY/MM/DD HH:mm:ss',
  'YYYY-MM-DDTHH:mm:ss+08:00',
  'YYYY-MM-DDTHH:mm:ssZ'
] as const;

export type ParsedContentDate = {
  /** 绝对时间点；纯日期按站点时区的当日零点解释。 */
  date: Date;
  /** 站点时区下的日历日期（YYYY-MM-DD）。 */
  dateText: string;
  /** 输入是否包含时间部分。 */
  hasTime: boolean;
  /** 展示用 ISO：纯日期为 YYYY-MM-DD，日期时间为 UTC ISO。 */
  iso: string;
};

type LegacyBlogDateParseResult = {
  date: Date;
  dateText: string;
  publishedAt?: Date;
  publishedAtText?: string;
};

const pad = (value: number, size = 2): string => String(value).padStart(size, '0');

const toDateOnlyText = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() + 1 === month
    && candidate.getUTCDate() === day;
};

const getZonedParts = (date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second'))
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
};

/** 把站点时区的本地时间转换为绝对时间；处理 DST 边界。 */
export const zonedDateTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone = getSiteTimezone()
): Date => {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let offset = getTimeZoneOffsetMs(new Date(guess), timeZone);
  let timestamp = guess - offset;
  const refinedOffset = getTimeZoneOffsetMs(new Date(timestamp), timeZone);
  if (refinedOffset !== offset) {
    offset = refinedOffset;
    timestamp = guess - offset;
  }
  return new Date(timestamp);
};

const parseDateOnlyParts = (
  year: number,
  month: number,
  day: number
): ParsedContentDate | null => {
  if (!isValidCalendarDate(year, month, day)) return null;
  const dateText = toDateOnlyText(year, month, day);
  return {
    date: zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0),
    dateText,
    hasTime: false,
    iso: dateText
  };
};

const parseZonedDateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  offsetText: string,
  timeZone: string
): ParsedContentDate | null => {
  if (!isValidCalendarDate(year, month, day)) return null;

  const offsetMinutes = offsetText === 'Z'
    ? 0
    : (() => {
        const sign = offsetText.startsWith('-') ? -1 : 1;
        const hours = Number(offsetText.slice(1, 3));
        const minutes = Number(offsetText.slice(4, 6));
        return sign * (hours * 60 + minutes);
      })();
  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - offsetMinutes * 60_000
  );
  if (!Number.isFinite(date.valueOf())) return null;

  const siteParts = getZonedParts(date, timeZone);
  return {
    date,
    dateText: toDateOnlyText(siteParts.year, siteParts.month, siteParts.day),
    hasTime: true,
    iso: date.toISOString()
  };
};

export const parseContentDateInput = (
  value: unknown,
  options: { timeZone?: string } = {}
): ParsedContentDate | null => {
  const timeZone = options.timeZone ?? getSiteTimezone();

  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) return null;
    const parts = getZonedParts(value, timeZone);
    const dateText = toDateOnlyText(parts.year, parts.month, parts.day);
    const isMidnightUtc = value.getUTCHours() === 0
      && value.getUTCMinutes() === 0
      && value.getUTCSeconds() === 0
      && value.getUTCMilliseconds() === 0;
    return {
      date: value,
      dateText,
      hasTime: !isMidnightUtc,
      iso: isMidnightUtc ? dateText : value.toISOString()
    };
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = DATE_ONLY_RE.exec(trimmed) ?? DATE_ONLY_SLASH_RE.exec(trimmed);
  if (dateOnlyMatch) {
    return parseDateOnlyParts(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]),
      Number(dateOnlyMatch[3])
    );
  }

  const zonedMatch = ZONED_DATETIME_RE.exec(trimmed);
  if (zonedMatch) {
    const millisecond = zonedMatch[7]
      ? Number(zonedMatch[7].slice(0, 3).padEnd(3, '0'))
      : 0;
    return parseZonedDateTime(
      Number(zonedMatch[1]),
      Number(zonedMatch[2]),
      Number(zonedMatch[3]),
      Number(zonedMatch[4]),
      Number(zonedMatch[5]),
      Number(zonedMatch[6] ?? 0),
      millisecond,
      zonedMatch[8] ?? 'Z',
      timeZone
    );
  }

  const localMatch = LOCAL_DATETIME_RE.exec(trimmed);
  if (!localMatch) return null;

  const year = Number(localMatch[1]);
  const month = Number(localMatch[2]);
  const day = Number(localMatch[3]);
  const hour = Number(localMatch[4]);
  const minute = Number(localMatch[5]);
  const second = Number(localMatch[6] ?? 0);
  const millisecond = localMatch[7]
    ? Number(localMatch[7].slice(0, 3).padEnd(3, '0'))
    : 0;
  if (
    !isValidCalendarDate(year, month, day)
    || hour > 23
    || minute > 59
    || second > 59
  ) {
    return null;
  }

  const date = zonedDateTimeToUtc(year, month, day, hour, minute, second, millisecond, timeZone);
  const dateText = toDateOnlyText(year, month, day);
  return {
    date,
    dateText,
    hasTime: true,
    iso: date.toISOString()
  };
};

export const formatContentDateError = (field: string): string =>
  `${field} must be one of: ${SUPPORTED_CONTENT_DATE_FORMATS.join(', ')}`;

/** 严格 UTC 日期：只用于确实需要 UTC 日期的工具与兼容层。 */
export const parseDateOnlyUtc = (value: string): Date | null => {
  if (!DATE_ONLY_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date : null;
};

export const parseDateOnlyInput = (value: unknown): Date | null => {
  if (typeof value === 'string') return parseDateOnlyUtc(value);
  if (value instanceof Date && value.toISOString().endsWith('T00:00:00.000Z')) {
    return new Date(value.valueOf());
  }
  return null;
};

/** 后台/兼容层使用的博客日期结果：日期时间同时给出 publishedAt。 */
export const parseBlogDateInput = (value: unknown): LegacyBlogDateParseResult | null => {
  const parsed = parseContentDateInput(value);
  if (!parsed) return null;

  return {
    date: parsed.date,
    dateText: parsed.dateText,
    ...(parsed.hasTime
      ? {
          publishedAt: parsed.date,
          publishedAtText: parsed.iso
        }
      : {})
  };
};

export const parseBlogPublishedAtInput = (value: unknown): Date | null =>
  parseContentDateInput(value)?.date ?? null;
