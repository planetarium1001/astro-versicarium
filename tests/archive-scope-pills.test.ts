import { describe, expect, it } from 'vitest';
import { buildArchiveScopePills } from '../src/lib/archive-scope-pills';

const readSource = async (relative: string) => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  return readFile(path.join(process.cwd(), relative), 'utf8');
};

describe('archive scope pills', () => {
  it('uses the configured page titles instead of hard-coded labels', () => {
    expect(buildArchiveScopePills({
      page: {
        blog: { title: '文章' },
        projects: { title: '作品集' },
        devlog: { title: '动态更新' }
      },
      nav: [
        { id: 'blog', label: '文章' },
        { id: 'projects', label: '作品集' },
        { id: 'devlog', label: '动态更新' }
      ],
      totalCount: 10,
      blogCount: 5,
      projectCount: 3,
      devlogCount: 2
    })).toEqual([
      { id: 'all', label: '全部', count: 10 },
      { id: 'blog', label: '文章', count: 5 },
      { id: 'projects', label: '作品集', count: 3 },
      { id: 'devlog', label: '动态更新', count: 2 }
    ]);
  });

  it('prefers the sidebar nav label so archive pills match the sidebar', () => {
    expect(buildArchiveScopePills({
      page: {
        blog: { title: '文章页' },
        projects: { title: '作品页' },
        devlog: { title: '开发页' }
      },
      nav: [
        { id: 'blog', label: '文章' },
        { id: 'devlog', label: '开发日志' }
      ],
      totalCount: 3,
      blogCount: 1,
      projectCount: 0,
      devlogCount: 2
    }).map((pill) => pill.label)).toEqual(['全部', '文章', '作品页', '开发日志']);
  });

  it('falls back when a page title is empty', () => {
    expect(buildArchiveScopePills({
      page: { blog: { title: '  ' }, projects: {}, devlog: { title: null } },
      totalCount: 0,
      blogCount: 0,
      projectCount: 0,
      devlogCount: 0
    }).map((pill) => pill.label)).toEqual(['全部', '博客', '项目', '更新']);
  });
});

describe('archive #项目 payload 与作用域入口', () => {
  it('projects 作用域的 tag 选项来自项目版本行的项目显示名', async () => {
    const page = await readSource('src/pages/archive/index.astro');

    expect(page).toContain("const projectRows = rows.filter((row) => row.kind === 'projects');");
    expect(page).toContain(
      "const projectTags: TagSummary[] = collectTagScopedSummary('projects', projectRows, (row) => row.tags);"
    );
    expect(page).toContain('const tagPayload = { blog: blogTags, projects: projectTags, devlog: devlogTags, all: allTags };');
  });

  it('「全部」作用域从时间线行收集 tags，项目名与博客标签共用一套计数', async () => {
    const page = await readSource('src/pages/archive/index.astro');

    expect(page).toContain("const allTags: TagSummary[] = collectTagScopedSummary('all', rows, (row) => row.tags);");
  });

  it('projects 作用域显示 #项目 trigger，且与 devlog 一样不再隐藏入口', async () => {
    const scope = await readSource('src/scripts/archive-scope.ts');

    expect(scope).toContain("const noun = scope === 'projects' || scope === 'devlog' ? '项目' : '标签';");
    expect(scope).toContain('TAG_TRIGGER.textContent = `#${noun}`');
    expect(scope).toContain('TAG_TRIGGER.hidden = false');
    expect(scope).not.toContain('TAG_TRIGGER.hidden = isProjects');
  });

  it('作用域切换时 dialog 选项按 payload.projects 重建', async () => {
    const scope = await readSource('src/scripts/archive-scope.ts');

    expect(scope).toContain('const options = tagPayload[scope] ?? [];');
    expect(scope).toContain("projects: parsed.projects ?? []");
  });

  it('archive/index.json 原样带出每行的 tags 与 key', async () => {
    const indexJson = await readSource('src/pages/archive/index.json.ts');

    expect(indexJson).toContain('slug: row.key');
    expect(indexJson).toContain('tags: row.tags');
  });
});
