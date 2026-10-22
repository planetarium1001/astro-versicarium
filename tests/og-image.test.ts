import { describe, expect, it } from 'vitest';
import { resolveOgImageUrl } from '../src/utils/og-image';

const SITE = 'https://example.com';

describe('resolveOgImageUrl', () => {
  it('外链原样返回', () => {
    expect(resolveOgImageUrl('https://cdn.example.com/a.webp', '/', SITE)).toBe(
      'https://cdn.example.com/a.webp'
    );
  });

  it('根路径部署时直接拼接站点地址', () => {
    expect(resolveOgImageUrl('/images/share.webp', '/', SITE)).toBe(
      `${SITE}/images/share.webp`
    );
  });

  it('子路径部署时为站点自己的公开路径补 base', () => {
    expect(resolveOgImageUrl('/images/share.webp', '/blog/', SITE)).toBe(
      `${SITE}/blog/images/share.webp`
    );
  });

  it('图片元数据已带 base 时不重复拼接', () => {
    expect(
      resolveOgImageUrl('/astro-versicarium/_astro/hero.abc.webp', '/astro-versicarium/', SITE)
    ).toBe(`${SITE}/astro-versicarium/_astro/hero.abc.webp`);
  });

  it('缺少前导斜杠的图片元数据也会正确补 base', () => {
    expect(resolveOgImageUrl('_astro/hero.abc.webp', '/blog/', SITE)).toBe(
      `${SITE}/blog/_astro/hero.abc.webp`
    );
  });
});
