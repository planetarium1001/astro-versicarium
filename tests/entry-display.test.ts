import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENTRY_SERIES_MODE,
  DEFAULT_ENTRY_SERIES_ORDER,
  DEFAULT_ENTRY_VERSION_NAME_MODE,
  ENTRY_SERIES_MODE_OPTIONS,
  ENTRY_SERIES_ORDER_OPTIONS,
  ENTRY_TITLE_COLON,
  buildEntrySeriesLookup,
  buildEntryTitleSegments,
  formatEntrySeriesOrder,
  isEntrySeriesMode,
  isEntrySeriesOrder,
  isEntryVersionNameMode,
  normalizeEntrySeriesMode,
  normalizeEntrySeriesOrder,
  normalizeEntryVersionNameMode,
  resolveEntrySeriesDisplay,
  resolveEntrySeriesSlots
} from '../src/lib/entry-display';
import type { BlogSeriesGroup } from '../src/lib/blog-series';

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


const withSeries = {
  badge: '指南',
  title: '内容流程',
  seriesName: '折腾主机',
  seriesIndex: 2,
  seriesTotal: 5
};

describe('entry-display：系列四档呈现', () => {
  it('meta / hidden：标题行不产出系列段（meta 由元信息行承担，hidden 完全不显示）', () => {
    const plain = buildEntryTitleSegments({ badge: '指南', title: '内容流程' }, 'list');
    expect(buildEntryTitleSegments(withSeries, 'list', DEFAULT_ENTRY_VERSION_NAME_MODE, { mode: 'meta' })).toEqual(plain);
    expect(buildEntryTitleSegments(withSeries, 'list', DEFAULT_ENTRY_VERSION_NAME_MODE, { mode: 'hidden' })).toEqual(plain);
    // 默认档就是 meta，因此不传第四参也不会多出系列段
    expect(buildEntryTitleSegments(withSeries, 'list')).toEqual(plain);
  });

  it('pill：标题之后「胶囊在前、名字在后」', () => {
    expect(buildEntryTitleSegments(withSeries, 'list', DEFAULT_ENTRY_VERSION_NAME_MODE, { mode: 'pill' })).toEqual([
      { kind: 'badge', text: '指南' },
      { kind: 'gap' },
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'series-label', text: '2/5' },
      { kind: 'gap' },
      { kind: 'series-name', text: '折腾主机' }
    ]);
  });

  it('pill：关掉序号开关后只剩系列名', () => {
    expect(
      buildEntryTitleSegments(withSeries, 'list', DEFAULT_ENTRY_VERSION_NAME_MODE, { mode: 'pill', order: 'hide' })
    ).toEqual([
      { kind: 'badge', text: '指南' },
      { kind: 'gap' },
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'series-name', text: '折腾主机' }
    ]);
  });

  it('prefix：分类之后「系列名: 标题」，序号胶囊挂在行尾', () => {
    expect(buildEntryTitleSegments(withSeries, 'list', DEFAULT_ENTRY_VERSION_NAME_MODE, { mode: 'prefix' })).toEqual([
      { kind: 'badge', text: '指南' },
      { kind: 'gap' },
      { kind: 'series-name', text: '折腾主机' },
      { kind: 'colon' },
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'series-label', text: '2/5' }
    ]);
  });

  it('prefix + hide：行尾不再挂序号胶囊', () => {
    const segments = buildEntryTitleSegments(withSeries, 'list', DEFAULT_ENTRY_VERSION_NAME_MODE, {
      mode: 'prefix',
      order: 'hide'
    });
    expect(segments.some((segment) => segment.kind === 'series-label')).toBe(false);
    expect(segments.map((segment) => segment.kind)).toEqual(['badge', 'gap', 'series-name', 'colon', 'title']);
  });

  it('系列段与版本段同时存在时，胶囊并排在前、名称按同序在后', () => {
    const versioned = { ...withSeries, versionLabel: 'v2.0', versionName: '稳定版' };

    const pill = buildEntryTitleSegments(versioned, 'list', 'after-label', { mode: 'pill' });
    expect(pill.map((segment) => segment.kind)).toEqual([
      'badge',
      'gap',
      'title',
      'gap',
      'version-label',
      'gap',
      'series-label',
      'gap',
      'version-name',
      'gap',
      'series-name'
    ]);

    const prefix = buildEntryTitleSegments(versioned, 'list', 'hidden', { mode: 'prefix' });
    expect(prefix.map((segment) => segment.kind)).toEqual([
      'badge',
      'gap',
      'series-name',
      'colon',
      'title',
      'gap',
      'version-label',
      'gap',
      'series-label'
    ]);
  });

  it('归档 meta 档把系列并进标题行的小字，不另起一行', () => {
    expect(buildEntryTitleSegments(withSeries, 'archive', 'hidden', { mode: 'meta' })).toEqual([
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'series-name', text: '折腾主机 2/5' }
    ]);

    expect(
      buildEntryTitleSegments(withSeries, 'archive', 'hidden', { mode: 'meta', order: 'hide' }).at(-1)
    ).toEqual({ kind: 'series-name', text: '折腾主机' });

    // 列表的 meta 档仍由元信息行承担，标题行不产出系列段
    expect(
      buildEntryTitleSegments(withSeries, 'list', 'hidden', { mode: 'meta' }).some(
        (segment) => segment.kind === 'series-name'
      )
    ).toBe(false);
  });

  it('归档行同样支持 pill / prefix；更新（devlog）行忽略系列字段', () => {
    const archive = buildEntryTitleSegments(withSeries, 'archive', 'hidden', { mode: 'pill' });
    expect(archive[0]).toEqual({ kind: 'title', text: '内容流程' });
    expect(archive.at(-1)).toEqual({ kind: 'series-name', text: '折腾主机' });

    expect(
      buildEntryTitleSegments({ ...withSeries, kind: 'devlog', project: '折腾主机' }, 'archive', 'hidden', {
        mode: 'prefix'
      })
    ).toEqual([
      { kind: 'project', text: '折腾主机' },
      { kind: 'colon' },
      { kind: 'title', text: '内容流程' }
    ]);
  });

  it('缺序号 / 缺名字时不产出孤立胶囊或空段', () => {
    expect(
      buildEntryTitleSegments({ title: '内容流程', seriesName: '折腾主机' }, 'list', 'hidden', { mode: 'pill' })
    ).toEqual([
      { kind: 'badge', text: '随笔' },
      { kind: 'gap' },
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'series-name', text: '折腾主机' }
    ]);
    expect(
      buildEntryTitleSegments({ title: '内容流程', seriesIndex: 2, seriesTotal: 5 }, 'list', 'hidden', { mode: 'pill' })
    ).toEqual([
      { kind: 'badge', text: '随笔' },
      { kind: 'gap' },
      { kind: 'title', text: '内容流程' },
      { kind: 'gap' },
      { kind: 'series-label', text: '2/5' }
    ]);
    expect(buildEntryTitleSegments({ title: '无系列' }, 'list', 'hidden', { mode: 'pill' })).toEqual([
      { kind: 'badge', text: '随笔' },
      { kind: 'gap' },
      { kind: 'title', text: '无系列' }
    ]);
  });
});

describe('entry-display：系列设置与序号', () => {
  it('四档选项的标签直接画出字段顺序', () => {
    expect(ENTRY_SERIES_MODE_OPTIONS.map((option) => option.id)).toEqual(['hidden', 'meta', 'pill', 'prefix']);
    expect(ENTRY_SERIES_MODE_OPTIONS.map((option) => option.label)).toEqual([
      '不显示',
      '标题 · 元信息行：系列名 2/5',
      '分类 · 标题 · 2/5 · 系列名',
      '分类 · 系列名 : 标题 · 2/5'
    ]);
    expect(ENTRY_SERIES_ORDER_OPTIONS.map((option) => option.id)).toEqual(['show', 'hide']);
    expect(DEFAULT_ENTRY_SERIES_MODE).toBe('meta');
    expect(DEFAULT_ENTRY_SERIES_ORDER).toBe('show');
  });

  it('档位与开关都按白名单归一化，未知值回退默认', () => {
    expect(isEntrySeriesMode('pill')).toBe(true);
    expect(isEntrySeriesMode('latest')).toBe(false);
    expect(normalizeEntrySeriesMode('prefix')).toBe('prefix');
    expect(normalizeEntrySeriesMode('latest')).toBe('meta');
    expect(normalizeEntrySeriesMode(undefined)).toBe('meta');

    expect(isEntrySeriesOrder('hide')).toBe(true);
    expect(normalizeEntrySeriesOrder('show')).toBe('show');
    expect(normalizeEntrySeriesOrder(1)).toBe('show');
  });

  it('resolveEntrySeriesDisplay 把站点设置（可能缺字段）摊平成渲染开关', () => {
    expect(resolveEntrySeriesDisplay(undefined)).toEqual({ mode: 'meta', order: 'show' });
    expect(resolveEntrySeriesDisplay({ entrySeriesMode: 'pill', entrySeriesOrder: 'hide' })).toEqual({
      mode: 'pill',
      order: 'hide'
    });
    expect(resolveEntrySeriesDisplay({ entrySeriesMode: 'nope', entrySeriesOrder: 'nope' })).toEqual({
      mode: 'meta',
      order: 'show'
    });
  });

  it('resolveEntrySeriesSlots 决定系列落到标题行还是元信息行', () => {
    const member = { name: '折腾主机', slug: 'pc-build', index: 2, total: 5 };

    // 默认档是 meta：列表卡片与归档行都由元信息行承载
    expect(resolveEntrySeriesSlots(member, undefined)).toEqual({
      showInTitle: false,
      showInMeta: true,
      orderText: '2/5'
    });
    expect(resolveEntrySeriesSlots(member, { entrySeriesMode: 'pill' }).showInTitle).toBe(true);
    expect(resolveEntrySeriesSlots(member, { entrySeriesMode: 'prefix' }).showInTitle).toBe(true);
    expect(resolveEntrySeriesSlots(member, { entrySeriesMode: 'hidden' })).toEqual({
      showInTitle: false,
      showInMeta: false,
      orderText: '2/5'
    });
    // 关掉序号开关只让 N/M 消失，系列名照旧呈现
    expect(resolveEntrySeriesSlots(member, { entrySeriesOrder: 'hide' }).orderText).toBe('');
    // 缺系列名或系列键都不算属于一个系列：两个槽位都关，避免出现只有序号的孤立链接
    expect(resolveEntrySeriesSlots({ ...member, name: null }, undefined)).toEqual({
      showInTitle: false,
      showInMeta: false,
      orderText: '2/5'
    });
    expect(resolveEntrySeriesSlots({ ...member, slug: '  ' }, undefined).showInMeta).toBe(false);
  });

  it('序号只在两侧都是正数时生成', () => {
    expect(formatEntrySeriesOrder(2, 5)).toBe('2/5');
    expect(formatEntrySeriesOrder(1, 1)).toBe('1/1');
    expect(formatEntrySeriesOrder(2.7, 5.2)).toBe('2/5');
    expect(formatEntrySeriesOrder(0, 5)).toBe('');
    expect(formatEntrySeriesOrder(2, 0)).toBe('');
    expect(formatEntrySeriesOrder(null, 5)).toBe('');
    expect(formatEntrySeriesOrder(2, undefined)).toBe('');
    expect(formatEntrySeriesOrder(Number.NaN, 5)).toBe('');
  });

  it('buildEntrySeriesLookup 按条目 id 摊平系列索引', () => {
    const index = new Map<string, BlogSeriesGroup>([
      [
        'pc-build',
        {
          slug: 'pc-build',
          name: '折腾主机',
          total: 2,
          members: [
            {
              versionGroupKey: 'versionGroup:pc-build-a',
              entryId: 'blog/pc-build-a',
              title: '第一篇',
              href: '/blog/pc-build-a/',
              dateText: '2026-01-01',
              index: 1
            },
            {
              versionGroupKey: 'versionGroup:pc-build-b',
              entryId: 'blog/pc-build-b',
              title: '第二篇',
              href: '/blog/pc-build-b/',
              dateText: '2026-02-01',
              index: 2
            }
          ]
        }
      ]
    ]);

    const lookup = buildEntrySeriesLookup(index);
    expect(lookup.get('blog/pc-build-b')).toEqual({ slug: 'pc-build', name: '折腾主机', index: 2, total: 2 });
    expect(lookup.get('blog/other')).toBeUndefined();
  });
});
