import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENTRY_VERSION_NAME_MODE,
  ENTRY_TITLE_COLON,
  buildEntryTitleSegments,
  isEntryVersionNameMode,
  normalizeEntryVersionNameMode
} from '../src/lib/entry-display';

const base = {
  badge: '指南',
  title: '内容流程',
  versionLabel: 'v2.0',
  versionName: '稳定版'
};

describe('entry-display：固定条目排版', () => {
  it('列表默认输出 分类胶囊 + 间隙 + 标题', () => {
    expect(buildEntryTitleSegments({ badge: '指南', title: '内容流程' }, 'list')).toEqual([
      { kind: 'badge', text: '指南' },
      { kind: 'gap' },
      { kind: 'title', text: '内容流程' }
    ]);
  });

  it('空分类回退为「随笔」', () => {
    expect(buildEntryTitleSegments({ title: '无分类' }, 'list')[0]).toEqual({
      kind: 'badge',
      text: '随笔'
    });
  });

  it('项目标题行可没有分类胶囊', () => {
    expect(buildEntryTitleSegments({ title: 'NixOS 发布看板' }, 'project')).toEqual([
      { kind: 'title', text: 'NixOS 发布看板' }
    ]);
  });

  it('hidden：标题 + 间隙 + 版本胶囊', () => {
    expect(buildEntryTitleSegments(base, 'list', 'hidden')).toEqual([
      { kind: 'badge', text: '指南' },
      { kind: 'gap' },
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'version-label', text: 'v2.0' }
    ]);
  });

  it('before-label：标题 + 英文冒号空格 + 版本名称 + 间隙 + 版本胶囊', () => {
    expect(buildEntryTitleSegments(base, 'archive', 'before-label')).toEqual([
      { kind: 'title', text: '内容流程' },
      { kind: 'colon' },
      { kind: 'version-name', text: '稳定版' },
      { kind: 'gap' },
      { kind: 'version-label', text: 'v2.0' }
    ]);
    expect(ENTRY_TITLE_COLON).toBe(': ');
  });

  it('after-label：标题 + 间隙 + 版本胶囊 + 间隙 + 版本名称', () => {
    expect(buildEntryTitleSegments(base, 'list', 'after-label').slice(3)).toEqual([
      { kind: 'gap' },
      { kind: 'version-label', text: 'v2.0' },
      { kind: 'gap' },
      { kind: 'version-name', text: '稳定版' }
    ]);
  });

  it('版本名称缺失时退化为只显示版本号，不产生孤立冒号', () => {
    expect(
      buildEntryTitleSegments({ title: '内容流程', versionLabel: 'v2.0' }, 'archive', 'before-label')
    ).toEqual([
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'version-label', text: 'v2.0' }
    ]);
    expect(
      buildEntryTitleSegments({ title: '内容流程', versionLabel: 'v2.0' }, 'archive', 'after-label')
    ).toEqual([
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'version-label', text: 'v2.0' }
    ]);
  });

  it('没有版本号时完全不输出版本段（普通单篇文章不显示日期）', () => {
    expect(buildEntryTitleSegments({ title: '普通文章' }, 'list', 'before-label')).toEqual([
      { kind: 'badge', text: '随笔' },
      { kind: 'gap' },
      { kind: 'title', text: '普通文章' }
    ]);
  });

  it('归档更新行使用 项目名: 标题，并忽略版本字段', () => {
    expect(
      buildEntryTitleSegments(
        { kind: 'devlog', project: 'NixOS 发布看板', title: '补齐版本历史', versionLabel: 'v9' },
        'archive',
        'after-label'
      )
    ).toEqual([
      { kind: 'project', text: 'NixOS 发布看板' },
      { kind: 'colon' },
      { kind: 'title', text: '补齐版本历史' }
    ]);
  });

  it('归档博客系列行显示版本段，非系列行只有标题', () => {
    expect(buildEntryTitleSegments({ kind: 'blog', ...base }, 'archive', 'hidden')).toEqual([
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'version-label', text: 'v2.0' }
    ]);
    expect(
      buildEntryTitleSegments({ kind: 'blog', title: '普通文章' }, 'archive', 'hidden')
    ).toEqual([{ kind: 'title', text: '普通文章' }]);
  });
});

describe('entry-display：版本名称模式归一化', () => {
  it('接受三种合法值', () => {
    expect(isEntryVersionNameMode('hidden')).toBe(true);
    expect(isEntryVersionNameMode('before-label')).toBe(true);
    expect(isEntryVersionNameMode('after-label')).toBe(true);
  });

  it('未知值回退默认 hidden', () => {
    expect(normalizeEntryVersionNameMode('sideways')).toBe(DEFAULT_ENTRY_VERSION_NAME_MODE);
    expect(normalizeEntryVersionNameMode(undefined)).toBe('hidden');
    expect(normalizeEntryVersionNameMode('after-label')).toBe('after-label');
  });
});
