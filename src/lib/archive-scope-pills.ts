export type ArchiveScopePill = {
  id: 'all' | 'blog' | 'projects' | 'devlog';
  label: string;
  count: number;
};

/**
 * 归档一级胶囊的文案来自后台页面设置，修改「博客 / 项目 / 更新」页面名后
 * 侧边栏和归档胶囊必须同步，不能写死。
 */
export const buildArchiveScopePills = ({
  page,
  nav,
  totalCount,
  blogCount,
  projectCount,
  devlogCount
}: {
  page: {
    blog?: { title?: string | null } | undefined;
    projects?: { title?: string | null } | undefined;
    devlog?: { title?: string | null } | undefined;
  };
  nav?: ReadonlyArray<{ id?: string; label?: string | null }> | undefined;
  totalCount: number;
  blogCount: number;
  projectCount: number;
  devlogCount: number;
}): ArchiveScopePill[] => {
  const label = (value: string | null | undefined, fallback: string): string =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;

  const navLabel = (id: string): string | null | undefined =>
    nav?.find((item) => item.id === id)?.label;

  // 优先使用侧边栏导航文案，保证归档胶囊和侧边栏完全一致；页面标题作为回退。
  return [
    { id: 'all', label: '全部', count: totalCount },
    { id: 'blog', label: label(navLabel('blog') ?? page.blog?.title, '博客'), count: blogCount },
    { id: 'projects', label: label(navLabel('projects') ?? page.projects?.title, '项目'), count: projectCount },
    { id: 'devlog', label: label(navLabel('devlog') ?? page.devlog?.title, '更新'), count: devlogCount }
  ];
};
