import { describe, expect, it } from 'vitest';
import { buildArchiveScopePills } from '../src/lib/archive-scope-pills';

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
