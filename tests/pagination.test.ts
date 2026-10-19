// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPageStatus, resolvePageWindow } from '../src/lib/pagination';

describe('分页纯计算', () => {
  it('页码越界时夹到首尾页', () => {
    expect(resolvePageWindow(27, 20, 0)).toMatchObject({ page: 1, totalPages: 2, start: 0, end: 20 });
    expect(resolvePageWindow(27, 20, 9)).toMatchObject({ page: 2, totalPages: 2, start: 20, end: 27 });
  });

  it('总数不足一页时只有 1 页', () => {
    expect(resolvePageWindow(8, 20, 1)).toMatchObject({ page: 1, totalPages: 1, start: 0, end: 8 });
    expect(formatPageStatus(1, 1)).toBe('1 / 1');
  });

  it('页大小为 0 时退化为整页，不会除零', () => {
    expect(resolvePageWindow(12, 0, 1)).toMatchObject({ page: 1, totalPages: 1, pageSize: 12 });
  });
});

describe('首页 / devlog 通用分页脚本', () => {
  afterEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  const mount = (count: number, pageSize: number, hiddenIndexes: number[] = []) => {
    const root = document.createElement('div');
    root.setAttribute('data-page-pagination-root', '');
    root.dataset.pageSize = String(pageSize);
    const list = document.createElement('div');
    list.setAttribute('data-page-list', '');
    for (let index = 0; index < count; index += 1) {
      const item = document.createElement('article');
      item.textContent = `item ${index}`;
      if (hiddenIndexes.includes(index)) item.hidden = true;
      list.append(item);
    }
    const nav = document.createElement('nav');
    nav.setAttribute('data-page-pagination', '');
    nav.hidden = true;
    const inner = document.createElement('div');
    inner.setAttribute('data-page-pagination-inner', '');
    nav.append(inner);
    root.append(list, nav);
    document.body.append(root);
    return { root, list, nav, inner, items: Array.from(list.children) as HTMLElement[] };
  };

  it('只显示当前页，并给出 1 / N 与上一页 / 下一页', async () => {
    const { items, nav, inner } = mount(5, 2);
    await import('../src/scripts/page-pagination');

    expect(items.filter((item) => !item.hasAttribute('data-page-hidden'))).toHaveLength(2);
    expect(nav.hidden).toBe(false);
    expect(inner.textContent).toContain('1 / 3');
    expect(inner.querySelectorAll('.pagination__link')).toHaveLength(2);

    (inner.querySelectorAll('.pagination__link')[1] as HTMLButtonElement).click();
    expect(items.filter((item) => !item.hasAttribute('data-page-hidden'))).toHaveLength(2);
    expect(inner.textContent).toContain('2 / 3');
  });

  it('筛选（hidden）变化后回到第 1 页', async () => {
    vi.useFakeTimers();
    try {
      const { items, inner } = mount(6, 2);
      await import('../src/scripts/page-pagination');
      (inner.querySelectorAll('.pagination__link')[1] as HTMLButtonElement).click();
      expect(inner.textContent).toContain('2 / 3');

      items[0]!.hidden = true;
      items[1]!.hidden = true;
      await Promise.resolve();
      vi.advanceTimersByTime(500);
      expect(inner.textContent).toContain('1 / 2');
    } finally {
      vi.useRealTimers();
    }
  });
});
