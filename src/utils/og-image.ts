/**
 * og:image 的绝对地址：外链原样返回；站内路径补部署 base 后再按站点 origin 绝对化。
 *
 * Astro 图片元数据的 `src` 在带 base 的构建里已经包含 base（例如
 * `/astro-versicarium/_astro/hero.webp`），这里不能再次拼接，否则会得到
 * `/astro-versicarium/astro-versicarium/...`。站点自己写的公开路径（例如
 * `/images/share.webp`）仍需要补 base。
 */
export const resolveOgImageUrl = (
  value: string,
  base: string,
  siteUrl: string | URL
): string => {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;

  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedValue = value.startsWith('/') ? value : `/${value}`;
  const alreadyBased = normalizedBase !== '/' && normalizedValue.startsWith(normalizedBase);
  const path = alreadyBased ? normalizedValue : `${normalizedBase}${normalizedValue.slice(1)}`;
  return new URL(path, siteUrl).toString();
};
