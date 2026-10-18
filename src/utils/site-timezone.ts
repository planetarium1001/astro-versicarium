import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SITE_TIMEZONE } from '../../site.config.mjs';
import { isValidIanaTimeZone } from './timezone';

/** 站点时区：SITE_TIMEZONE > site.json timezone > 默认值。 */

let cachedProductionTimezone: string | null = null;

const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

export const isValidTimeZone = isValidIanaTimeZone;

const readConfiguredTimezone = (): string | null => {
  const siteJsonPath = join(getProjectRoot(), 'src', 'data', 'settings', 'site.json');
  if (!existsSync(siteJsonPath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(siteJsonPath, 'utf8')) as { timezone?: unknown };
    if (typeof parsed.timezone !== 'string') return null;
    const timezone = parsed.timezone.trim();
    return timezone && isValidTimeZone(timezone) ? timezone : null;
  } catch {
    return null;
  }
};

export const getSiteTimezone = (): string => {
  const configured = process.env.SITE_TIMEZONE?.trim();
  if (configured) {
    if (!isValidTimeZone(configured)) {
      throw new Error(`Invalid SITE_TIMEZONE: ${configured}`);
    }
    return configured;
  }

  if (process.env.NODE_ENV === 'production' && cachedProductionTimezone) {
    return cachedProductionTimezone;
  }

  const timezone = readConfiguredTimezone() ?? DEFAULT_SITE_TIMEZONE;
  if (process.env.NODE_ENV === 'production') {
    cachedProductionTimezone = timezone;
  }
  return timezone;
};

export const resetSiteTimezoneCache = (): void => {
  cachedProductionTimezone = null;
};
