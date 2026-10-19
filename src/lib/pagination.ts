/**
 * 列表分页的纯计算：页码、页窗口与「上一页 / 1 / 2 / 下一页」的文本模型。
 * 三种公开页（entry-search 列表、首页、/devlog/）共用，避免各写一套边界判断。
 */
export type PageWindow = {
  page: number;
  total: number;
  pageSize: number;
  totalPages: number;
  start: number;
  end: number;
};

export const resolvePageWindow = (total: number, pageSize: number, page: number): PageWindow => {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : Math.max(safeTotal, 1);
  const totalPages = Math.max(Math.ceil(safeTotal / safeSize), 1);
  const safePage = Math.min(Math.max(Math.trunc(page), 1), totalPages);
  const start = (safePage - 1) * safeSize;
  return {
    page: safePage,
    total: safeTotal,
    pageSize: safeSize,
    totalPages,
    start,
    end: Math.min(start + safeSize, safeTotal)
  };
};

export const formatPageStatus = (page: number, totalPages: number): string =>
  `${page} / ${totalPages}`;
