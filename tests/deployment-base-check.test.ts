import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { checkDeploymentBase } from '../scripts/check-deployment-base.mjs';

/* check-deployment-base 的负例单测：子路径守卫必须同时拦住「重复 base」与「无法解析的本地 URL」，
   避免以后改动只让正向用例通过、实际回归仍漏网。 */

const BASE = '/astro-versicarium/';
const tempDirs: string[] = [];

const createDist = (files: Record<string, string>): string => {
  const distDir = mkdtempSync(path.join(os.tmpdir(), 'deployment-base-'));
  tempDirs.push(distDir);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(distDir, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  return distDir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('checkDeploymentBase', () => {
  it('接受单 base 且可解析的本地 URL', async () => {
    const distDir = createDist({
      'index.html': '<img src="/astro-versicarium/_astro/a.webp"><a href="/astro-versicarium/about/">关于</a>',
      '_astro/a.webp': 'webp',
      'about/index.html': '<html></html>'
    });

    await expect(checkDeploymentBase({ base: BASE, distDir, quiet: true })).resolves.toMatchObject({
      ok: true,
      duplicateUrls: [],
      unresolvedUrls: []
    });
  });

  it('报告重复 base 前缀', async () => {
    const distDir = createDist({
      'index.html': '<img src="/astro-versicarium/astro-versicarium/_astro/a.webp">',
      '_astro/a.webp': 'webp'
    });

    const result = await checkDeploymentBase({ base: BASE, distDir, quiet: true });
    expect(result.ok).toBe(false);
    expect(result.duplicateUrls).toHaveLength(1);
    expect(result.duplicateUrls[0]).toContain('/astro-versicarium/astro-versicarium/');
  });

  it('报告带 base 但无法映射到 dist 文件的本地 URL', async () => {
    const distDir = createDist({
      'index.html': '<img src="/astro-versicarium/_astro/missing.webp">',
      '_astro/a.webp': 'webp'
    });

    const result = await checkDeploymentBase({ base: BASE, distDir, quiet: true });
    expect(result.ok).toBe(false);
    expect(result.duplicateUrls).toEqual([]);
    expect(result.unresolvedUrls).toHaveLength(1);
    expect(result.unresolvedUrls[0]).toContain('missing.webp');
  });

  it('目录按 index.html 解析，带 query/hash 的 URL 去掉装饰后再匹配', async () => {
    const distDir = createDist({
      'index.html': '<a href="/astro-versicarium/blog/?tags=x#top">文章</a>',
      'blog/index.html': '<html></html>'
    });

    await expect(checkDeploymentBase({ base: BASE, distDir, quiet: true })).resolves.toMatchObject({
      ok: true
    });
  });
});
