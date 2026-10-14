import type {
  AdminBitsEditorPayload,
  AdminBitsEditorValues,
  AdminContentEditorPayload,
  AdminContentEditorValues,
  AdminBlogEditorPayload,
  AdminBlogEditorValues,
  AdminDevlogEditorPayload,
  AdminDevlogEditorValues,
  AdminProjectsEditorPayload,
  AdminProjectsEditorValues
} from '../../lib/admin-console/content-editor-payload';
import type { AdminContentEntryWriteCollectionKey } from '../../lib/admin-console/content-collections';
import type { AdminContentValidationIssue } from '../../lib/admin-console/content-entry-contract';
import type {
  AdminAboutEditorPayload,
  AdminAboutEditorValues
} from '../../lib/admin-console/content-about-contract';

export type AdminContentWriteResult = {
  changed: boolean;
  written: boolean;
  changedFields: string[];
  relativePath: string;
};

export type AdminContentDeleteResult = {
  collection: string;
  entryId: string;
  deleted: boolean;
  relativePath: string;
  trashedPath: string;
};

export type AdminContentPreviewResult = {
  html: string;
  warnings: string[];
  elapsedMs: number | null;
  codeHighlight: string;
};

export type AdminContentIssue = {
  path: string;
  message: string;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

export const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const isPayloadOk = (value: unknown): value is Record<string, unknown> & { ok: true } =>
  isRecord(value) && value.ok === true;

export const getPayloadErrors = (value: unknown): string[] =>
  isRecord(value) ? getStringArray(value.errors) : [];

export const getPayloadIssues = (value: unknown): AdminContentIssue[] => {
  if (!isRecord(value) || !Array.isArray(value.issues)) return [];

  return value.issues
    .filter((item): item is AdminContentValidationIssue =>
      isRecord(item) && typeof item.path === 'string' && typeof item.message === 'string')
    .map((item) => ({
      path: item.path.trim(),
      message: item.message.trim()
    }));
};

export const getPayloadRevision = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const revision = value.payload.revision;
  return typeof revision === 'string' && revision.trim().length > 0 ? revision.trim() : null;
};

export const getPayloadResult = (value: unknown): AdminContentWriteResult | null => {
  if (!isRecord(value) || !isRecord(value.result)) return null;
  return {
    changed: value.result.changed === true,
    written: value.result.written === true,
    changedFields: getStringArray(value.result.changedFields),
    relativePath: typeof value.result.relativePath === 'string' ? value.result.relativePath.trim() : ''
  };
};

export const getPayloadDeleteResult = (value: unknown): AdminContentDeleteResult | null => {
  if (!isRecord(value) || !isRecord(value.result)) return null;
  return {
    collection: typeof value.result.collection === 'string' ? value.result.collection.trim() : '',
    entryId: typeof value.result.entryId === 'string' ? value.result.entryId.trim() : '',
    deleted: value.result.deleted === true,
    relativePath: typeof value.result.relativePath === 'string' ? value.result.relativePath.trim() : '',
    trashedPath: typeof value.result.trashedPath === 'string' ? value.result.trashedPath.trim() : ''
  };
};

export const getPayloadPreviewResult = (value: unknown): AdminContentPreviewResult | null => {
  if (!isRecord(value) || !isRecord(value.result)) return null;

  return {
    html: typeof value.result.html === 'string' ? value.result.html : '',
    warnings: getStringArray(value.result.warnings),
    elapsedMs: typeof value.result.elapsedMs === 'number' ? value.result.elapsedMs : null,
    codeHighlight: typeof value.result.codeHighlight === 'string' ? value.result.codeHighlight : ''
  };
};

const isAdminBlogEditorValues = (value: unknown): value is AdminBlogEditorValues =>
  isRecord(value)
  && typeof value.title === 'string'
  && typeof value.description === 'string'
  && typeof value.date === 'string'
  && typeof value.publishedAt === 'string'
  && typeof value.updatedAt === 'string'
  && typeof value.tagsText === 'string'
  && typeof value.draft === 'boolean'
  && typeof value.slug === 'string'
  && typeof value.cover === 'string'
  && typeof value.badge === 'string';

const isAdminBitsEditorValues = (value: unknown): value is AdminBitsEditorValues =>
  isRecord(value)
  && typeof value.title === 'string'
  && typeof value.description === 'string'
  && typeof value.date === 'string'
  && typeof value.tagsText === 'string'
  && typeof value.draft === 'boolean'
  && typeof value.authorName === 'string'
  && typeof value.authorAvatar === 'string'
  && typeof value.imagesText === 'string';

/** projects / devlog 的字段袋校验必须与 payload builder 的字段一一对应。 */
const isAdminProjectsEditorValues = (value: unknown): value is AdminProjectsEditorValues =>
  isRecord(value)
  && typeof value.title === 'string'
  && typeof value.subtitle === 'string'
  && typeof value.description === 'string'
  && typeof value.type === 'string'
  && typeof value.icon === 'string'
  && typeof value.image === 'string'
  && typeof value.date === 'string'
  && typeof value.draft === 'boolean';

const isAdminDevlogEditorValues = (value: unknown): value is AdminDevlogEditorValues =>
  isRecord(value)
  && typeof value.title === 'string'
  && typeof value.date === 'string'
  && typeof value.project === 'string'
  && typeof value.kind === 'string'
  && typeof value.description === 'string'
  && typeof value.draft === 'boolean';

const isAdminAboutEditorValues = (value: unknown): value is AdminAboutEditorValues =>
  isRecord(value) && Object.keys(value).length === 0;

const makePayloadGuard = <Payload>(
  collection: string,
  isValues: (value: unknown) => boolean
) => (value: unknown): value is Payload =>
  isRecord(value)
  && value.collection === collection
  && typeof value.entryId === 'string'
  && typeof value.publicEntryId === 'string'
  && typeof value.defaultPublicSlug === 'string'
  && typeof value.revision === 'string'
  && typeof value.relativePath === 'string'
  && value.writable === true
  && value.readonlyReason === null
  && typeof value.bodyText === 'string'
  && isValues(value.values);

const isAdminProjectsEditorPayload = makePayloadGuard<AdminProjectsEditorPayload>(
  'projects',
  isAdminProjectsEditorValues
);

const isAdminDevlogEditorPayload = makePayloadGuard<AdminDevlogEditorPayload>(
  'devlog',
  isAdminDevlogEditorValues
);

const isAdminBlogEditorPayload = (value: unknown): value is AdminBlogEditorPayload =>
  isRecord(value)
  && value.collection === 'blog'
  && typeof value.entryId === 'string'
  && typeof value.publicEntryId === 'string'
  && typeof value.defaultPublicSlug === 'string'
  && typeof value.revision === 'string'
  && typeof value.relativePath === 'string'
  && value.writable === true
  && value.readonlyReason === null
  && typeof value.bodyText === 'string'
  && isAdminBlogEditorValues(value.values);

const isAdminBitsEditorPayload = (value: unknown): value is AdminBitsEditorPayload =>
  isRecord(value)
  && value.collection === 'bits'
  && typeof value.entryId === 'string'
  && typeof value.publicEntryId === 'string'
  && typeof value.defaultPublicSlug === 'string'
  && typeof value.revision === 'string'
  && typeof value.relativePath === 'string'
  && value.writable === true
  && value.readonlyReason === null
  && typeof value.bodyText === 'string'
  && isAdminBitsEditorValues(value.values);

const isAdminAboutEditorPayload = (value: unknown): value is AdminAboutEditorPayload =>
  isRecord(value)
  && value.collection === 'about'
  && typeof value.entryId === 'string'
  && typeof value.publicEntryId === 'string'
  && typeof value.defaultPublicSlug === 'string'
  && typeof value.revision === 'string'
  && typeof value.relativePath === 'string'
  && value.writable === true
  && value.readonlyReason === null
  && typeof value.bodyText === 'string'
  && isAdminAboutEditorValues(value.values);

export const getPayloadEditorPayload = (value: unknown): AdminContentEditorPayload | null => {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const { payload } = value;
  if (isAdminBlogEditorPayload(payload)) return payload;
  if (isAdminProjectsEditorPayload(payload)) return payload;
  if (isAdminBitsEditorPayload(payload)) return payload;
  if (isAdminDevlogEditorPayload(payload)) return payload;
  if (isAdminAboutEditorPayload(payload)) return payload;
  return null;
};

export function getPayloadEditorValues(value: unknown, collection: 'blog'): AdminBlogEditorValues | null;
export function getPayloadEditorValues(value: unknown, collection: 'projects'): AdminProjectsEditorValues | null;
export function getPayloadEditorValues(value: unknown, collection: 'bits'): AdminBitsEditorValues | null;
export function getPayloadEditorValues(value: unknown, collection: 'devlog'): AdminDevlogEditorValues | null;
export function getPayloadEditorValues(value: unknown, collection: 'about'): AdminAboutEditorValues | null;
export function getPayloadEditorValues(
  value: unknown,
  collection: AdminContentEntryWriteCollectionKey
): AdminContentEditorValues | null;
export function getPayloadEditorValues(
  value: unknown,
  collection: AdminContentEntryWriteCollectionKey
): AdminContentEditorValues | null {
  const payload = getPayloadEditorPayload(value);
  if (!payload || payload.collection !== collection || !payload.writable) return null;
  if (collection === 'blog' && isAdminBlogEditorPayload(payload)) return payload.values;
  if (collection === 'projects' && isAdminProjectsEditorPayload(payload)) return payload.values;
  if (collection === 'bits' && isAdminBitsEditorPayload(payload)) return payload.values;
  if (collection === 'devlog' && isAdminDevlogEditorPayload(payload)) return payload.values;
  if (collection === 'about' && isAdminAboutEditorPayload(payload)) return payload.values;
  return null;
}

export const getPayloadEditorBody = (
  value: unknown,
  collection: AdminContentEntryWriteCollectionKey
): string | null => {
  const payload = getPayloadEditorPayload(value);
  if (!payload || payload.collection !== collection) return null;
  if (collection === 'blog' && isAdminBlogEditorPayload(payload)) return payload.bodyText;
  if (collection === 'projects' && isAdminProjectsEditorPayload(payload)) return payload.bodyText;
  if (collection === 'bits' && isAdminBitsEditorPayload(payload)) return payload.bodyText;
  if (collection === 'devlog' && isAdminDevlogEditorPayload(payload)) return payload.bodyText;
  if (collection === 'about' && isAdminAboutEditorPayload(payload)) return payload.bodyText;
  return null;
};
