import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FAVICON_DEFAULT_PATHS,
  resolveFaviconProbePlan,
  shouldWriteRootIco
} from '../scripts/favicon-shared.mjs';
import { applyFaviconProbePlanToDist } from '../src/integrations/site-favicon.mjs';

const tempDirs: string[] = [];

interface ProjectFixture {
  favicon?: Record<string, unknown>;
  publicFiles?: Record<string, string | Buffer>;
}

const defaultPublicFiles = (): Record<string, string | Buffer> => ({
  'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg" />',
  'favicon-32x32.png': Buffer.from('default-png-32'),
  'apple-touch-icon.png': Buffer.from('default-apple-touch-icon'),
  'favicon.ico': Buffer.from('default-ico')
});

/** 在临时目录里搭出生成器需要的最小项目结构：site.json + public 文件。 */
const createProject = ({
  favicon = {},
  publicFiles = defaultPublicFiles()
}: ProjectFixture = {}): string => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'astro-versicarium-favicon-'));
  tempDirs.push(projectRoot);

  const settingsDir = path.join(projectRoot, 'src', 'data', 'settings');
  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(path.join(settingsDir, 'site.json'), JSON.stringify({ favicon }, null, 2), 'utf8');

  for (const [relativePath, content] of Object.entries(publicFiles)) {
    const target = path.join(projectRoot, 'public', relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }

  return projectRoot;
};

const createDist = (
  projectRoot: string,
  files: Record<string, string | Buffer>
): string => {
  const distDirectory = path.join(projectRoot, 'dist');
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(distDirectory, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return distDirectory;
};

const resolvePlan = (projectRoot: string) => {
  const plan = resolveFaviconProbePlan(projectRoot);
  if (!plan) throw new Error('expected resolveFaviconProbePlan to return a plan');
  return plan;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('resolveFaviconProbePlan', () => {
  it('returns null for the template default configuration', () => {
    const projectRoot = createProject({
      favicon: { ...FAVICON_DEFAULT_PATHS, appleTouchIcon: '/apple-touch-icon.png' }
    });

    expect(resolveFaviconProbePlan(projectRoot)).toBeNull();
  });

  it('returns null when every favicon field is null', () => {
    const projectRoot = createProject({
      favicon: {
        svg: null,
        png: null,
        appleTouchIcon: null,
        source: null,
        ico: null,
        manifest: null
      }
    });

    expect(resolveFaviconProbePlan(projectRoot)).toBeNull();
  });

  it('removes the default svg and replaces png targets for a custom png', () => {
    const projectRoot = createProject({
      favicon: { svg: FAVICON_DEFAULT_PATHS.svg, png: '/brand/icon.png', appleTouchIcon: null },
      publicFiles: { ...defaultPublicFiles(), 'brand/icon.png': Buffer.from('custom-png') }
    });

    expect(resolveFaviconProbePlan(projectRoot)).toEqual({
      '/favicon.svg': { remove: true },
      '/favicon-32x32.png': { type: 'image/png', generated: 'favicon-32x32.png' },
      '/apple-touch-icon.png': { type: 'image/png', generated: 'apple-touch-icon.png' }
    });
  });

  it('serves a custom svg from its absolute public path', () => {
    const projectRoot = createProject({
      favicon: { svg: '/brand/icon.svg', png: FAVICON_DEFAULT_PATHS.png },
      publicFiles: {
        ...defaultPublicFiles(),
        'brand/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" />'
      }
    });

    expect(resolveFaviconProbePlan(projectRoot)).toEqual({
      '/favicon.svg': {
        type: 'image/svg+xml',
        source: path.join(projectRoot, 'public', 'brand', 'icon.svg')
      },
      '/favicon-32x32.png': { type: 'image/png', generated: 'favicon-32x32.png' },
      '/apple-touch-icon.png': { type: 'image/png', generated: 'apple-touch-icon.png' }
    });
  });

  it('returns null when the configured custom files do not exist', () => {
    const projectRoot = createProject({
      favicon: { svg: '/brand/missing.svg', png: '/brand/missing.png' }
    });

    expect(resolveFaviconProbePlan(projectRoot)).toBeNull();
  });
});

describe('shouldWriteRootIco', () => {
  const baseState = {
    currentHash: 'current',
    generatedHash: 'generated',
    previousMarker: null as { rootIco?: boolean; rootIcoHash?: string } | null,
    sourceIsDefault: true
  };

  it('writes when the root ico is missing', () => {
    expect(shouldWriteRootIco({ ...baseState, currentHash: null })).toBe(true);
  });

  it('writes when the current ico already matches the generated one', () => {
    expect(shouldWriteRootIco({ ...baseState, currentHash: 'generated' })).toBe(true);
  });

  it('writes when the previous marker proves the ico is generated', () => {
    expect(
      shouldWriteRootIco({
        ...baseState,
        previousMarker: { rootIco: true, rootIcoHash: 'current' }
      })
    ).toBe(true);
  });

  it('writes when the source image is not the template default', () => {
    expect(shouldWriteRootIco({ ...baseState, sourceIsDefault: false })).toBe(true);
  });

  it('keeps a user-replaced ico when none of the write conditions hold', () => {
    expect(
      shouldWriteRootIco({
        ...baseState,
        previousMarker: { rootIco: true, rootIcoHash: 'other' }
      })
    ).toBe(false);
  });
});

describe('applyFaviconProbePlanToDist', () => {
  it('removes the default svg and copies generated png bytes into dist', () => {
    const projectRoot = createProject({
      favicon: { svg: null, png: '/brand/icon.png', appleTouchIcon: null },
      publicFiles: { 'brand/icon.png': Buffer.from('custom-png') }
    });
    const plan = resolvePlan(projectRoot);
    const distDirectory = createDist(projectRoot, {
      'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg" />',
      'favicon-32x32.png': 'default-png-32',
      'apple-touch-icon.png': 'default-apple-touch-icon',
      [path.join('images', 'site', 'generated', 'favicon-32x32.png')]: 'generated-png-32',
      [path.join('images', 'site', 'generated', 'apple-touch-icon.png')]:
        'generated-apple-touch-icon'
    });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    applyFaviconProbePlanToDist(plan, distDirectory);

    expect(existsSync(path.join(distDirectory, 'favicon.svg'))).toBe(false);
    expect(readFileSync(path.join(distDirectory, 'favicon-32x32.png'), 'utf8')).toBe(
      'generated-png-32'
    );
    expect(readFileSync(path.join(distDirectory, 'apple-touch-icon.png'), 'utf8')).toBe(
      'generated-apple-touch-icon'
    );
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('deletes the default targets when the generated files are missing', () => {
    const projectRoot = createProject({
      favicon: { svg: null, png: '/brand/icon.png', appleTouchIcon: null },
      publicFiles: { 'brand/icon.png': Buffer.from('custom-png') }
    });
    const plan = resolvePlan(projectRoot);
    const distDirectory = createDist(projectRoot, {
      'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg" />',
      'favicon-32x32.png': 'default-png-32',
      'apple-touch-icon.png': 'default-apple-touch-icon'
    });
    vi.spyOn(console, 'info').mockImplementation(() => {});

    applyFaviconProbePlanToDist(plan, distDirectory);

    expect(existsSync(path.join(distDirectory, 'favicon.svg'))).toBe(false);
    expect(existsSync(path.join(distDirectory, 'favicon-32x32.png'))).toBe(false);
    expect(existsSync(path.join(distDirectory, 'apple-touch-icon.png'))).toBe(false);
  });
});
