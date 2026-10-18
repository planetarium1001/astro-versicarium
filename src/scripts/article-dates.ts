import { formatDateTimeInTimeZone } from '../utils/format';
import { getTimeZoneShortName } from '../lib/display-date';

const getVisitorTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/**
 * 只本地化 `data-date-kind="datetime"` 的 <time>。
 *
 * 时间文本始终是站点时区的墙上时间（服务端已经按站点时区渲染）：
 * - 访客时区 == 站点时区：保持 `label + YYYY-MM-DD HH:mm`，不加任何时区后缀；
 * - 否则：站点时间不变，只在后面追加上站点时区短名（Asia/Shanghai → CST）。
 * title 仍保留站点偏移/时区信息，便于悬停查看。
 */
export const localizeArticleDateTimes = ({
  visitorTimeZone = getVisitorTimeZone()
}: { visitorTimeZone?: string } = {}): void => {
  const elements = Array.from(document.querySelectorAll<HTMLTimeElement>('time[data-site-timezone]'));

  for (const element of elements) {
    const siteTimeZone = element.dataset.siteTimezone?.trim();
    if (!siteTimeZone || element.dataset.dateKind !== 'datetime') continue;

    const date = new Date(element.getAttribute('datetime') ?? '');
    if (Number.isNaN(date.valueOf())) continue;

    const label = element.dataset.dateLabel ?? '';
    const siteText = formatDateTimeInTimeZone(date, siteTimeZone);

    if (visitorTimeZone === siteTimeZone) {
      element.textContent = `${label}${siteText}`;
      continue;
    }

    element.textContent = `${label}${siteText} ${getTimeZoneShortName(siteTimeZone, date)}`;
    const siteOffset = element.dataset.siteOffset;
    if (siteOffset) {
      element.title = `${siteOffset}（${siteTimeZone}）`;
    }
  }
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => localizeArticleDateTimes(), { once: true });
  } else {
    localizeArticleDateTimes();
  }
}
