import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import { getArchiveRows, getProjectVersionHistory } from '../src/lib/archive';
import {
  buildProjectGroups,
  getProjectAnchorAliases,
  resolveProjectAnchor,
  type ProjectEntryData,
  type ProjectEntryLike
} from '../src/lib/project-routing';

const getCollectionMock = vi.mocked(getCollection);

const projectData = {
  title: '站点体验优化',
  subtitle: '从列表密度到移动端触控的体验整理',
  description: '记录列表、卡片与移动端交互的体验检查与调整。',
  type: '演示',
  date: new Date('2026-08-20T00:00:00.000Z'),
  dateText: '2026-08-20',
  dateHasTime: false,
  draft: false,
  versionLabel: 'v2.0',
  versionName: '体验整理',
  versionSummary: '统一列表、卡片与移动端交互。',
  versionOrder: 2,
  versions: [
    {
      label: 'v1.1',
      name: '列表与触控',
      date: new Date('2026-08-18T00:00:00.000Z'),
      dateText: '2026-08-18',
      hasTime: false,
      summary: '调整列表密度与移动端触控热区。',
      order: 1
    },
    {
      label: 'v1.0',
      name: '初版',
      date: new Date('2026-08-12T00:00:00.000Z'),
      dateText: '2026-08-12',
      hasTime: false,
      summary: '建立站点体验检查的初始范围。',
      order: 0
    }
  ]
};

const entry = (
  id: string,
  dateText: string,
  data: Partial<ProjectEntryData> = {}
): ProjectEntryLike => ({
  id,
  data: {
    title: data.title ?? id,
    date: new Date(`${dateText}T00:00:00+08:00`),
    dateText,
    ...data
  }
});

const readSource = async (relative: string) => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  return readFile(path.join(process.cwd(), relative), 'utf8');
};

describe('getProjectVersionHistory', () => {
  it('当前版本在首位，历史版本按日期倒序，并保留 label/name/date/summary', () => {
    const versions = getProjectVersionHistory(projectData, '2026-08-20');
    expect(versions.map((version) => [version.label, version.isCurrent])).toEqual([
      ['v2.0', true],
      ['v1.1', false],
      ['v1.0', false]
    ]);
    expect(versions[0]).toMatchObject({
      name: '体验整理',
      dateText: '2026-08-20',
      summary: '统一列表、卡片与移动端交互。'
    });
    expect(versions[1]).toMatchObject({
      name: '列表与触控',
      dateText: '2026-08-18',
      summary: '调整列表密度与移动端触控热区。'
    });
  });

  it('旧项目没有 versionLabel 时完全不产生版本历史', () => {
    const { versionLabel: _label, versionName: _name, versionSummary: _summary, versionOrder: _order, versions: _versions, ...legacy } = projectData;
    expect(getProjectVersionHistory({ ...legacy, versionLabel: undefined }, '2026-08-20')).toEqual([]);
  });

  it('空白字段回退为 null，不渲染空节点内容', () => {
    const versions = getProjectVersionHistory({
      versionLabel: ' v1.0 ',
      versionName: '  ',
      versionSummary: ''
    }, '2026-01-01');
    expect(versions).toEqual([
      {
        label: 'v1.0',
        name: null,
        dateText: '2026-01-01',
        summary: null,
        order: 0,
        isCurrent: true
      }
    ]);
  });
});

describe('archive project rows', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it('把项目当前大版本字段与历史版本数组带进归档行', async () => {
    getCollectionMock.mockImplementation(async (collection: string) => {
      if (collection === 'projects') {
        return [{ id: '2026-08-20-站点体验优化', data: projectData, body: '' }] as never;
      }
      return [] as never;
    });

    const rows = await getArchiveRows();
    const row = rows.find((item) => item.kind === 'projects');
    expect(row).toMatchObject({
      title: '站点体验优化',
      versionLabel: 'v2.0',
      versionName: '体验整理',
      versionSummary: '统一列表、卡片与移动端交互。',
      versionOrder: 2,
      isLatest: true
    });
    expect(row?.projectVersions?.map((version) => version.label)).toEqual(['v2.0', 'v1.1', 'v1.0']);
  });
});

describe('项目弹窗视图模型', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
  });

  it('每个项目一张最新卡片数据，每个文档版本一个弹窗，legacy 只保留元数据', async () => {
    getCollectionMock.mockImplementation(async (collection: string) => {
      if (collection === 'projects') {
        return [
          {
            id: '2026-01-01-content-workflow',
            data: {
              title: '内容流程',
              date: new Date('2026-01-01T00:00:00.000Z'),
              dateText: '2026-01-01',
              slug: 'content-workflow',
              versionLabel: 'v1.0',
              versionOrder: 1,
              versions: []
            },
            body: ''
          },
          {
            id: '2026-03-01-content-workflow-v2',
            data: {
              title: '内容流程',
              date: new Date('2026-03-01T00:00:00.000Z'),
              dateText: '2026-03-01',
              slug: 'content-workflow',
              versionLabel: 'v2.0',
              versionOrder: 2,
              versions: [{ label: 'v0.9', dateText: '2025-12-01', order: 0 }]
            },
            body: ''
          }
        ] as never;
      }
      return [] as never;
    });

    const { getVisibleProjectDialogItems } = await import('../src/lib/content');
    const items = await getVisibleProjectDialogItems();

    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item?.group.latestAnchor).toBe('content-workflow');
    expect(item?.versions.filter((version) => version.version.hasDocument)).toHaveLength(2);
    expect(
      item?.versions
        .filter((version) => version.version.hasDocument)
        .map((version) => version.version.anchor)
    ).toEqual(['content-workflow', '2026-01-01-content-workflow']);

    const legacy = item?.versions.filter((version) => !version.version.hasDocument) ?? [];
    expect(legacy).toHaveLength(1);
    expect(legacy[0]).toMatchObject({
      bodyHtml: '',
      hasBody: false,
      links: [],
      version: { versionLabel: 'v0.9', hasDocument: false, anchor: '' }
    });
  });
});

describe('项目多版本深链', () => {
  const groups = () =>
    buildProjectGroups([
      entry('2026-01-01-content-workflow', '2026-01-01', {
        slug: 'content-workflow',
        title: '内容流程',
        versionLabel: 'v1.0',
        versionOrder: 1
      }),
      entry('2026-03-01-content-workflow-v2', '2026-03-01', {
        slug: 'content-workflow',
        title: '内容流程',
        versionLabel: 'v2.0',
        versionOrder: 2
      })
    ]);

  it('按锚点、旧 entry.id、最新 slug 依次解析到对应版本', () => {
    const built = groups();

    expect(resolveProjectAnchor(built, '2026-01-01-content-workflow')).toMatchObject({
      group: { latestAnchor: 'content-workflow' },
      version: { anchor: '2026-01-01-content-workflow', isLatest: false }
    });
    expect(resolveProjectAnchor(built, 'content-workflow')?.version.isLatest).toBe(true);
    // 旧 `/projects/#<entryId>`：最新版 entry.id 解析到 slug 锚点
    expect(resolveProjectAnchor(built, '2026-03-01-content-workflow-v2')?.version).toMatchObject({
      anchor: 'content-workflow',
      isLatest: true
    });
    expect(resolveProjectAnchor(built, 'missing')).toBeNull();
  });

  it('只给与锚点不同的 entry.id 生成别名（旧链接兼容）', () => {
    expect(getProjectAnchorAliases(groups()[0]!)).toEqual([
      { entryId: '2026-03-01-content-workflow-v2', anchor: 'content-workflow' }
    ]);
  });

  it('无 slug 项目保持 dated 锚点，不产生别名', () => {
    const [group] = buildProjectGroups([entry('2026-02-10-夜间施工流水线', '2026-02-10')]);
    expect(group?.latestAnchor).toBe('2026-02-10-夜间施工流水线');
    expect(getProjectAnchorAliases(group!)).toEqual([]);
    expect(resolveProjectAnchor([group!], '2026-02-10-夜间施工流水线')?.version.isLatest).toBe(true);
  });
});

describe('项目大版本页面契约', () => {
  it('数据源只用 getVisibleProjectDialogItems：每 group 一张最新版卡片', async () => {
    const page = await readSource('src/pages/projects/index.astro');

    expect(page).toContain('getVisibleProjectDialogItems()');
    expect(page).not.toContain('getVisibleProjects(');
    expect(page).toContain('const projects: ProjectView[] = items.map((item) => {');
    expect(page).toContain('const latest = documents.find((version) => version.isLatest) ?? documents[0]!;');
    // 卡片指向最新版弹窗，卡片 id 与弹窗 id 互不复用
    expect(page).toContain('data-project-dialog={`project-dialog-${card.anchor}`}');
    expect(page).toContain('id={project.cardId}');
    expect(page).toContain('cardId: `project-card-${item.group.key}`');
  });

  it('每个文档版本一个弹窗，锚点 / 别名 / 最新锚点属性齐全', async () => {
    const page = await readSource('src/pages/projects/index.astro');

    expect(page).toContain('const dialogs = projects.flatMap((project) =>');
    expect(page).toContain('.filter((version) => version.hasDocument)');
    expect(page).toContain('id={`project-dialog-${version.anchor}`}');
    expect(page).toContain('data-project-anchor={version.anchor}');
    expect(page).toContain('data-project-latest-anchor={project.group.latestAnchor}');
    expect(page).toContain('data-project-entry-id={version.entryIdAlias || undefined}');
    expect(page).toContain('getProjectAnchorAliases(item.group)');
    // legacy versions[] 只出现在版本历史中，不生成弹窗
    expect(page).toContain('versions.length > 1 || versions.some((version) => version.showsVersionInTitle)');
  });

  it('卡片与弹窗标题行统一走 EntryTitleLine，版本信息弱于标题', async () => {
    const page = await readSource('src/pages/projects/index.astro');

    expect(page).toContain('<EntryTitleLine');
    expect(page).toContain('class="project-card__title-row"');
    expect(page).toContain('class="project-dialog__title-row"');
    expect(page).toContain('badge={card.type}');
    expect(page).toContain('title={card.title}');
    expect(page).toContain('badge={version.type}');
    expect(page).toContain('title={version.title}');
    expect(page).toContain('titleId={`project-dialog-title-${version.anchor}`}');

    // 项目卡片与弹窗不使用已删除的条目格式 composer。
    expect(page).not.toContain('EntryFormatLine');
    expect(page).not.toContain('entryFormat');
  });

  it('版本历史：当前是 span，文档历史版本是按钮，legacy 记录不可点', async () => {
    const page = await readSource('src/pages/projects/index.astro');

    expect(page).toContain('aria-current="true"');
    expect(page).toMatch(
      /<button\s+class="project-version__main"[\s\S]{0,220}?data-project-open[\s\S]{0,120}?data-project-dialog=\{`project-dialog-\$\{item\.anchor\}`\}/
    );
    expect(page).toContain('project-version__main--legacy');
    expect(page).toContain('仅记录');
  });

  it('旧版本弹窗有紧凑提示与“查看最新版”入口', async () => {
    const page = await readSource('src/pages/projects/index.astro');

    expect(page).toContain('!version.isLatest ? (');
    expect(page).toContain('历史版本');
    expect(page).toContain('该版本已归档。');
    expect(page).toContain('查看最新版');
    expect(page).toContain('chevron-up');
    expect(page).toContain('data-project-dialog={`project-dialog-${project.group.latestAnchor}`}');
  });

  it('保留更新日志与末尾链接组：卡片用最新版 links，弹窗正文自带版本 links', async () => {
    const page = await readSource('src/pages/projects/index.astro');

    expect(page).toContain('project.updates.length');
    expect(page).toContain('更新日志');
    expect(page).toContain('renderTrailingLinksHtml(card.links, base)');
    expect(page).toContain('set:html={version.bodyHtml}');
  });

  it('保留 layout-contract 依赖的图标与展示图数据入口', async () => {
    const page = await readSource('src/pages/projects/index.astro');

    expect(page).toContain('image: getContentImageSrc(entry.data.image),');
    expect(page).toContain('<span class="project-card__icon">');
    expect(page).toContain('<span class="project-dialog__icon">');
  });
});

describe('项目弹窗样式契约', () => {
  it('卡片与弹窗标题行复用 entry-title 变量：10px 间隙、胶囊按第一行对齐', async () => {
    const [css, lists] = await Promise.all([
      readSource('src/styles/projects-page.css'),
      readSource('src/styles/components/lists.css')
    ]);
    const cardRow = /\.project-card__title-row \{([^}]*)\}/.exec(css)?.[1] ?? '';
    const dialogRow = /\.project-dialog__title-row \{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(cardRow).toMatch(/--entry-title-gap:\s*10px/);
    expect(cardRow).toMatch(/--entry-title-font-size:\s*16px/);
    expect(dialogRow).toMatch(/--entry-title-gap:\s*10px/);
    expect(dialogRow).toMatch(/--entry-title-font-size:\s*21px/);

    // 行布局与胶囊对齐由共享的 .entry-title 提供。
    expect(lists).toMatch(/\.entry-title \{[^}]*display:\s*flex/);
    expect(lists).toMatch(/\.entry-title \{[^}]*align-items:\s*baseline/);
    expect(lists).toMatch(/\.entry-title \.entry-title__version-label[\s\S]*?margin-top:\s*calc\(/);

    // 旧的独立版本文本样式已删除。
    expect(css).not.toContain('.project-card__version,');
    expect(css).not.toContain('.project-dialog__version,');
  });

  it('弹窗滚动区铺到边框并预留 gutter、使用细滚动条', async () => {
    const css = await readSource('src/styles/projects-page.css');
    const content = /\.project-dialog__content \{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(content).toMatch(/overflow-y:\s*auto/);
    expect(content).toMatch(/margin-inline:\s*-18px/);
    expect(content).toMatch(/padding-inline:\s*18px/);
    expect(content).toMatch(/scrollbar-gutter:\s*stable/);
    expect(content).toMatch(/scrollbar-width:\s*thin/);
    expect(content).toMatch(/scrollbar-color:\s*color-mix\(/);
    expect(css).toMatch(/\.project-dialog__content::-webkit-scrollbar \{\s*width:\s*8px;\s*\}/);
    expect(css).toMatch(/\.project-dialog__content::-webkit-scrollbar-thumb \{[\s\S]*?border-radius:\s*999px/);

    const mobile = /@media \(max-width: 640px\) \{[\s\S]*?\.project-dialog__content \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(mobile).toMatch(/margin-inline:\s*-14px/);
    expect(mobile).toMatch(/padding-inline:\s*14px/);
  });

  it('当前版本下划线贴文字，历史版本行是按钮并带焦点环', async () => {
    const css = await readSource('src/styles/projects-page.css');

    expect(css).toMatch(
      /\.project-version\.is-current \.project-version__label \{[\s\S]*?text-decoration:\s*underline[\s\S]*?text-underline-offset:\s*2px/
    );
    expect(css).not.toMatch(/\.project-version\.is-current \.project-version__label \{[^}]*border-bottom/);
    expect(css).toMatch(/\.project-version__main:focus-visible \{[\s\S]*?outline:\s*2px solid var\(--accent\)/);
    expect(css).toMatch(/\.project-version-notice[\s\S]*?font-size:\s*12px/);
  });

  it('demo 项目使用稳定 slug 与非日期最新版目录，历史版回退到日期目录', async () => {
    const files = [
      'content/projects/versicarium/index.md',
      'content/projects/2026-10-14-versicarium/index.md',
      'content/projects/2026-10-02-versicarium/index.md'
    ];

    for (const [index, file] of files.entries()) {
      const source = await readSource(file);
      expect(source, file).toMatch(/^slug: versicarium$/m);
      expect(source, file).toMatch(/^versionLabel: "?(1\.0\.0|0\.5\.0|0\.1\.0)"?$/m);
      expect(source, file).toMatch(/^versionOrder: [123]$/m);
      if (index === 0) {
        expect(file, '最新版目录使用稳定 slug，不带日期前缀').not.toMatch(/\d{4}-\d{2}-\d{2}/);
        expect(source, file).toMatch(/^versionLabel: "?1\.0\.0"?$/m);
      } else {
        expect(file).toMatch(/\/\d{4}-\d{2}-\d{2}-versicarium\//);
      }
    }
  });
});
