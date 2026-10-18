const getVisitorTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getZoneName = (timeZone: string, date: Date): string => {
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

const formatLocalDateTime = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')} ${values.get('hour')}:${values.get('minute')}`;
};

const localizeTimeElements = () => {
  const visitorTimeZone = getVisitorTimeZone();
  const elements = Array.from(document.querySelectorAll<HTMLTimeElement>('time[data-site-timezone]'));

  for (const element of elements) {
    const siteTimeZone = element.dataset.siteTimezone?.trim();
    if (!siteTimeZone || element.dataset.dateKind !== 'datetime') continue;
    if (visitorTimeZone === siteTimeZone) continue;

    const date = new Date(element.getAttribute('datetime') ?? '');
    if (Number.isNaN(date.valueOf())) continue;

    const label = element.dataset.dateLabel ?? '';
    element.textContent = `${label}${formatLocalDateTime(date, visitorTimeZone)} ${getZoneName(visitorTimeZone, date)}`;
    const siteOffset = element.dataset.siteOffset;
    if (siteOffset) {
      element.title = `${siteOffset}（${siteTimeZone}）`;
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', localizeTimeElements, { once: true });
} else {
  localizeTimeElements();
}
