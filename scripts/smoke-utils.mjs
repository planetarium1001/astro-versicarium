import { readFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const smokeFixturePath = path.join(distDir, 'checks', 'markdown-smoke', 'index.html');
const ADMIN_OVERVIEW_HEADER_PATTERN = new RegExp([
  '<h1\\b(?=[^>]*\\bclass="[^"]*\\bpage-title\\b[^"]*")[^>]*>\\s*Site Overview\\s*</h1>',
  '<span\\b(?=[^>]*\\bclass="[^"]*\\bpage-subtitle\\b[^"]*")[^>]*>\\s*站点概览\\s*</span>'
].join('\\s*'));
const ADMIN_ROUTE_NAV_PATTERN = /<nav\b(?=[^>]*\bclass=(["'])[^"']*\badmin-route-nav\b[^"']*\1)[^>]*>/;

export const DEV_ADMIN_UI_PREFERENCE_MARKERS = [
  'data-admin-sidebar-nav',
  'data-admin-nav-switcher',
  'data-admin-nav-mode',
  'data-admin-show-top-nav',
  'data-admin-ui-prefs-root',
  'astro-whono:admin-sidebar:nav-mode',
  'astro-whono:admin-sidebar:default-nav-mode',
  'astro-whono:admin:show-top-nav',
  'astro-whono:admin-editor:defaults',
  'astro-whono:admin-editor:layout',
  'astro-whono:admin-editor:outline-state',
  'astro-whono:admin-sidebar:state',
  'AdminUiPrefsCard',
  'admin-sidebar-toggle'
];

export const expect = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

export const readSmokeFixtureHtml = async (label) => {
  try {
    return await readFile(smokeFixturePath, 'utf8');
  } catch {
    console.error(`${label} failed: unable to read build output.`);
    console.error(`Expected file: ${smokeFixturePath}`);
    console.error('Run `npm run build` first.');
    process.exit(1);
  }
};

export const reportSmokeCheckResult = (label, failedIds) => {
  if (!failedIds.length) {
    console.log(`${label} passed.`);
    return;
  }

  console.error(`${label} failed:`);
  for (const id of failedIds) {
    console.error(`- missing ${id}`);
  }
  process.exit(1);
};

// 静态构建下这些 API 路由不产出 JSON，只产出重定向壳或 404 页。
const assertStaticUnsupportedApiShell = (label, body, expectedPath) => {
  const expectedRedirectText = `Redirecting to: ${expectedPath}`;
  const normalizedBody = body.trim();
  const looksLikeNotFoundShell =
    normalizedBody === 'Not Found'
    || body.includes('<title>404: Not Found</title>')
    || body.includes('<span class="statusCode">404: </span>');
  expect(
    body.includes(expectedRedirectText) || looksLikeNotFoundShell,
    `${label} did not match the current static non-JSON shell`
  );
};

export const assertAdminOverviewHeader = (label, body) => {
  expect(
    ADMIN_OVERVIEW_HEADER_PATTERN.test(body),
    `${label} is missing the visible Site Overview heading and 站点概览 subtitle`
  );
};

export const assertNoAdminRouteNav = (label, body) => {
  expect(
    !ADMIN_ROUTE_NAV_PATTERN.test(body),
    `${label} should not expose admin route tabs outside dev`
  );
};

export const assertNoDevAdminUiPreferenceChrome = (label, body) => {
  for (const marker of DEV_ADMIN_UI_PREFERENCE_MARKERS) {
    expect(
      !body.includes(marker),
      `${label} should not expose DEV-only admin UI preference marker: ${marker}`
    );
  }
};

const assertAdminApiStaticShell = (label, body, expectedPath, leakedMarkers) => {
  assertStaticUnsupportedApiShell(label, body, expectedPath);
  for (const marker of leakedMarkers) {
    expect(
      !body.includes(marker),
      `${label} leaked API payload marker ${marker} in production preview`
    );
  }
  expect(
    !body.includes('"mode":"readonly"') && !body.includes('"mode": "readonly"'),
    `${label} still looks like the removed production readonly JSON contract`
  );
};

export const assertAdminSettingsStaticShell = (label, body, expectedPath = '/api/admin/settings/') => {
  assertAdminApiStaticShell(label, body, expectedPath, ['"revision"', '"settings"']);
};

export const assertAdminContentStaticShell = (
  label,
  body,
  expectedPath = '/api/admin/content/entry/'
) => {
  assertAdminApiStaticShell(label, body, expectedPath, [
    '"revision"',
    '"writable"',
    '"changedFields"',
    '"frontmatter"'
  ]);
};

export const assertAdminImageStaticShell = (label, body, expectedPath) => {
  assertAdminApiStaticShell(label, body, expectedPath, [
    '"items"',
    '"mimeType"',
    '"width"',
    '"height"',
    '"previewSrc"'
  ]);
};

export const assertAdminImageUploadStaticShell = (
  label,
  body,
  expectedPath = '/api/admin/images/upload/'
) => {
  assertAdminApiStaticShell(label, body, expectedPath, [
    '"result"',
    '"src"',
    '"path"',
    '"fileName"',
    '"mimeType"'
  ]);
};

export const assertAdminPreviewStaticShell = (label, body, expectedPath = '/api/admin/preview/') => {
  assertAdminApiStaticShell(label, body, expectedPath, [
    '"html"',
    '"source"',
    '"codeHighlight"',
    '"elapsedMs"'
  ]);
};
