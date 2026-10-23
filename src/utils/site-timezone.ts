import { DEFAULT_SITE_TIMEZONE } from '../../site.config.mjs';
import { isValidIanaTimeZone } from './timezone';
import { getProjectRoot } from '../lib/project-root';

/** 站点时区：SITE_TIMEZONE > site.json timezone > 默认值。 */

type NodeFs = typeof import('node:fs');
type NodePath = typeof import('node:path');

let cachedProductionTimezone: string | null = null;

/**
 * 该模块被编辑器等 Svelte 岛间接引入，不能静态 import node:fs / node:path：
 * Vite 的浏览器外部化会在模块求值时抛错。服务端用 process.getBuiltinModule 同步取用。
 */
const getNodeBuiltin = <T>(id: string): T | null => {
  if (typeof process === 'undefined' || typeof process.getBuiltinModule !== 'function') {
    return null;
  }

  try {
    return (process.getBuiltinModule(id) as T | undefined) ?? null;
  } catch {
    return null;
  }
};

export const isValidTimeZone = isValidIanaTimeZone;

const readConfiguredTimezone = (): string | null => {
  if (typeof window !== 'undefined') return null;

  const fs = getNodeBuiltin<NodeFs>('fs');
  const path = getNodeBuiltin<NodePath>('path');
  if (!fs || !path) return null;

  const siteJsonPath = path.join(getProjectRoot(), 'src', 'data', 'settings', 'site.json');
  if (!fs.existsSync(siteJsonPath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(siteJsonPath, 'utf8')) as { timezone?: unknown };
    if (typeof parsed.timezone !== 'string') return null;
    const timezone = parsed.timezone.trim();
    return timezone && isValidTimeZone(timezone) ? timezone : null;
  } catch {
    return null;
  }
};

/**
 * 浏览器端没有进程环境与文件系统，使用 Astro 配置期注入的站点时区快照。
 * 修改 site.json 的 timezone 后需要重启 dev server 才会同步到编辑器岛。
 */
const getBrowserTimezone = (): string => {
  const injected = String(import.meta.env.ASTRO_WHONO_SITE_TIMEZONE ?? '').trim();
  return injected && isValidTimeZone(injected) ? injected : DEFAULT_SITE_TIMEZONE;
};

export const getSiteTimezone = (): string => {
  if (typeof window !== 'undefined') return getBrowserTimezone();

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
