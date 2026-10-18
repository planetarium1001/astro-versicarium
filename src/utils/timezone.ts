const VALID_TIMEZONES = new Set<string>();

export const isValidIanaTimeZone = (value: string): boolean => {
  if (VALID_TIMEZONES.has(value)) return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    VALID_TIMEZONES.add(value);
    return true;
  } catch {
    return false;
  }
};
