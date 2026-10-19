import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

describe('后台：条目版本名称唯一选项', () => {
  it('界面只保留一个版本名称 select，字段组合器已删除', async () => {
    const [uiSection, themeConsole, composer, section, css] = await Promise.all([
      read('src/components/admin/AdminUiSection.astro'),
      read('src/components/admin/AdminThemeDevConsole.astro'),
      read('src/scripts/admin-console/form-codec.ts'),
      read('src/lib/entry-display.ts'),
      read('src/styles/components/admin/theme/index.css')
    ]);

    expect(uiSection).toContain('id="ui-entry-version-name"');
    expect(uiSection).toContain('ENTRY_VERSION_NAME_MODE_OPTIONS');
    expect(themeConsole).not.toContain('AdminEntryFormatSection');
    expect(composer).toContain('inputEntryVersionName');
    expect(composer).not.toContain('entryFormat');
    expect(section).toContain("'before-label'");
    expect(section).toContain("'after-label'");
    expect(css).not.toContain('entry-format.css');
  });

  it('下拉框用字段组合标签，并在下方渲染三档实时预览', async () => {
    const [uiSection, section, composer, bindings, css] = await Promise.all([
      read('src/components/admin/AdminUiSection.astro'),
      read('src/lib/entry-display.ts'),
      read('src/scripts/admin-console/form-codec.ts'),
      read('src/scripts/admin-console/bindings.ts'),
      read('src/styles/components/admin/theme/form.css')
    ]);

    // 选项标签是结构组合，而不是“标题后（冒号 + 版本名称）”这类描述
    expect(section).toContain("'分类 · 标题 · 版本号'");
    expect(section).toContain("'分类 · 标题 : 版本名称 · 版本号'");
    expect(section).toContain("'分类 · 标题 · 版本号 · 版本名称'");
    expect(section).not.toContain('不显示版本名称');
    expect(section).not.toContain('标题后（冒号 + 版本名称）');

    // 下拉框下方有三档真实条目预览，使用公开条目组件与显式模式
    expect(uiSection).toContain('data-entry-version-preview');
    expect(uiSection).toContain('data-entry-version-preview-variant={option.id}');
    expect(uiSection).toContain('versionNameMode={option.id}');
    expect(uiSection).toContain('Whono Astro 主题');
    // 预览只用主题自身做示例，避免引入第三方项目
    expect(uiSection).not.toContain('NixOS 发布看板');

    expect(composer).toContain('refreshEntryVersionPreview');
    expect(composer).toContain("preview.dataset.mode = mode");
    expect(bindings).toContain('inputEntryVersionName.addEventListener');
    expect(css).toContain('.admin-entry-version-preview');
  });

  it('旧组合器的文件已删除，演示设置不再写 entryFormat', async () => {
    const { access } = await import('node:fs/promises');
    const missing = [
      'src/lib/entry-format.ts',
      'src/components/EntryFormatLine.astro',
      'src/components/admin/AdminEntryFormatSection.astro',
      'src/scripts/admin-console/entry-format-composer.ts',
      'src/styles/components/admin/theme/entry-format.css'
    ];
    for (const file of missing) {
      await expect(access(path.join(process.cwd(), file))).rejects.toThrow();
    }

    const uiJson = JSON.parse(await read('src/data/settings/ui.json')) as Record<string, unknown>;
    expect(uiJson).not.toHaveProperty('entryFormat');
  });

  it('设置链路从类型到表单 codec 都使用 entryVersionName', async () => {
    const [settings, shared, controls, validation] = await Promise.all([
      read('src/lib/theme-settings.ts'),
      read('src/lib/admin-console/theme-shared.ts'),
      read('src/scripts/admin-console/controls.ts'),
      read('src/scripts/admin-console/validation.ts')
    ]);

    for (const source of [settings, shared, controls, validation]) {
      expect(source).toMatch(/entryVersionName|inputEntryVersionName/);
    }
    // 旧键只在 theme-shared 的兼容迁移里出现一次，用于读取时忽略并让保存自然清掉。
    expect(shared).toContain('_removedEntryFormat');
    for (const source of [settings, controls, validation]) {
      expect(source).not.toContain('entryFormat');
    }
  });
});
