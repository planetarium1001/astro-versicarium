import type {
  ThemeSettingsEditableErrorState,
  ThemeSettingsEditablePayload
} from '@/lib/theme-settings';
import type { EditableSettings } from './form-codec';
import { isRecord } from '../../lib/is-record';

export const extractSettingsPayload = (payload: unknown): ThemeSettingsEditablePayload | null => {
  if (!isRecord(payload)) return null;
  if (typeof payload.revision === 'string' && isRecord(payload.settings)) {
    return payload as unknown as ThemeSettingsEditablePayload;
  }

  const nestedPayload = payload.payload;
  if (
    isRecord(nestedPayload)
    && typeof nestedPayload.revision === 'string'
    && isRecord(nestedPayload.settings)
  ) {
    return nestedPayload as unknown as ThemeSettingsEditablePayload;
  }
  return null;
};

export const extractInvalidSettingsState = (payload: unknown): ThemeSettingsEditableErrorState | null => {
  if (!isRecord(payload)) return null;
  if (payload.ok !== false || payload.mode !== 'invalid-settings') return null;
  if (typeof payload.message !== 'string' || !Array.isArray(payload.errors)) return null;
  return payload as unknown as ThemeSettingsEditableErrorState;
};

export const getPayloadMessage = (payload: unknown): string | null =>
  isRecord(payload) && typeof payload.message === 'string' ? payload.message : null;

export const getPayloadErrors = (payload: unknown): string[] => {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) return [];
  return payload.errors.filter((error): error is string => typeof error === 'string' && error.length > 0);
};

const buildSettingsRequestUrl = (
  endpoint: string,
  currentUrl: string,
  options: { dryRun?: boolean } = {}
): string => {
  const requestUrl = new URL(endpoint, currentUrl);
  if (options.dryRun) {
    requestUrl.searchParams.set('dryRun', '1');
  } else {
    requestUrl.searchParams.delete('dryRun');
  }
  return requestUrl.toString();
};

const createSettingsRequestBody = (
  revision: string | null,
  settings: EditableSettings
): string | null => {
  if (!revision) return null;
  return JSON.stringify({
    revision,
    settings
  });
};

export const requestSettingsWrite = async ({
  endpoint,
  currentUrl,
  revision,
  settings,
  dryRun
}: {
  endpoint: string;
  currentUrl: string;
  revision: string | null;
  settings: EditableSettings;
  dryRun?: boolean;
}): Promise<{ response: Response; payload: unknown }> => {
  const requestBody = createSettingsRequestBody(revision, settings);
  if (!requestBody) {
    throw new Error('missing-revision');
  }

  const response = await fetch(
    buildSettingsRequestUrl(endpoint, currentUrl, dryRun === undefined ? {} : { dryRun }),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      body: requestBody
    }
  );

  const payload = (await response.json().catch(() => null)) as unknown;
  return { response, payload };
};
