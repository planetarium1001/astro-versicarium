import { describe, expect, it } from 'vitest';
import {
  ADMIN_CONTENT_BODY_IMAGE_UPLOAD_COLLECTION_KEYS,
  ADMIN_CONTENT_COLLECTION_KEYS,
  ADMIN_CONTENT_CREATABLE_COLLECTION_KEYS,
  ADMIN_CONTENT_DELETABLE_COLLECTION_KEYS,
  ADMIN_CONTENT_ENTRY_WRITE_COLLECTION_KEYS,
  ADMIN_CONTENT_EXPORTABLE_COLLECTION_KEYS,
  ADMIN_CONTENT_IMAGE_UPLOAD_COLLECTION_KEYS,
  ADMIN_CONTENT_WRITE_COLLECTION_KEYS,
  getAdminContentCollectionCapability,
  getAdminContentFixedPageCapability,
  isAdminContentBodyImageUploadCollectionKey,
  isAdminContentCreatableCollectionKey,
  isAdminContentDeletableCollectionKey,
  isAdminContentEntryWriteCollectionKey,
  isAdminContentExportableCollectionKey,
  isAdminContentImageUploadCollectionKey,
  isAdminContentWriteCollectionKey
} from '../src/lib/admin-console/content-shared';
import {
  ADMIN_CONTENT_COLLECTIONS,
  ADMIN_CONTENT_SCOPE_OPTIONS
} from '../src/lib/admin-console/content';

describe('admin content collection capabilities', () => {
  it('keeps about fixed-page writable without entering delete/upload capabilities', () => {
    const allKeys = ['blog', 'projects', 'bits', 'devlog', 'about'];
    expect(ADMIN_CONTENT_COLLECTION_KEYS).toEqual(allKeys);
    expect(ADMIN_CONTENT_COLLECTIONS).toEqual(allKeys);
    expect(ADMIN_CONTENT_SCOPE_OPTIONS.map((option) => option.value)).toEqual(['all', ...allKeys]);

    expect(ADMIN_CONTENT_ENTRY_WRITE_COLLECTION_KEYS).toEqual(allKeys);
    expect(ADMIN_CONTENT_WRITE_COLLECTION_KEYS).toEqual(allKeys);
    expect(ADMIN_CONTENT_CREATABLE_COLLECTION_KEYS).toEqual(['blog', 'projects', 'bits', 'devlog']);
    expect(ADMIN_CONTENT_DELETABLE_COLLECTION_KEYS).toEqual(['blog', 'projects', 'bits', 'devlog']);
    expect(ADMIN_CONTENT_IMAGE_UPLOAD_COLLECTION_KEYS).toEqual(['blog', 'projects', 'bits', 'devlog']);
    expect(ADMIN_CONTENT_BODY_IMAGE_UPLOAD_COLLECTION_KEYS).toEqual(['blog', 'projects', 'devlog']);
    expect(ADMIN_CONTENT_EXPORTABLE_COLLECTION_KEYS).toEqual(allKeys);

    expect(isAdminContentEntryWriteCollectionKey('about')).toBe(true);
    expect(isAdminContentWriteCollectionKey('about')).toBe(true);
    expect(isAdminContentCreatableCollectionKey('blog')).toBe(true);
    expect(isAdminContentCreatableCollectionKey('bits')).toBe(true);
    expect(isAdminContentCreatableCollectionKey('about')).toBe(false);
    expect(isAdminContentDeletableCollectionKey('about')).toBe(false);
    expect(isAdminContentImageUploadCollectionKey('about')).toBe(false);
    expect(isAdminContentBodyImageUploadCollectionKey('about')).toBe(false);
    expect(isAdminContentExportableCollectionKey('about')).toBe(true);

    expect(getAdminContentFixedPageCapability('about')).toEqual({
      entryId: 'index',
      sourcePath: 'content/about/index.md'
    });
    expect(getAdminContentCollectionCapability('blog').create).toBe(true);
    expect(getAdminContentCollectionCapability('about')).toMatchObject({
      label: '关于',
      visible: true,
      entryWritable: true,
      writable: true,
      exportable: true,
      deletable: false,
      create: false,
      multiEntry: false,
      articleFilters: false,
      pagination: false,
      bodySearch: true,
      bodyImageUpload: false,
      imageUpload: false,
      imagePicker: false
    });
  });
});
