import { describe, expect, it } from 'vitest';
import { createWithBase } from '../src/utils/format';

const withBase = createWithBase('/astro-versicarium/');

describe('createWithBase', () => {
  it('keeps an absolute URL that already carries the deployment base', () => {
    expect(withBase('/astro-versicarium/_astro/rename.Bru1Zdep.webp')).toBe(
      '/astro-versicarium/_astro/rename.Bru1Zdep.webp'
    );
    expect(withBase('/astro-versicarium/')).toBe('/astro-versicarium/');
    // ImageMetadata.src 在 base 已归一为无尾斜杠目录时同样不应重复拼接。
    expect(withBase('/astro-versicarium')).toBe('/astro-versicarium');
  });

  it('prefixes root-relative paths', () => {
    expect(withBase('/images/blog/post/cover.webp')).toBe('/astro-versicarium/images/blog/post/cover.webp');
    expect(withBase('/author/avatar.webp')).toBe('/astro-versicarium/author/avatar.webp');
  });

  it('prefixes site-relative paths', () => {
    expect(withBase('author/avatar.svg')).toBe('/astro-versicarium/author/avatar.svg');
  });

  it('keeps remote URLs and data URLs untouched', () => {
    expect(withBase('https://cdn.example.com/image.webp')).toBe('https://cdn.example.com/image.webp');
    expect(withBase('//cdn.example.com/image.webp')).toBe('//cdn.example.com/image.webp');
    expect(withBase('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('keeps the site root path at the deployment base', () => {
    expect(withBase('/')).toBe('/astro-versicarium/');
    expect(withBase('')).toBe('/astro-versicarium/');
  });

  it('leaves root-relative paths untouched when the base is the site root', () => {
    const rootBase = createWithBase('/');
    expect(rootBase('/images/blog/post/cover.webp')).toBe('/images/blog/post/cover.webp');
    expect(rootBase('author/avatar.svg')).toBe('/author/avatar.svg');
    expect(rootBase('/')).toBe('/');
    expect(rootBase('https://cdn.example.com/image.webp')).toBe('https://cdn.example.com/image.webp');
  });

  it('normalizes a base without a trailing slash', () => {
    const noTrailingSlash = createWithBase('/astro-versicarium');
    expect(noTrailingSlash('/images/cover.webp')).toBe('/astro-versicarium/images/cover.webp');
    expect(noTrailingSlash('author/avatar.svg')).toBe('/astro-versicarium/author/avatar.svg');
    expect(noTrailingSlash('/astro-versicarium/_astro/cover.webp')).toBe(
      '/astro-versicarium/_astro/cover.webp'
    );
  });

  it('only treats a full base segment as already prefixed', () => {
    expect(withBase('/astro-versicarium-other/cover.webp')).toBe(
      '/astro-versicarium/astro-versicarium-other/cover.webp'
    );
    expect(withBase('/astro-versicarium-not-the-base')).toBe(
      '/astro-versicarium/astro-versicarium-not-the-base'
    );
  });
});
