export const DEFAULT_SITE_FAVICON = {
  svg: 'favicon.svg',
  png: 'favicon-32x32.png',
  appleTouchIcon: 'apple-touch-icon.png'
} as const;

export const GENERATED_SITE_FAVICON = {
  dir: '/images/site/generated',
  ico: '/favicon.ico',
  png16: '/images/site/generated/favicon-16x16.png',
  png32: '/images/site/generated/favicon-32x32.png',
  appleTouchIcon: '/images/site/generated/apple-touch-icon.png',
  icon192: '/images/site/generated/icon-192.png',
  icon512: '/images/site/generated/icon-512.png',
  manifest: '/images/site/generated/site.webmanifest'
} as const;
