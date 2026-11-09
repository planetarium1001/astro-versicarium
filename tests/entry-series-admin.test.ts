import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readModuleDir } from './module-source-reader';
import {
  DEFAULT_ENTRY_SERIES_MODE,
  DEFAULT_ENTRY_SERIES_ORDER
} from '../src/lib/entry-display';

/**
 * 静态契约：后台「条目系列」设置的分组结构、预览钩子与整条设置链路。
 *
 * 行为断言在 `theme-settings.test.ts`（读取与回退）、`admin-console-shared.test.ts`
 * （规范化 / 校验 / 往返）与 `entry-series-display.test.ts`（公开端排版）里；
 * 这里守的是「少一处就会丢默认值或保存失败」的接线：分组、两组预览、两处 change 监听，
 * 以及 types → ui.json → canonicalize/validate/compatibility → form-codec 的完整链路。
 */

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

const ADMIN_UI_SECTION = 'src/components/admin/AdminUiSection.astro';

describe('后台：条目系列分组与预览', () => {
  it('「条目系列」分组紧跟「条目版本」，四档与顺序开关都用常量选项表', async () => {
    const uiSection = await read(ADMIN_UI_SECTION);

    expect(uiSection).toContain('id="ui-entry-series-mode"');
    expect(uiSection).toContain('id="ui-entry-series-order"');
    expect(uiSection).toContain('ENTRY_SERIES_MODE_OPTIONS');
    expect(uiSection).toContain('ENTRY_SERIES_ORDER_OPTIONS');
    expect(uiSection).toContain('条目系列');
    expect(uiSection).toContain('Entry series');

    // 位置固定：条目版本 → 条目系列 → 代码显示。
    const versionIndex = uiSection.indexOf('条目版本');
    const seriesIndex = uiSection.indexOf('条目系列');
    const codeIndex = uiSection.indexOf('代码显示');
    expect(versionIndex).toBeGreaterThan(-1);
    expect(seriesIndex).toBeGreaterThan(versionIndex);
    expect(codeIndex).toBeGreaterThan(seriesIndex);
  });

  it('说明文案讲清「系列与版本无关，序号是阅读次序」', async () => {
    const uiSection = await read(ADMIN_UI_SECTION);

    expect(uiSection).toContain('与版本无关');
    expect(uiSection).toContain('阅读序号');
    expect(uiSection).toContain('不是版本号');
  });

  it('列表与归档两种面都预渲染「档位 × 序号」的全部组合', async () => {
    const uiSection = await read(ADMIN_UI_SECTION);

    // 钩子命名与条目版本预览同构，`data-entry-series-preview` 是刷新入口。
    expect(uiSection).toContain('data-entry-series-preview');
    expect(uiSection).toContain('data-entry-series-preview-variant={variant.mode}');
    expect(uiSection).toContain('data-entry-series-order={variant.order}');
    // 组合态：两个下拉各占一半，预览必须同时按档位与序号开关切换。
    expect(uiSection).toContain('ENTRY_SERIES_MODE_OPTIONS.flatMap');
    expect(uiSection).toContain('ENTRY_SERIES_ORDER_OPTIONS.map');
    // 两种 surface 用真实档位：列表带分类胶囊，归档不带。
    expect(uiSection).toContain('surface="list"');
    expect(uiSection).toContain('surface="archive"');
    // 预览按显式档位渲染，不读当前站点设置（照抄条目版本预览的做法）。
    expect(uiSection).toContain('seriesMode={variant.mode}');
    expect(uiSection).toContain('seriesOrderMode={variant.order}');
  });
});

describe('后台：条目系列设置链路', () => {
  it('types / ui.json / theme-shared / form-codec 都带这两个字段', async () => {
    const [settings, shared, composer] = await Promise.all([
      read('src/lib/theme-settings.ts'),
      readModuleDir(process.cwd(), 'src/lib/admin-console/theme-shared'),
      readModuleDir(process.cwd(), 'src/scripts/admin-console/form-codec')
    ]);

    for (const field of ['entrySeriesMode', 'entrySeriesOrder']) {
      expect(settings).toContain(field);
      expect(shared).toContain(field);
      expect(composer).toContain(field);
    }

    // 规范化与校验都必须用 entry-display 的白名单，不在设置层另写一份枚举。
    expect(shared).toContain('normalizeEntrySeriesMode');
    expect(shared).toContain('normalizeEntrySeriesOrder');
    expect(shared).toContain('isEntrySeriesMode');
    expect(shared).toContain('isEntrySeriesOrder');
  });

  it('前端控件、监听与报错定位都接上新下拉框', async () => {
    const [controls, bindings, validation, wiring] = await Promise.all([
      read('src/scripts/admin-console/controls.ts'),
      read('src/scripts/admin-console/bindings.ts'),
      read('src/scripts/admin-console/validation.ts'),
      read('src/scripts/admin-console/index.ts')
    ]);

    expect(controls).toContain("byId<HTMLSelectElement>('ui-entry-series-mode')");
    expect(controls).toContain("byId<HTMLSelectElement>('ui-entry-series-order')");
    expect(bindings).toContain('inputEntrySeriesMode.addEventListener');
    expect(bindings).toContain('inputEntrySeriesOrder.addEventListener');
    expect(bindings).toContain('refreshEntrySeriesPreview');
    // 非法值要能定位到具体下拉框，而不是只报 ui 级错误。
    expect(validation).toContain("path === 'ui.entrySeriesMode'");
    expect(validation).toContain("path === 'ui.entrySeriesOrder'");
    expect(wiring).toContain('inputEntrySeriesMode');
    expect(wiring).toContain('inputEntrySeriesOrder');
  });

  it('预览刷新同时比对档位与序号开关', async () => {
    const composer = await readModuleDir(process.cwd(), 'src/scripts/admin-console/form-codec');

    expect(composer).toContain('refreshEntrySeriesPreview');
    expect(composer).toContain("preview.dataset.seriesMode = mode");
    expect(composer).toContain("preview.dataset.seriesOrder = order");
    expect(composer).toContain('variant.dataset.entrySeriesOrder');
  });

  it('预览还原真实颜色与字号，不再继承帮助文本的淡色', async () => {
    const css = await read('src/styles/components/admin/theme/form.css');

    // 预览挂在 `.admin-help` 里，继承的 `--faint` 与 12px 会让整行发灰、相对字号缩水
    expect(css).toMatch(
      /\.admin-entry-version-preview \.entry-title\s*\{[^}]*color:\s*var\(--text\)/
    );
    expect(css).toMatch(
      /\.admin-entry-version-preview \.entry-title\s*\{[^}]*font-size:\s*18px/
    );
    expect(css).toMatch(
      /\.admin-entry-version-preview \.entry-title--archive\s*\{[^}]*font-size:\s*15px/
    );
    // 胶囊回到真实高度，预览里的比例才与公开页一致
    expect(css).toMatch(
      /\.admin-entry-version-preview \.entry-title \.muted-pill\s*\{[^}]*height:\s*var\(--entry-pill-height\)/
    );
  });

  it('归档预览不重复渲染 meta 档文案：标题行已经产出过系列段', async () => {
    const uiSection = await read(ADMIN_UI_SECTION);
    // 「条目版本」分组里也有「预览（归档）」，先定位到系列预览再取归档那一段。
    const seriesPreviewStart = uiSection.indexOf('data-entry-series-preview');
    const archiveStart = uiSection.indexOf('预览（归档）', seriesPreviewStart);
    const archiveBlock = uiSection.slice(archiveStart, uiSection.indexOf('</fieldset>', archiveStart));

    // 归档没有元信息行，`meta` 档由标题段渲成标题后的小字；
    // 预览若再补一段「系列名 2/5」，作者会看到重复文案。
    expect(archiveBlock).toContain('surface="archive"');
    expect(archiveBlock).not.toContain('entry-title__series-name');
    expect(archiveBlock).not.toContain('archive-timeline__series');
  });

  it('ui.json 写入与常量一致的默认值', async () => {
    const uiJson = JSON.parse(await read('src/data/settings/ui.json')) as Record<string, unknown>;

    expect(uiJson.entrySeriesMode).toBe(DEFAULT_ENTRY_SERIES_MODE);
    expect(uiJson.entrySeriesOrder).toBe(DEFAULT_ENTRY_SERIES_ORDER);
  });
});
