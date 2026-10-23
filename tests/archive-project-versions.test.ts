import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import { getArchiveRows } from '../src/lib/archive';
import { buildEntryTitleSegments } from '../src/lib/entry-display';

const getCollectionMock = vi.mocked(getCollection);

type ProjectFixtureData = Record<string, unknown>;

const projectEntry = (id: string, dateText: string, data: ProjectFixtureData = {}) => ({
  id,
  data: {
    title: id,
    date: new Date(`${dateText}T00:00:00+08:00`),
    dateText,
    draft: false,
    ...data
  },
  body: ''
});

const mockProjects = (entries: ReturnType<typeof projectEntry>[]) => {
  getCollectionMock.mockImplementation(async (collection: string) => {
    if (collection === 'projects') return entries as never;
    return [] as never;
  });
};

const projectRows = async (options: { versionMode?: 'all' | 'latest' } = {}) => {
  const rows = await getArchiveRows(options);
  return rows.filter((row) => row.kind === 'projects');
};

const readSource = async (relative: string) => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  return readFile(path.join(process.cwd(), relative), 'utf8');
};

describe('归档项目行按文档版本成行', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  const versionedProject = () => [
    projectEntry('2026-08-12-站点体验优化-v1', '2026-08-12', {
      title: '站点体验优化',
      slug: 'site-polish',
      description: 'v1 的描述。',
      versionLabel: 'v1.0',
      versionName: '初版',
      versionOrder: 1
    }),
    projectEntry('2026-08-20-站点体验优化', '2026-08-20', {
      title: '站点体验优化',
      slug: 'site-polish',
      description: 'v2 的描述。',
      versionLabel: 'v2.0',
      versionName: '体验整理',
      versionSummary: '统一列表与移动端交互。',
      versionOrder: 2
    })
  ];

  it('每个文档版本一行，key / href 指向该版本锚点', async () => {
    mockProjects(versionedProject());

    const rows = await projectRows();

    expect(rows.map((row) => row.key)).toEqual([
      'projects:site-polish',
      'projects:2026-08-12-站点体验优化-v1'
    ]);
    expect(rows.map((row) => row.href)).toEqual([
      '/projects/#site-polish',
      '/projects/#2026-08-12-站点体验优化-v1'
    ]);
  });

  it('版本字段来自各自版本文档，并按 id 保留版本顺序', async () => {
    mockProjects(versionedProject());

    const rows = await projectRows();

    expect(rows.map((row) => [row.versionLabel, row.versionName, row.versionOrder])).toEqual([
      ['v2.0', '体验整理', 2],
      ['v1.0', '初版', 1]
    ]);
    expect(rows.map((row) => row.isLatest)).toEqual([true, false]);
    expect(rows[0]?.versionSummary).toBe('统一列表与移动端交互。');
  });

  it('tags 使用项目显示名，所有版本共享同一 tag，text 含描述', async () => {
    mockProjects(versionedProject());

    const rows = await projectRows();

    for (const row of rows) {
      expect(row.tags).toEqual(['站点体验优化']);
    }
    expect(rows[0]?.text).toContain('v2 的描述。');
    expect(rows[1]?.text).toContain('v1 的描述。');
    expect(rows[0]?.description).toBe('v2 的描述。');
  });

  it('versionMode: latest 只保留每个项目的最新版', async () => {
    mockProjects(versionedProject());

    const rows = await projectRows({ versionMode: 'latest' });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'projects:site-polish',
      href: '/projects/#site-polish',
      versionLabel: 'v2.0',
      isLatest: true
    });
  });

  it('无 slug 项目保持 dated 锚点，仍是单行', async () => {
    mockProjects([
      projectEntry('2026-02-10-夜间施工流水线', '2026-02-10', {
        title: '夜间施工流水线',
        description: '流水线描述。'
      })
    ]);

    const rows = await projectRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'projects:2026-02-10-夜间施工流水线',
      href: '/projects/#2026-02-10-夜间施工流水线',
      isLatest: true
    });
  });

  it('legacy versions[] 不额外成行，只作为最新行的元数据历史', async () => {
    mockProjects([
      projectEntry('2026-08-20-站点体验优化', '2026-08-20', {
        title: '站点体验优化',
        description: '当前版本描述。',
        versionLabel: 'v2.0',
        versions: [
          {
            label: 'v1.0',
            name: '初版',
            dateText: '2026-08-12',
            summary: '旧版本描述。',
            order: 0
          }
        ]
      })
    ]);

    const rows = await projectRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.projectVersions?.map((version) => version.label)).toEqual(['v2.0', 'v1.0']);
  });

  it('没有 versionLabel 的项目不伪造版本胶囊（日期不会变成版本号）', async () => {
    mockProjects([
      projectEntry('2026-03-01-whono-astro-主题', '2026-03-01', {
        title: 'Whono Astro 主题',
        description: '主题描述。'
      })
    ]);

    const [row] = await projectRows();

    expect(row?.versionLabel).toBeUndefined();
    const segments = buildEntryTitleSegments(
      { kind: 'projects', title: row!.title, versionLabel: row?.versionLabel ?? null },
      'archive'
    );
    expect(segments).toEqual([{ kind: 'title', text: row!.title }]);
  });
});

describe('归档默认条目外观', () => {
  it('博客只显示标题', () => {
    const segments = buildEntryTitleSegments({ kind: 'blog', title: '文章标题' }, 'archive');

    expect(segments).toEqual([{ kind: 'title', text: '文章标题' }]);
  });

  it('项目显示标题 + 淡色版本胶囊', () => {
    const segments = buildEntryTitleSegments(
      { kind: 'projects', title: '站点体验优化', versionLabel: 'v2.0' },
      'archive'
    );

    expect(segments).toEqual([
      { kind: 'title', text: '站点体验优化' },
      { kind: 'gap' },
      { kind: 'version-label', text: 'v2.0' }
    ]);
  });

  it('开发日志显示「项目名: 标题」', () => {
    const segments = buildEntryTitleSegments(
      { kind: 'devlog', title: '修复上传', project: '内容发布流水线' },
      'archive'
    );

    expect(segments).toEqual([
      { kind: 'project', text: '内容发布流水线' },
      { kind: 'colon' },
      { kind: 'title', text: '修复上传' }
    ]);
  });
});

describe('归档渲染接入契约', () => {
  it('归档行使用 EntryTitleLine，并整行包在一个链接里', async () => {
    const page = await readSource('src/pages/archive/index.astro');

    expect(page).toContain('<EntryTitleLine');
    expect(page).toContain('surface="archive"');
    expect(page).toContain('titleTag="span"');
    expect(page).toContain('kind={row.kind}');
    expect(page).toMatch(/<a class="archive-timeline__entry" href=\{withBase\(row\.href\)\}>/);
    expect(page).not.toContain('archive-timeline__version');
    expect(page).not.toContain('archive-timeline__project');
  });

  it('归档 CSS 只做行级对齐与标题悬停，排版复用共享 entry-title', async () => {
    const [archiveCss, listsCss] = await Promise.all([
      readSource('src/styles/archive-page.css'),
      readSource('src/styles/components/lists.css')
    ]);

    expect(listsCss).toMatch(/\.entry-title--archive \{[\s\S]*?--entry-title-gap:\s*8px/);
    expect(listsCss).toMatch(/\.entry-title--archive \.entry-title__title \{\s*font-size:\s*15px/);
    expect(listsCss).toMatch(/\.entry-title--archive \.entry-title__title \{[\s\S]*?font-weight:\s*inherit/);
    expect(listsCss).toMatch(/\.muted-pill \{[\s\S]*?color:\s*var\(--faint\)/);
    // 键盘聚焦不参与门禁
    expect(archiveCss).toMatch(
      /\.archive-timeline__entry:focus-visible \.entry-title__title \{[\s\S]*?color:\s*var\(--accent\);[\s\S]*?text-decoration:\s*underline;/
    );
    // 悬停视觉按输入模态门禁：触屏点按后 :hover 会粘住高亮
    expect(archiveCss).toMatch(
      /@media \(hover: hover\) \{\s*:root:not\(\[data-input="touch"\]\) \.archive-timeline__entry:hover \.entry-title__title \{[\s\S]*?color:\s*var\(--accent\);[\s\S]*?text-decoration:\s*underline;/
    );
  });

  it('项目版本行把版本号 / 名称 / 摘要写进归档行，供归档行消费', async () => {
    const [page, archiveLib] = await Promise.all([
      readSource('src/pages/archive/index.astro'),
      readSource('src/lib/archive.ts')
    ]);

    expect(page).toContain('versionLabel={row.kind === \'blog\' && !row.series ? null : row.versionLabel ?? null}');
    expect(archiveLib).toContain('...(versionLabel ? { versionLabel } : {})');
    expect(archiveLib).toContain('...(versionName ? { versionName } : {})');
    expect(archiveLib).toContain('...(versionSummary ? { versionSummary } : {})');
    expect(archiveLib).toContain('key: `projects:${version.anchor}`');
    expect(archiveLib).toContain('href: version.href');
  });
});
