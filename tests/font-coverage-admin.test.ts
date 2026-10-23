import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatFontBudgetBytes,
  getFontBudgetSummary,
  getFontCardBudget,
  getFontCoverageCopy,
  normalizeFontManifest,
  type FontManifest
} from '../src/lib/fonts/budget';
import { THEME_TYPOGRAPHY_DEFAULT } from '../src/lib/fonts/registry';

const KB = 1024;

/* schemaVersion 2：顶层 families[] + faces[]，face 以 fontId 归属字体（id 是分片文件名）。 */
const MANIFEST: FontManifest = normalizeFontManifest({
  schemaVersion: 2,
  generatedAt: '2026-10-21T00:00:00.000Z',
  families: [{ id: 'noto-serif-sc' }, { id: 'lxgw-wenkai-lite' }],
  faces: [
    {
      id: 'noto-serif-sc-400-text-core-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 400,
      role: 'text',
      tier: 'core',
      file: '/fonts/base/noto-serif-sc-400-text-core-01.abcdef12.woff2',
      bytes: 190 * KB,
      unicodeRange: 'U+4E00-4E5F',
      dlc: false
    },
    {
      id: 'noto-serif-sc-600-display-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 600,
      role: 'display',
      tier: 'display',
      file: '/fonts/base/noto-serif-sc-600-display-01.abcdef12.woff2',
      bytes: 90 * KB,
      unicodeRange: 'U+4E00-4E5F',
      dlc: false
    },
    {
      id: 'noto-serif-sc-400-latin-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 400,
      role: 'latin',
      tier: 'latin',
      file: '/fonts/base/noto-serif-sc-400-latin-01.abcdef12.woff2',
      bytes: 12 * KB,
      unicodeRange: 'U+0020-007E',
      dlc: false
    },
    {
      id: 'lxgw-wenkai-lite-400-meta-01.abcdef12',
      fontId: 'lxgw-wenkai-lite',
      family: 'LXGW WenKai Lite',
      weight: 400,
      role: 'meta',
      tier: 'meta',
      file: '/fonts/base/lxgw-wenkai-lite-400-meta-01.abcdef12.woff2',
      bytes: 34 * KB,
      unicodeRange: 'U+4E00-4E5F',
      dlc: false
    },
    {
      id: 'noto-serif-sc-400-dlc-01.abcdef12',
      fontId: 'noto-serif-sc',
      family: 'Noto Serif SC',
      weight: 400,
      role: 'dlc',
      tier: 'dlc',
      file: '/fonts/dlc/noto-serif-sc-400-dlc-01.abcdef12.woff2',
      bytes: 200 * KB,
      unicodeRange: 'U+9FA6-9FFF',
      dlc: true
    }
  ],
  summary: {
    baseBytes: 326 * KB,
    dlcBytes: 8 * 1024 * KB,
    totalBytes: 9 * 1024 * KB,
    baseFaces: 4,
    dlcFaces: 1,
    byFont: {
      'noto-serif-sc': { baseBytes: 292 * KB, dlcBytes: 8 * 1024 * KB },
      'lxgw-wenkai-lite': { baseBytes: 34 * KB, dlcBytes: 0 }
    },
    byRole: {
      text: { baseBytes: 190 * KB, dlcBytes: 0 },
      display: { baseBytes: 90 * KB, dlcBytes: 0 },
      latin: { baseBytes: 12 * KB, dlcBytes: 0 },
      meta: { baseBytes: 34 * KB, dlcBytes: 0 },
      dlc: { baseBytes: 0, dlcBytes: 8 * 1024 * KB }
    },
    byTier: {
      core: { bytes: 190 * KB, faces: 1 },
      display: { bytes: 90 * KB, faces: 1 },
      latin: { bytes: 12 * KB, faces: 1 },
      meta: { bytes: 34 * KB, faces: 1 }
    },
    estimate: {
      commonPageBytes: 300 * KB,
      rarePageExtraBytes: 200 * KB,
      maxDlcChunkBytes: 200 * KB,
      averageDlcChunkBytes: 200 * KB
    }
  }
}) as FontManifest;

/* 旧设计稿 fonts[] 形态：face 的 id 就是字体注册表 id，没有 fontId；只用于证明 tolerant 兼容。 */
const LEGACY_MANIFEST: FontManifest = normalizeFontManifest({
  generatedAt: '2026-10-20T00:00:00.000Z',
  fonts: [
    { id: 'noto-serif-sc', role: 'text', tier: 'core', bytes: 190 * KB, dlc: false },
    { id: 'noto-serif-sc', role: 'display', tier: 'display', bytes: 90 * KB, dlc: false },
    { id: 'lxgw-wenkai-lite', role: 'meta', tier: 'meta', bytes: 34 * KB, dlc: false },
    { id: 'noto-serif-sc', role: 'dlc', tier: 'dlc', bytes: 200 * KB, dlc: true }
  ],
  summary: {
    baseBytesByFont: { 'noto-serif-sc': 280 * KB, 'lxgw-wenkai-lite': 34 * KB },
    dlcBytesByFont: { 'noto-serif-sc': 8 * 1024 * KB }
  }
}) as FontManifest;

describe('fonts/budget：字体预算 helper', () => {
  it('清单缺失时回退静态估算，后台不会因未跑 font:build 而崩溃', () => {
    const summary = getFontBudgetSummary(THEME_TYPOGRAPHY_DEFAULT, 'full', null);

    expect(summary.source).toBe('static-fallback');
    expect(summary.selectedFontIds).toEqual(['noto-serif-sc', 'lxgw-wenkai-lite']);
    expect(summary.commonPageBytes).toBeGreaterThan(0);
    expect(summary.baseBytes).toBeGreaterThan(0);
    expect(summary.dlcBytes).toBeGreaterThan(0);
    // PRD 的完整覆盖增量预期约 15–20 MB，静态回退保持在同量级。
    expect(summary.buildTotalBytes).toBeGreaterThan(15 * 1024 * KB);
    expect(summary.rarePageIncrementBytes).toBeGreaterThan(0);
  });

  it('常用覆盖不产生 DLC 增量，并提示回退系统字体', () => {
    const summary = getFontBudgetSummary(THEME_TYPOGRAPHY_DEFAULT, 'common', null);
    const copy = getFontCoverageCopy(summary);

    expect(summary.rarePageIncrementBytes).toBe(0);
    expect(copy.coverage).toBe('common');
    expect(copy.detailLine).toContain('回退系统字体');
    expect(copy.detailLine).toContain('不加载 DLC');
    expect(copy.buildLine).toContain('页面按需下载');
  });

  it('有 v2 清单时优先读 summary.byFont / summary.estimate', () => {
    const full = getFontBudgetSummary(THEME_TYPOGRAPHY_DEFAULT, 'full', MANIFEST);
    const common = getFontBudgetSummary(THEME_TYPOGRAPHY_DEFAULT, 'common', MANIFEST);

    expect(full.source).toBe('manifest');
    // byFont 决定 base/dlc 字节，estimate 决定默认配置下的首屏预算。
    expect(full.baseBytes).toBe(326 * KB);
    expect(full.dlcBytes).toBe(8 * 1024 * KB);
    expect(full.commonPageBytes).toBe(300 * KB);
    expect(full.rarePageIncrementBytes).toBe(200 * KB);
    expect(full.buildTotalBytes).toBe(9 * 1024 * KB);
    expect(common.rarePageIncrementBytes).toBe(0);

    const copy = getFontCoverageCopy(full);
    expect(copy.sourceNote).toBeNull();
    expect(copy.budgetLine).toContain('300 KB');
    expect(copy.detailLine).toContain('200 KB');
  });

  it('非默认 typography 不套用 estimate（estimate 只描述默认配置）', () => {
    const customTypography = { ...THEME_TYPOGRAPHY_DEFAULT, mono: 'jetbrains-mono' as const };
    const summary = getFontBudgetSummary(customTypography, 'full', MANIFEST);

    // mono 换成拉丁字体不影响 CJK 选择，首屏预算退回 byFont 合计而非默认 estimate。
    expect(summary.baseBytes).toBe(326 * KB);
    expect(summary.commonPageBytes).toBe(326 * KB);
  });

  it('兼容旧 fonts[] 清单形态（id 兼任 fontId）', () => {
    const summary = getFontBudgetSummary(THEME_TYPOGRAPHY_DEFAULT, 'full', LEGACY_MANIFEST);

    expect(summary.source).toBe('manifest');
    expect(summary.baseBytes).toBe(314 * KB);
    expect(summary.dlcBytes).toBe(8 * 1024 * KB);
    expect(summary.rarePageIncrementBytes).toBe(200 * KB);
    // 旧清单没有 estimate，commonPageBytes 退回 byFont/base 合计。
    expect(summary.commonPageBytes).toBe(314 * KB);
    expect(getFontCardBudget('readable', 'noto-serif-sc', LEGACY_MANIFEST).label).toBe('约 280 KB/基础分片');
  });

  it('字体卡片按角色给出分片合计徽章，非 CJK 字体标注不受覆盖策略影响', () => {
    // noto-serif readable = text 190 + display 90 + latin 12；按 fontId 过滤，chunk id 不参与匹配。
    expect(getFontCardBudget('readable', 'noto-serif-sc', MANIFEST).label).toBe('约 292 KB/基础分片');
    expect(getFontCardBudget('copy', 'lxgw-wenkai-lite', MANIFEST).label).toBe('约 34 KB/基础分片');
    // 清单只有 meta/latin face 时，文楷 readable 回退到静态估算（约 220 KB）。
    expect(getFontCardBudget('readable', 'lxgw-wenkai-lite', MANIFEST).label).toBe('约 220 KB/基础分片');
    expect(getFontCardBudget('copy', 'lxgw-wenkai-lite', null).label).toBe('约 32 KB/基础分片');

    const system = getFontCardBudget('mono', 'system-mono', MANIFEST);
    expect(system.appliesToCoverage).toBe(false);
    expect(system.label).toBe('零下载');

    const latin = getFontCardBudget('mono', 'jetbrains-mono', MANIFEST);
    expect(latin.appliesToCoverage).toBe(false);
    expect(latin.label).toContain('不受 CJK 覆盖策略影响');

    const cjk = getFontCardBudget('readable', 'noto-serif-sc', MANIFEST);
    expect(cjk.appliesToCoverage).toBe(true);
  });

  it('字节数格式化覆盖 KB / MB 两档', () => {
    expect(formatFontBudgetBytes(0)).toBe('0 KB');
    expect(formatFontBudgetBytes(32 * KB)).toBe('32 KB');
    expect(formatFontBudgetBytes(180 * KB)).toBe('180 KB');
    expect(formatFontBudgetBytes(1.5 * 1024 * KB)).toBe('1.5 MB');
  });
});

describe('后台：字体覆盖策略接线', () => {
  const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

  it('排版字体 fieldset 提供覆盖策略控件、预算摘要与基础分片徽章', async () => {
    const uiSection = await read('src/components/admin/AdminUiSection.astro');

    expect(uiSection).toContain('id="ui-font-coverage"');
    expect(uiSection).toContain('ADMIN_FONT_COVERAGE_OPTIONS');
    expect(uiSection).toContain('data-font-coverage-preview');
    expect(uiSection).toContain('data-font-coverage-preview-variant={coverage}');
    expect(uiSection).toContain('data-budget-source={fontBudgetSource}');
    expect(uiSection).toContain('getFontCardBudget(field.role, option.id, fontManifest)');
    expect(uiSection).toContain('getFontBudgetSummary(ui.typography, coverage, fontManifest)');
    expect(uiSection).toContain('admin-font-coverage__select');
    expect(uiSection).not.toContain('字体卡片徽章中的数字');
  });

  it('设置链路覆盖类型、默认值、表单读写、校验焦点与持久化', async () => {
    const [settings, shared, codec, validation, controls, index, bindings, uiJsonRaw] = await Promise.all([
      read('src/lib/theme-settings.ts'),
      read('src/lib/admin-console/theme-shared.ts'),
      read('src/scripts/admin-console/form-codec.ts'),
      read('src/scripts/admin-console/validation.ts'),
      read('src/scripts/admin-console/controls.ts'),
      read('src/scripts/admin-console/index.ts'),
      read('src/scripts/admin-console/bindings.ts'),
      read('src/data/settings/ui.json')
    ]);

    expect(settings).toContain("export type FontCoverage = 'full' | 'common'");
    expect(settings).toContain('fontCoverage: ADMIN_FONT_COVERAGE_DEFAULT');
    expect(settings).toContain('fontCoverage: fontCoverage.value');
    expect(settings).toContain('fontCoverage: fontCoverage.source');

    expect(shared).toContain("['full', 'common']");
    expect(shared).toContain("export const ADMIN_FONT_COVERAGE_DEFAULT: FontCoverage = 'full'");
    expect(shared).toContain('isAdminFontCoverage(ui.fontCoverage)');
    expect(shared).toContain("pushIssue('ui.fontCoverage'");

    expect(codec).toContain('inputFontCoverage: HTMLSelectElement');
    expect(codec).toContain('fontCoverage: getSelectedFontCoverage()');
    expect(codec).toContain('applyFontCoverage(settings.ui?.fontCoverage)');
    expect(codec).toContain('refreshFontCoveragePreview');
    expect(validation).toContain("path === 'ui.fontCoverage'");
    expect(validation).toContain("'#ui-font-coverage'");
    expect(controls).toContain("inputFontCoverage: byId<HTMLSelectElement>('ui-font-coverage')");
    expect(index).toContain('inputFontCoverage: controls.inputFontCoverage');
    expect(bindings).toContain('inputFontCoverage.addEventListener');
    expect(JSON.parse(uiJsonRaw).fontCoverage).toBe('full');
  });
});
