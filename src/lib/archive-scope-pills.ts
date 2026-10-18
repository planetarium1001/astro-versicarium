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
  totalCount: number;
  blogCount: number;
  projectCount: number;
  devlogCount: number;
}): ArchiveScopePill[] => {
  const label = (value: string | null | undefined, fallback: string): string =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;

  return [
    { id: 'all', label: '全部', count: totalCount },
    { id: 'blog', label: label(page.blog?.title, '博客'), count: blogCount },
    { id: 'projects', label: label(page.projects?.title, '项目'), count: projectCount },
    { id: 'devlog', label: label(page.devlog?.title, '更新'), count: devlogCount }
  ];
};
