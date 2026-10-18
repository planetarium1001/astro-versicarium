import { describe, expect, it } from 'vitest';
import { loadAdminContentEditDevState } from '../src/components/admin/admin-content-edit-dev-state';
import type {
  AdminContentEditorOutlines,
  AdminContentEditorOutlineRegistration,
  AdminContentEditorStyleSlot
} from '../src/components/admin/admin-content-editor-registry';
import { isAdminContentWorkspaceEditorPayload } from '../src/components/admin/admin-content-edit-dev-state';
import {
  ADMIN_CONTENT_WRITE_COLLECTION_KEYS,
  type AdminAboutEditorPayload,
  type AdminBitsEditorPayload,
  type AdminBlogEditorPayload
} from '../src/lib/admin-console/content-shared';
import { getAdminContentCollectionCapability } from '../src/lib/admin-console/content-collections';

const BlogPayload: AdminBlogEditorPayload = {
  collection: 'blog',
  entryId: 'blog-entry',
  publicEntryId: 'blog-entry',
  defaultPublicSlug: 'blog-entry',
  revision: 'blog-rev',
  relativePath: 'content/blog/blog-entry/index.md',
  writable: true,
  readonlyReason: null,
  bodyText: 'blog body',
  values: {
    title: 'blog title',
    description: '',
    date: '2026-06-01',
    publishedAt: '',
    updatedAt: '',
    tagsText: '',
    draft: false,
    slug: '',
    series: '',
    versionLabel: '',
    versionName: '',
    versionSummary: '',
    versionOrder: '',
    ogImage: '',
    ogImageAlt: '',
    badge: ''
  }
};

const bitsPayload: AdminBitsEditorPayload = {
  collection: 'bits',
  entryId: 'bits-entry',
  publicEntryId: 'bits-entry',
  defaultPublicSlug: 'bits-entry',
  revision: 'bits-rev',
  relativePath: 'content/bits/bits-entry/index.md',
  writable: true,
  readonlyReason: null,
  bodyText: 'Bits body',
  values: {
    title: 'Bits title',
    description: '',
    date: '2026-06-01T10:00:00+08:00',
    tagsText: '',
    draft: false,
    authorName: '',
    authorAvatar: '',
    imagesText: ''
  }
};

const aboutPayload: AdminAboutEditorPayload = {
  collection: 'about',
  entryId: 'index',
  publicEntryId: 'index',
  defaultPublicSlug: 'index',
  revision: 'about-rev',
  relativePath: 'content/about/index.md',
  writable: true,
  readonlyReason: null,
  bodyText: 'About body',
  values: {}
};

const outlineFixture: AdminContentEditorOutlines = {
  BlogOutlineItems: [
    {
      entryId: 'blog-entry',
      title: 'blog title',
      editHref: '/admin/content/blog/_edit/blog-entry/',
      dateLabel: '2026-06-01',
      sourceError: null
    }
  ],
  bitsOutlineItems: [
    {
      entryId: 'bits-entry',
      title: 'Bits title',
      editHref: '/admin/content/bits/_edit/bits-entry/',
      dateLabel: '2026-06-01',
      sourceError: null
    }
  ]
};

describe('admin content edit dev state', () => {
  it('loads registry styles and outlines for writable editor payloads', async () => {
    const styleSlots: AdminContentEditorStyleSlot[] = [];
    const outlineRequests: Array<{
      collection: string;
      outlineKind: string;
      href: string;
    }> = [];

    const state = await loadAdminContentEditDevState({
      collection: 'bits',
      entryId: 'bits-entry',
      adminShellStylesHref: 'admin-shell.css',
      withBase: (path) => `/base${path}`,
      readPayload: async () => bitsPayload,
      loadStyleSlot: async (slot) => {
        styleSlots.push(slot);
        return `${slot}.css`;
      },
      loadOutlines: async (registration: AdminContentEditorOutlineRegistration, withBase) => {
        outlineRequests.push({
          collection: registration.collection,
          outlineKind: registration.outlineKind,
          href: withBase('/admin/content/bits/_edit/bits-entry/')
        });
        return outlineFixture;
      }
    });

    expect(state.payload).toBe(bitsPayload);
    expect(state.stylesHref).toEqual([
      'admin-shell.css',
      'adminContentEditor.css',
      'adminContentEditorBits.css',
      'adminContentEditorFrontmatter.css',
      'adminImageShared.css'
    ]);
    expect(state.outlines).toBe(outlineFixture);
    expect(styleSlots).toEqual([
      'adminContentEditor',
      'adminContentEditorBits',
      'adminContentEditorFrontmatter',
      'adminImageShared'
    ]);
    expect(outlineRequests).toEqual([
      {
        collection: 'bits',
        outlineKind: 'list',
        href: '/base/admin/content/bits/_edit/bits-entry/'
      }
    ]);
  });

  it.each([
    ['blog', BlogPayload, [
      'article',
      'adminContentEditor',
      'adminContentEditorFrontmatter',
      'adminContentEditorImageInsert',
      'adminContentEditorGalleryInsert'
    ]],
    ['about', aboutPayload, ['about', 'adminContentEditor', 'adminContentEditorAbout']]
  ] as const)('uses %s registry style slots', async (_collection, payload, expectedSlots) => {
    const styleSlots: AdminContentEditorStyleSlot[] = [];
    const state = await loadAdminContentEditDevState({
      collection: payload.collection,
      entryId: payload.entryId,
      adminShellStylesHref: 'admin-shell.css',
      withBase: (path) => path,
      readPayload: async () => payload,
      loadStyleSlot: async (slot) => {
        styleSlots.push(slot);
        return `${slot}.css`;
      },
      loadOutlines: async () => outlineFixture
    });

    expect(styleSlots).toEqual(expectedSlots);
    expect(state.stylesHref).toEqual([
      'admin-shell.css',
      ...expectedSlots.map((slot) => `${slot}.css`)
    ]);
  });
  // loadAdminContentEditDevState 的默认读取路径经过「工作区载荷集合白名单」，
  // 只注入 readPayload 的用例无法发现 projects/devlog 漏加白名单，
  // 而 DEV 打开这两个集合的编辑页会直接抛错。这里断言白名单覆盖全部 entryWritable 集合。
  it('covers every entry-writable collection in the workspace payload whitelist', () => {
    const entryWritable = ADMIN_CONTENT_WRITE_COLLECTION_KEYS.filter(
      (collection) => getAdminContentCollectionCapability(collection).entryWritable
    );

    expect(entryWritable).toEqual(['blog', 'projects', 'bits', 'devlog', 'about']);
    for (const collection of entryWritable) {
      expect(
        isAdminContentWorkspaceEditorPayload({ collection } as never),
        `${collection} 必须被工作区载荷白名单覆盖`
      ).toBe(true);
    }
  });
});
