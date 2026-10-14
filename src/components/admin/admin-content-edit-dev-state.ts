import type {
  AdminContentWriteCollectionKey
} from '../../lib/admin-console/content-collections';
import type {
  AdminContentEditorPayload,
  AdminContentWorkspaceEditorPayload
} from '../../lib/admin-console/content-editor-payload';
import {
  readAdminContentEntryEditorPayload
} from '../../lib/admin-console/content-editor-payload';
import {
  getAdminContentEditorPageRegistration,
  loadAdminContentEditorOutlines,
  loadAdminContentEditorStyleHrefs,
  type AdminContentEditorOutlines,
  type AdminContentEditorOutlineRegistration,
  type AdminContentEditorStyleSlot
} from './admin-content-editor-registry';

type WithBase = (path: string) => string;
type ReadEditorPayload = (
  collection: AdminContentWriteCollectionKey,
  entryId: string
) => Promise<AdminContentWorkspaceEditorPayload>;
type LoadStyleSlot = (slot: AdminContentEditorStyleSlot) => Promise<string>;
type LoadOutlines = (
  registration: AdminContentEditorOutlineRegistration,
  withBase: WithBase
) => Promise<AdminContentEditorOutlines>;

type LoadAdminContentEditDevStateInput = {
  collection: AdminContentWriteCollectionKey;
  entryId: string;
  adminShellStylesHref: string;
  withBase: WithBase;
  readPayload?: ReadEditorPayload;
  loadStyleSlot?: LoadStyleSlot;
  loadOutlines?: LoadOutlines;
};

type AdminContentEditDevState = {
  payload: AdminContentWorkspaceEditorPayload;
  outlines: AdminContentEditorOutlines;
  stylesHref: string[];
};

/**
 * 工作区编辑器覆盖的集合；新增集合必须同时出现在这里，
 * 否则 DEV 下打开该集合的编辑页会抛错。
 */
const WORKSPACE_EDITOR_COLLECTIONS = [
  'blog',
  'projects',
  'bits',
  'devlog',
  'about'
] as const satisfies readonly AdminContentWorkspaceEditorPayload['collection'][];

/** 白名单判定，供回归测试断言集合覆盖。 */
export const isAdminContentWorkspaceEditorPayload = (
  payload: AdminContentEditorPayload
): payload is AdminContentWorkspaceEditorPayload =>
  (WORKSPACE_EDITOR_COLLECTIONS as readonly string[]).includes(payload.collection);

const readAdminContentWorkspaceEditorPayload: ReadEditorPayload = async (collection, entryId) => {
  const payload = await readAdminContentEntryEditorPayload(collection, entryId);
  if (!isAdminContentWorkspaceEditorPayload(payload) || payload.collection !== collection) {
    throw new Error(`Unexpected admin content editor payload: ${payload.collection}`);
  }
  return payload;
};

export const loadAdminContentEditDevState = async ({
  collection,
  entryId,
  adminShellStylesHref,
  withBase,
  readPayload = readAdminContentWorkspaceEditorPayload,
  loadStyleSlot,
  loadOutlines = loadAdminContentEditorOutlines
}: LoadAdminContentEditDevStateInput): Promise<AdminContentEditDevState> => {
  const payload = await readPayload(collection, entryId);

  const registration = getAdminContentEditorPageRegistration(payload.collection);
  const [editorStylesHref, outlines] = await Promise.all([
    loadAdminContentEditorStyleHrefs(registration.styleSlots, loadStyleSlot),
    loadOutlines(registration, withBase)
  ]);

  return {
    payload,
    outlines,
    stylesHref: [adminShellStylesHref, ...editorStylesHref]
  };
};
