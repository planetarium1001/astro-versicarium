import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  uploadAdminBlogImage,
  uploadAdminContentFile
} from '../src/lib/admin-console/image-upload';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=',
  'base64'
);

const oldProjectRoot = process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;

const createImageFile = (fileName = 'Whono Mark.PNG'): File =>
  new File([PNG_1X1], fileName, { type: 'image/png' });

describe('admin shared upload target', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-shared-upload-'));
    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
    delete process.env.ASTRO_WHONO_IMAGE_STORAGE;
  });

  afterEach(async () => {
    if (oldProjectRoot === undefined) delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    else process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = oldProjectRoot;
    delete process.env.ASTRO_WHONO_IMAGE_STORAGE;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('uploads shared images to content/<collection>/_shared/images without an index.md', async () => {
    const result = await uploadAdminBlogImage({ entryId: '_shared', file: createImageFile() });

    expect(result).toMatchObject({
      src: './images/whono-mark.png',
      path: 'content/blog/_shared/images/whono-mark.png',
      fileName: 'whono-mark.png',
      mimeType: 'image/png'
    });
    await expect(
      readFile(path.join(tempRoot, 'content', 'blog', '_shared', 'images', 'whono-mark.png'))
    ).resolves.toEqual(PNG_1X1);
    await expect(
      stat(path.join(tempRoot, 'content', 'blog', '_shared', 'index.md'))
    ).rejects.toThrow();
  });

  it('uploads shared attachments to content/<collection>/_shared/files', async () => {
    const result = await uploadAdminContentFile({
      collection: 'blog',
      entryId: '_shared',
      file: new File(['shared note'], 'Shared Note.PDF', { type: 'application/pdf' })
    });

    expect(result).toMatchObject({
      src: './files/shared-note.pdf',
      path: 'content/blog/_shared/files/shared-note.pdf',
      fileName: 'shared-note.pdf'
    });
    await expect(
      readFile(path.join(tempRoot, 'content', 'blog', '_shared', 'files', 'shared-note.pdf'), 'utf8')
    ).resolves.toBe('shared note');
  });

  it('still rejects uploads for a missing non-shared entry', async () => {
    await expect(
      uploadAdminBlogImage({ entryId: 'missing-entry', file: createImageFile('cover.png') })
    ).rejects.toMatchObject({ name: 'AdminImageUploadError', status: 404 });

    await expect(
      uploadAdminContentFile({
        collection: 'blog',
        entryId: 'missing-entry',
        file: new File(['note'], 'note.txt', { type: 'text/plain' })
      })
    ).rejects.toMatchObject({ name: 'AdminImageUploadError', status: 404 });
  });

  it('rejects entry ids that would escape the shared directory', async () => {
    await expect(
      uploadAdminBlogImage({ entryId: '../_shared', file: createImageFile() })
    ).rejects.toMatchObject({ name: 'AdminImageUploadError', status: 400 });

    await expect(
      uploadAdminBlogImage({ entryId: '_shared/../../outside', file: createImageFile() })
    ).rejects.toMatchObject({ name: 'AdminImageUploadError', status: 400 });

    await expect(
      uploadAdminContentFile({
        collection: 'blog',
        entryId: '_shared/../outside',
        file: new File(['note'], 'note.txt', { type: 'text/plain' })
      })
    ).rejects.toMatchObject({ name: 'AdminImageUploadError', status: 400 });
  });
});
