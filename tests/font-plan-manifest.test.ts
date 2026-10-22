import { describe, expect, it } from 'vitest';

import {
  buildFacesFromResult,
  buildFontPlan,
  groupFacesByWeight,
  resolveSource
} from '../scripts/font/plan.mjs';
import { buildFontCss, parseCssFontFaces } from '../scripts/font/css.mjs';
import {
  buildManifest,
  estimateDefaultBudget,
  isFullyCovered,
  serializeManifest
} from '../scripts/font/manifest.mjs';
import { findFaceOverlaps } from '../scripts/font/unicode-ranges.mjs';

const SHA = 'a'.repeat(64);

const FONT_SOURCES = {
  fonts: {
    'noto-serif-sc': {
      family: 'Noto Serif SC',
      license: 'OFL-1.1',
      version: 'test',
      files: [{ path: 'NotoSerifSC-VF.ttf', sha256: SHA, variable: true, weights: [400, 600] }]
    },
    'lxgw-wenkai-lite': {
      family: 'LXGW WenKai Lite',
      license: 'OFL-1.1',
      version: 'test',
      files: [{ path: 'LXGWWenKaiLite-Regular.ttf', sha256: SHA, weights: [400] }]
    },
    'noto-sans-sc': {
      family: 'Noto Sans SC',
      license: 'OFL-1.1',
      version: 'test',
      files: [{ path: 'NotoSansSC-VF.ttf', sha256: SHA, variable: true, weights: [400] }]
    }
  }
};

const ROLE_CHARSETS = {
  text: '正文一二三的一是标题',
  display: '标题一的',
  meta: '元信息一',
  brand: '品牌一'
};

const buildPlan = () =>
  buildFontPlan({
    fontSources: FONT_SOURCES,
    roleCharsets: ROLE_CHARSETS,
    charsetCommon: '正文一二三的一是标题A',
    prior: new Map([
      ['的', 0],
      ['一', 1],
      ['是', 2]
    ])
  });

describe('font/plan', () => {
  it('resolves variable source files and instantiates per weight', () => {
    const source = resolveSource(FONT_SOURCES, 'noto-serif-sc', 600);
    expect(source.relativePath).toBe('NotoSerifSC-VF.ttf');
    expect(source.axes).toEqual({ wght: 600 });
    const staticSource = resolveSource(FONT_SOURCES, 'lxgw-wenkai-lite', 400);
    expect(staticSource.axes).toBeNull();
    expect(() => resolveSource({ fonts: {} }, 'noto-serif-sc', 400)).toThrow(/font-sources/);
  });

  it('plans text/meta/display series with meta chars removed from text', () => {
    const plan = buildPlan();
    expect(plan.cjkRanges.length).toBeGreaterThan(0);
    // latin face 只覆盖实际用到的字符（不是整段 LATIN_RANGES），并接管 charsetCommon 里的 ASCII。
    for (const group of plan.latin) {
      expect(group.chars).toContain('A'.codePointAt(0)!);
      expect(group.chars.length).toBeLessThan(200);
      for (const codePoint of group.chars) {
        const inLatin = codePoint <= 0x024f || (codePoint >= 0x2000 && codePoint <= 0x206f) ||
          (codePoint >= 0x3000 && codePoint <= 0x303f) || (codePoint >= 0xff00 && codePoint <= 0xffef);
        expect(inLatin, `U+${codePoint.toString(16)} 不在 latin 范围`).toBe(true);
      }
    }
    expect(plan.sources).toHaveLength(4);
    expect(plan.series).toHaveLength(6);
    expect(plan.latin).toHaveLength(4);
    expect(plan.dlc).toHaveLength(4);

    const lxgwMeta = plan.series.find((entry) => entry.key === 'lxgw-wenkai-lite@400:meta');
    const lxgwText = plan.series.find((entry) => entry.key === 'lxgw-wenkai-lite@400:text');
    expect(lxgwMeta).toBeTruthy();
    expect(lxgwText).toBeTruthy();
    const textChars = new Set(lxgwText!.chars);
    for (const ch of '元信息') expect(textChars.has(ch.codePointAt(0)!)).toBe(false);

    const serifDisplay = plan.series.find((entry) => entry.key === 'noto-serif-sc@600:display');
    expect(serifDisplay?.partitions.map((partition: { tier: string }) => partition.tier)).toEqual(['display']);
    // display 组末尾补了 top-N 频率先验，至少包含先验字符。
    expect(serifDisplay!.chars).toContain('的'.codePointAt(0)!);

    const serifText = plan.series.find((entry) => entry.key === 'noto-serif-sc@400:text');
    // latin face 独占 ASCII/标点范围：CJK 角色面不得包含 'A'。
    expect(serifText!.chars).not.toContain('A'.codePointAt(0)!);
    expect(serifText?.partitions.map((partition: { tier: string }) => partition.tier)).toEqual([
      'core',
      'mid'
    ]);
    // core 是 single-fit，mid 是 split。
    expect(serifText!.partitions[0]!.mode).toBe('single-fit');
    expect(serifText!.partitions[1]!.mode).toBe('split');

    const dlc = plan.dlc.find((entry) => entry.key === 'noto-serif-sc@600:dlc');
    expect(dlc?.namePrefix).toBe('noto-serif-sc-600-dlc');
    expect(dlc?.outDir).toBe('public/fonts/dlc');
  });

  it('converts font_ops results into manifest faces with exact ranges', () => {
    const plan = buildPlan();
    let nextRangeStart = 0x5000;
    const nextRanges = () => {
      const start = nextRangeStart;
      nextRangeStart += 0x100;
      return [[start, start + 0x3f]];
    };
    const chunk = (name: string, bytes: number, ranges: number[][]) => ({
      name,
      path: `public/fonts/base/${name}`,
      bytes,
      sha256: SHA,
      hash8: 'abcdef12',
      cmapCount: ranges.reduce((total, range) => total + range[1]! - range[0]! + 1, 0),
      ranges
    });
    const result = {
      sources: {
        'noto-serif-sc@400': { cmapCount: 10, cmapRanges: [[0x4e00, 0x4e10]] },
        'noto-serif-sc@600': { cmapCount: 10, cmapRanges: [[0x4e00, 0x4e10]] },
        'lxgw-wenkai-lite@400': { cmapCount: 10, cmapRanges: [[0x4e00, 0x4e10]] },
        'noto-sans-sc@400': { cmapCount: 10, cmapRanges: [[0x4e00, 0x4e10]] }
      },
      series: plan.series.map((entry) => ({
        key: entry.key,
        requestedCount: entry.chars.length,
        coveredCount: entry.chars.length,
        uncoveredCount: 0,
        partitions: entry.partitions.map((partition, index) => ({
          tier: partition.tier,
          mode: partition.mode,
          charsCount: 1,
          chunks: [chunk(`${entry.namePrefix}-${partition.tier}-0${index + 1}.abcdef12.woff2`, 1000, nextRanges())]
        }))
      })),
      latin: plan.latin.map((entry) => ({
        key: entry.key,
        chunks: [chunk(`${entry.namePrefix}-latin-01.abcdef12.woff2`, 500, nextRanges())]
      })),
      dlc: plan.dlc.map((entry) => ({
        key: entry.key,
        sourceCmapCjkCount: 10,
        baseCoveredCjkCount: 3,
        dlcCoveredCjkCount: 7,
        uncoveredCount: 0,
        chunks: [chunk(`${entry.namePrefix}-dlc-01.abcdef12.woff2`, 2000, nextRanges())]
      }))
    };
    const faces = buildFacesFromResult(plan, result);
    expect(faces.length).toBeGreaterThan(0);
    const baseFace = faces.find((face) => face.fontId === 'noto-serif-sc' && face.weight === 400 && !face.dlc);
    expect(baseFace?.file).toMatch(/^\/fonts\/base\/noto-serif-sc-400-text-core-01\.abcdef12\.woff2$/);
    expect(baseFace?.unicodeRange).toMatch(/^U\+5[0-9A-F]{3}-5[0-9A-F]{3}$/);
    const dlcFace = faces.find((face) => face.dlc);
    expect(dlcFace?.file).toMatch(/^\/fonts\/dlc\//);
    expect(dlcFace?.role).toBe('dlc');
    expect(dlcFace?.tier).toBe('dlc');
    expect(groupFacesByWeight(faces).size).toBe(4);

    // 合成数据下每个 family/weight 的 base 与 DLC 范围必须互斥。
    for (const [, weightFaces] of groupFacesByWeight(faces)) {
      expect(findFaceOverlaps(weightFaces)).toEqual([]);
    }
  });
});

describe('font/manifest + css', () => {
  const faces = [
    {
      id: 'noto-serif-sc-400-text-core-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 400,
      role: 'text',
      tier: 'core',
      dlc: false,
      file: '/fonts/base/core.abcdef12.woff2',
      filePath: 'public/fonts/base/core.abcdef12.woff2',
      bytes: 100,
      sha256: SHA,
      hash8: 'abcdef12',
      unicodeRange: 'U+4E00-4E10',
      ranges: [[0x4e00, 0x4e10]]
    },
    {
      id: 'noto-serif-sc-400-text-mid-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 400,
      role: 'text',
      tier: 'mid',
      dlc: false,
      file: '/fonts/base/mid.abcdef12.woff2',
      filePath: 'public/fonts/base/mid.abcdef12.woff2',
      bytes: 60,
      sha256: SHA,
      hash8: 'abcdef12',
      unicodeRange: 'U+4E11-4E20',
      ranges: [[0x4e11, 0x4e20]]
    },
    {
      id: 'noto-serif-sc-600-display-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 600,
      role: 'display',
      tier: 'display',
      dlc: false,
      file: '/fonts/base/display.abcdef12.woff2',
      filePath: 'public/fonts/base/display.abcdef12.woff2',
      bytes: 70,
      sha256: SHA,
      hash8: 'abcdef12',
      unicodeRange: 'U+4E00-4E10',
      ranges: [[0x4e00, 0x4e10]]
    },
    {
      id: 'noto-serif-sc-400-latin-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 400,
      role: 'latin',
      tier: 'latin',
      dlc: false,
      file: '/fonts/base/latin.abcdef12.woff2',
      filePath: 'public/fonts/base/latin.abcdef12.woff2',
      bytes: 40,
      sha256: SHA,
      hash8: 'abcdef12',
      unicodeRange: 'U+0020-007E',
      ranges: [[0x20, 0x7e]]
    },
    {
      id: 'lxgw-wenkai-lite-400-meta-01.abcdef12',
      fontId: 'lxgw-wenkai-lite',
      family: 'LXGW WenKai Lite',
      weight: 400,
      role: 'meta',
      tier: 'meta',
      dlc: false,
      file: '/fonts/base/meta.abcdef12.woff2',
      filePath: 'public/fonts/base/meta.abcdef12.woff2',
      bytes: 30,
      sha256: SHA,
      hash8: 'abcdef12',
      unicodeRange: 'U+4E00-4E10',
      ranges: [[0x4e00, 0x4e10]]
    },
    {
      id: 'noto-serif-sc-400-dlc-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 400,
      role: 'dlc',
      tier: 'dlc',
      dlc: true,
      file: '/fonts/dlc/dlc.abcdef12.woff2',
      filePath: 'public/fonts/dlc/dlc.abcdef12.woff2',
      bytes: 200,
      sha256: SHA,
      hash8: 'abcdef12',
      unicodeRange: 'U+4E11-4E20',
      ranges: [[0x4e11, 0x4e20]]
    }
  ];

  const plan = { sources: [] };
  const result = { sources: {} };
  const manifest = buildManifest({
    faces,
    plan,
    result,
    generatedAt: '2026-10-21T00:00:00.000Z',
    inputs: { charsetCommon: 'x', pipelineConfig: 'y' }
  });

  it('computes summary and default page budget from actual faces', () => {
    expect(manifest.summary.baseBytes).toBe(100 + 60 + 70 + 40 + 30);
    expect(manifest.summary.dlcBytes).toBe(200);
    expect(manifest.summary.byTier.core!.bytes).toBe(100);
    // 常用页 = core(100) + mid(60) + serif latin(40) + display(70) + wenkai meta(30)；serif 600 latin 缺失按 0。
    expect(manifest.summary.estimate.commonPageBytes).toBe(100 + 60 + 40 + 70 + 30);
    expect(manifest.summary.estimate.maxDlcChunkBytes).toBe(200);
    expect(estimateDefaultBudget([]).commonPageBytes).toBe(0);
  });

  it('generates base/DLC CSS that round-trips to manifest faces', () => {
    const { baseCss, dlcCss } = buildFontCss(manifest);
    expect(baseCss).toContain('@font-face');
    expect(baseCss).toContain('/fonts/base/core.abcdef12.woff2');
    expect(baseCss).not.toContain('/fonts/dlc/');
    expect(dlcCss).toContain('/fonts/dlc/dlc.abcdef12.woff2');
    expect(dlcCss).not.toContain('/fonts/base/');
    const parsedBase = parseCssFontFaces(baseCss);
    const parsedDlc = parseCssFontFaces(dlcCss);
    expect(parsedBase).toHaveLength(5);
    expect(parsedDlc).toHaveLength(1);
    expect(parsedBase.find((face) => face.src.endsWith('display.abcdef12.woff2'))!).toEqual({
      family: 'Noto Serif SC',
      src: '/fonts/base/display.abcdef12.woff2',
      weight: 600,
      unicodeRange: 'U+4E00-4E10'
    });
    // DLC CSS 里不允许出现 .notdef/空范围。
    expect(parsedDlc.every((face) => face.unicodeRange.length > 0)).toBe(true);
  });

  it('serializes deterministically and checks coverage helper', () => {
    const first = serializeManifest(manifest);
    const second = serializeManifest({ ...manifest, faces: [...manifest.faces].reverse() });
    expect(first).toBe(second);
    expect(first.endsWith('\n')).toBe(true);
    expect(isFullyCovered([0x4e05], [[0x4e00, 0x4e10]])).toBe(true);
    expect(isFullyCovered([0x4e11], [[0x4e00, 0x4e10]])).toBe(false);
  });
});
