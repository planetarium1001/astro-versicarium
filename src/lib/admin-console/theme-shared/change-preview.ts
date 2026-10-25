import type { ThemeSettingsFileGroup } from '../../theme-settings';
import { isRecord } from '../../is-record';
import { createValidationIssue, type AdminThemeSettingsValidationIssue } from './validate';

export type AdminThemeSettingsMismatchMode = 'exact' | 'subset';
export type AdminThemeSettingsChangeKind = 'added' | 'removed' | 'updated';

export type AdminThemeSettingsChangePreview = {
  path: string;
  kind: AdminThemeSettingsChangeKind;
  before: string;
  after: string;
};

export const appendPathSegment = (basePath: string, segment: string): string => {
  if (!basePath) return segment;
  if (segment.startsWith('[')) return `${basePath}${segment}`;
  return `${basePath}.${segment}`;
};

export const MISSING_CHANGE_VALUE = Symbol('adminThemeSettingsMissingValue');

export const createChangePath = (basePath: string): string => basePath || 'root';

export const formatChangePreviewValue = (
  value: unknown | typeof MISSING_CHANGE_VALUE
): string => {
  if (value === MISSING_CHANGE_VALUE) return '(missing)';
  if (typeof value === 'undefined') return 'undefined';
  if (value === null) return 'null';

  if (typeof value === 'string') {
    return value.length > 0 ? JSON.stringify(value) : '""';
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (isRecord(value)) {
    return `Object(${Object.keys(value).length})`;
  }

  return String(value);
};

export const createChangePreview = (
  path: string,
  before: unknown | typeof MISSING_CHANGE_VALUE,
  after: unknown | typeof MISSING_CHANGE_VALUE
): AdminThemeSettingsChangePreview => {
  const kind: AdminThemeSettingsChangeKind = before === MISSING_CHANGE_VALUE
    ? 'added'
    : after === MISSING_CHANGE_VALUE
      ? 'removed'
      : 'updated';

  return {
    path,
    kind,
    before: formatChangePreviewValue(before),
    after: formatChangePreviewValue(after)
  };
};

export const collectMismatchPaths = (
  actual: unknown,
  expected: unknown,
  mode: AdminThemeSettingsMismatchMode,
  basePath = '',
  mismatches: string[] = []
): string[] => {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
      mismatches.push(basePath || 'root');
      return mismatches;
    }

    actual.forEach((item, index) => {
      collectMismatchPaths(item, expected[index], mode, appendPathSegment(basePath, `[${index}]`), mismatches);
    });
    return mismatches;
  }

  if (isRecord(actual) || isRecord(expected)) {
    if (!isRecord(actual) || !isRecord(expected)) {
      mismatches.push(basePath || 'root');
      return mismatches;
    }

    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    const keys = mode === 'exact' ? Array.from(new Set([...actualKeys, ...expectedKeys])) : actualKeys;

    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(actual, key) || !Object.prototype.hasOwnProperty.call(expected, key)) {
        mismatches.push(appendPathSegment(basePath, key));
        return;
      }

      collectMismatchPaths(actual[key], expected[key], mode, appendPathSegment(basePath, key), mismatches);
    });
    return mismatches;
  }

  if (!Object.is(actual, expected)) {
    mismatches.push(basePath || 'root');
  }
  return mismatches;
};

export const getAdminThemeSettingsMismatchPaths = (
  actual: unknown,
  expected: unknown,
  mode: AdminThemeSettingsMismatchMode = 'exact'
): string[] => Array.from(new Set(collectMismatchPaths(actual, expected, mode)));

export const collectChangePreviews = (
  actual: unknown,
  expected: unknown,
  mode: AdminThemeSettingsMismatchMode,
  basePath = '',
  changes: AdminThemeSettingsChangePreview[] = []
): AdminThemeSettingsChangePreview[] => {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
      changes.push(createChangePreview(createChangePath(basePath), actual, expected));
      return changes;
    }

    actual.forEach((item, index) => {
      collectChangePreviews(item, expected[index], mode, appendPathSegment(basePath, `[${index}]`), changes);
    });
    return changes;
  }

  if (isRecord(actual) || isRecord(expected)) {
    if (!isRecord(actual) || !isRecord(expected)) {
      changes.push(createChangePreview(createChangePath(basePath), actual, expected));
      return changes;
    }

    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    const keys = mode === 'exact' ? Array.from(new Set([...actualKeys, ...expectedKeys])) : actualKeys;

    keys.forEach((key) => {
      const path = appendPathSegment(basePath, key);
      const hasActual = Object.prototype.hasOwnProperty.call(actual, key);
      const hasExpected = Object.prototype.hasOwnProperty.call(expected, key);

      if (!hasActual || !hasExpected) {
        changes.push(createChangePreview(
          path,
          hasActual ? actual[key] : MISSING_CHANGE_VALUE,
          hasExpected ? expected[key] : MISSING_CHANGE_VALUE
        ));
        return;
      }

      collectChangePreviews(actual[key], expected[key], mode, path, changes);
    });
    return changes;
  }

  if (!Object.is(actual, expected)) {
    changes.push(createChangePreview(createChangePath(basePath), actual, expected));
  }
  return changes;
};

export const getAdminThemeSettingsChangePreviews = (
  actual: unknown,
  expected: unknown,
  mode: AdminThemeSettingsMismatchMode = 'exact'
): AdminThemeSettingsChangePreview[] => {
  const changes = collectChangePreviews(actual, expected, mode);
  const seenPaths = new Set<string>();

  return changes.filter((change) => {
    if (seenPaths.has(change.path)) return false;
    seenPaths.add(change.path);
    return true;
  });
};

export const createAdminThemeSettingsCanonicalMismatchIssues = (
  actual: unknown,
  expected: unknown,
  options: { mode?: AdminThemeSettingsMismatchMode; pathPrefix?: string; messagePrefix?: string } = {}
): AdminThemeSettingsValidationIssue[] => {
  const {
    mode = 'exact',
    pathPrefix = '',
    messagePrefix = '配置值会在归一化后发生变化，请先修复原始输入'
  } = options;
  const mismatchPaths = getAdminThemeSettingsMismatchPaths(actual, expected, mode);
  return mismatchPaths.map((path) => {
    const normalizedPath = path === 'root'
      ? (pathPrefix || 'root')
      : pathPrefix
        ? appendPathSegment(pathPrefix, path)
        : path;
    return createValidationIssue(normalizedPath, `${messagePrefix}：${normalizedPath}`);
  });
};

export const getAdminThemeSettingsGroupFileName = (group: ThemeSettingsFileGroup): string => `${group}.json`;
