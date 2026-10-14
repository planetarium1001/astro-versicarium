import { describe, expect, it } from 'vitest';
import {
  getContentEditorAdapter
} from '../src/components/admin/editor/shared/content-editor-adapters';
import {
  getPayloadEditorBody,
  getPayloadEditorValues
} from '../src/scripts/admin-content/entry-transport';
import type { AdminAboutEditorValues } from '../src/lib/admin-console/content-about-contract';
import type {
  AdminBitsEditorValues,
} from '../src/lib/admin-console/content-shared';
import {
  ADMIN_CONTENT_WRITE_COLLECTION_KEYS,
  getAdminContentCollectionCapability
} from '../src/lib/admin-console/content-collections';

describe('content editor adapters', () => {
  it('keeps blog body image tools separate from bits image array tools', () => {
    const blog = getContentEditorAdapter('blog');
    const bits = getContentEditorAdapter('bits');
    const about = getContentEditorAdapter('about');

    expect(blog.capabilities.bodyImageInsert).toBe(true);
    expect(blog.capabilities.imageArray).toBe(false);
    expect(blog.capabilities.delete).toBe(true);

    expect(bits.capabilities.body).toBe(true);
    expect(bits.capabilities.preview).toBe(true);
    expect(bits.capabilities.bodyImageInsert).toBe(false);
    expect(bits.capabilities.bodyGalleryInsert).toBe(false);
    expect(bits.capabilities.imageArray).toBe(true);
    expect(bits.capabilities.delete).toBe(true);
    expect(bits.isFrontmatterIssuePath('images[0].src')).toBe(true);
    expect(blog.isFrontmatterIssuePath('images[0].src')).toBe(false);

    expect(about.capabilities.body).toBe(true);
    expect(about.capabilities.preview).toBe(true);
    expect(about.capabilities.bodyImageInsert).toBe(false);
    expect(about.capabilities.bodyGalleryInsert).toBe(false);
    expect(about.capabilities.imageArray).toBe(false);
    expect(about.capabilities.delete).toBe(false);
    expect(about.frontmatterIssuePaths.size).toBe(0);
    expect(about.isFrontmatterIssuePath('friends[0].url')).toBe(false);
    expect(about.isFrontmatterIssuePath('faq[0].answer')).toBe(false);
    expect(about.isFrontmatterIssuePath('title')).toBe(false);
  });

  it('derives delete affordance from collection capabilities', () => {
    const collections = ADMIN_CONTENT_WRITE_COLLECTION_KEYS;

    for (const collection of collections) {
      const adapter = getContentEditorAdapter(collection);
      const capability = getAdminContentCollectionCapability(collection);
      expect(adapter.capabilities.delete).toBe(capability.deletable);
    }
  });

  it('ignores editor payloads for the wrong collection', () => {
    const bitsValues: AdminBitsEditorValues = {
      title: 'Bit',
      description: '',
      date: '2026-05-26T10:00:00+08:00',
      tagsText: '',
      draft: false,
      authorName: '',
      authorAvatar: '',
      imagesText: ''
    };
    const payload = {
      ok: true,
      payload: {
        collection: 'bits',
        entryId: '2026-05-26-bit',
        publicEntryId: '2026-05-26-bit',
        defaultPublicSlug: '2026-05-26-bit',
        revision: 'rev',
        relativePath: 'src/content/bits/2026-05-26-bit.md',
        writable: true,
        readonlyReason: null,
        bodyText: 'Bit body',
        values: bitsValues
      }
    };

    expect(getPayloadEditorValues(payload, 'bits')).toEqual(bitsValues);
    expect(getPayloadEditorValues(payload, 'blog')).toBeNull();
    expect(getPayloadEditorBody(payload, 'bits')).toBe('Bit body');
    expect(getPayloadEditorBody(payload, 'blog')).toBeNull();
  });

  it('accepts writable about payloads with body-only values', () => {
    const aboutValues: AdminAboutEditorValues = {};
    const payload = {
      ok: true,
      payload: {
        collection: 'about',
        entryId: 'index',
        publicEntryId: 'index',
        defaultPublicSlug: 'index',
        revision: 'rev',
        relativePath: 'src/content/about/index.md',
        writable: true,
        readonlyReason: null,
        bodyText: 'About body',
        values: aboutValues
      }
    };

    expect(getPayloadEditorValues(payload, 'about')).toEqual(aboutValues);
    expect(getPayloadEditorBody(payload, 'about')).toBe('About body');
  });
});
