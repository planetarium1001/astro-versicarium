import {
  getSiteDateTimeParts,
  parseContentDateInput,
  type ParsedContentDate
} from '../../utils/date-only';
import { getSiteTimezone } from '../../utils/site-timezone';

/**
 * 后台时间字段的纯函数层：把「任意受支持写法的原文」和「日期 + 时间控件」互相转换。
 *
 * 为什么单独一层：前端控件、写入规划（content-write-plan）与 frontmatter 写回都需要
 * 判断「作者到底改了没改」，三处共用同一套比较与格式化规则，避免各写一遍后漂移。
 */

/** 界面提示用的可读写法示例；详细规则见 date-only.ts 的 SUPPORTED_CONTENT_DATE_FORMATS。 */
export const SUPPORTED_DATE_TIME_HINTS = [
  '2026-11-09（只有日期）',
  '2026-11-09 14:30（站点时区）',
  '2026-11-09T14:30 或 2026-11-09T14:30:00（站点时区）',
  '2026-11-09T14:30+08:00 或 2026-11-09T06:30Z（带时区）'
] as const;

/** 字段级错误文案（后台校验 issue）：与界面提示同源，避免两处写法清单漂移。 */
export const formatDateTimeFieldError = (field: string): string =>
  `${field} 无法识别，请使用：${SUPPORTED_DATE_TIME_HINTS.join('、')}；无时区写法按站点时区 ${getSiteTimezone()} 解释`;

/** 控件内联错误文案（不带字段前缀，错误提示已经贴在字段下方）。 */
export const getDateTimeInputErrorMessage = (): string =>
  `无法识别该时间写法，请使用：${SUPPORTED_DATE_TIME_HINTS.join('、')}`;

export type SplitDateTime = {
  /** 站点时区下的日历日期（YYYY-MM-DD）。 */
  date: string;
  /** 站点时区下的时刻（HH:mm）；无时间时为空串。 */
  time: string;
  hasTime: boolean;
};

export type InstantDescription = {
  hasTime: boolean;
  /** 站点时区下的等价本地时间（HH:mm，带秒时保留秒）。 */
  localDateTimeText: string;
  timeZoneLabel: string;
  offsetText: string;
  /** 原文是否是 UTC 字面量（Z 或 ±00:00）；用于提示「原文其实是 UTC」。 */
  isUtcLiteral: boolean;
};

const UTC_LITERAL_RE = /(?:[Zz]|[+-]00:00)$/;

const parseSiteDate = (
  text: string,
  options: { timeZone?: string } = {}
): ParsedContentDate | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return parseContentDateInput(trimmed, { timeZone: options.timeZone ?? getSiteTimezone() });
};

/** 原文 → 站点时区的日期与时分；无法解析返回 null（校验交给上层）。 */
export const splitDateTimeText = (
  text: string,
  options: { timeZone?: string } = {}
): SplitDateTime | null => {
  const parsed = parseSiteDate(text, options);
  if (!parsed) return null;

  return {
    date: parsed.dateText,
    time: parsed.hasTime ? parsed.timeText.slice(0, 5) : '',
    hasTime: parsed.hasTime
  };
};

/** 日期 + 可选时分 → 站点时区字面量：有时间为 `YYYY-MM-DD HH:mm`，否则只有日期。 */
export const composeDateTimeText = (date: string, time: string): string => {
  const dateText = date.trim();
  if (!dateText) return '';
  const timeText = time.trim().slice(0, 5);
  return timeText ? `${dateText} ${timeText}` : dateText;
};

/** 给界面看的「这一刻实际是什么时候」描述；作者不用自己换算 UTC。 */
export const describeInstant = (
  text: string,
  options: { timeZone?: string } = {}
): InstantDescription | null => {
  const parsed = parseSiteDate(text, options);
  if (!parsed) return null;

  const timeText = parsed.timeText.endsWith(':00')
    ? parsed.timeText.slice(0, 5)
    : parsed.timeText;
  return {
    hasTime: parsed.hasTime,
    localDateTimeText: parsed.hasTime ? `${parsed.dateText} ${timeText}` : parsed.dateText,
    timeZoneLabel: options.timeZone ?? getSiteTimezone(),
    offsetText: parsed.offsetText,
    isUtcLiteral: UTC_LITERAL_RE.test(text.trim())
  };
};

/** 站点时区的「此刻」：`YYYY-MM-DD HH:mm`。 */
export const formatSiteNowDateTimeText = (
  instant: Date = new Date(),
  timeZone = getSiteTimezone()
): string => {
  const parts = getSiteDateTimeParts(instant, timeZone);
  return composeDateTimeText(parts.dateText, parts.timeText);
};

/** 站点时区的「今天」：`YYYY-MM-DD`。 */
export const formatSiteTodayDateText = (
  instant: Date = new Date(),
  timeZone = getSiteTimezone()
): string => getSiteDateTimeParts(instant, timeZone).dateText;

/**
 * 「设为今日」：只把日期换成站点时区的今天。
 * 原文已有时间时保留那个时刻，避免一键操作静默丢掉作者写的精度。
 */
export const formatSiteTodayDateTimeText = (
  currentText = '',
  instant: Date = new Date(),
  timeZone = getSiteTimezone()
): string => {
  const parts = getSiteDateTimeParts(instant, timeZone);
  const currentTime = splitDateTimeText(currentText, { timeZone })?.time ?? '';
  return composeDateTimeText(parts.dateText, currentTime);
};

export type ResolveDateTimeWriteOptions = {
  /** 作者提交上来的文本；空串表示清空该字段。 */
  nextText: string;
  /** 文件里该字段的原文；用来判断时间点是否真的变了。 */
  originalText?: string;
  timeZone?: string;
};

/**
 * 保存时的写回文本：
 * - 作者没动（解析出的时间点与原文一致）→ 原样保留原文，不产生无意义 diff；
 * - 真的改了 → 归一化成站点时区的 `YYYY-MM-DD HH:mm`（无时间则 `YYYY-MM-DD`）；
 * - 提交为空 → 回落到原文（是否真正清空由调用方根据 payload 缺字段与否决定）。
 * 无法解析的文本原样返回，由调用方产出字段级校验错误。
 */
export const resolveDateTimeWriteText = ({
  nextText,
  originalText = '',
  timeZone = getSiteTimezone()
}: ResolveDateTimeWriteOptions): string => {
  const next = nextText.trim();
  const original = originalText.trim();
  if (!next) return original;

  const parsed = parseSiteDate(next, { timeZone });
  if (!parsed) return next;

  const originalParsed = parseSiteDate(original, { timeZone });
  if (originalParsed && originalParsed.date.valueOf() === parsed.date.valueOf()) {
    return original;
  }

  const split = splitDateTimeText(next, { timeZone });
  return composeDateTimeText(parsed.dateText, split?.time ?? '');
};
