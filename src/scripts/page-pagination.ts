import { formatPageStatus, resolvePageWindow } from '../lib/pagination';

/**
 * 通用列表分页（首页 / `/devlog/`）。
 *
 * SSR 始终输出全部条目；本脚本只在启用分页时给非当前页条目加 `data-page-hidden`，
 * 由 CSS 收起。筛选类脚本继续用 `hidden`，两者互不覆盖：
 * - `hidden` = 被搜索 / 项目筛选排除；
 * - `data-page-hidden` = 不在当前页。
 * `/devlog/` 的筛选变化会通过 MutationObserver 把页码重置回 1。
 */
type PaginationRoot = HTMLElement;

const HIDDEN_ATTR = 'data-page-hidden';

const readPageSize = (root: PaginationRoot): number => {
  const raw = Number.parseInt((root.dataset.pageSize ?? '').trim(), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

const createTextButton = (
  label: string,
  ariaLabel: string,
  disabled: boolean,
  onClick: () => void
): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pagination__link';
  button.textContent = label;
  button.disabled = disabled;
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', onClick);
  return button;
};

const initPagination = (root: PaginationRoot): void => {
  const pageSize = readPageSize(root);
  const list = root.querySelector<HTMLElement>('[data-page-list]');
  const nav = root.querySelector<HTMLElement>('[data-page-pagination]');
  const inner = nav?.querySelector<HTMLElement>('[data-page-pagination-inner]') ?? null;
  if (!list || !nav || !inner || pageSize <= 0) return;

  const items = Array.from(list.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );
  if (items.length === 0) return;

  let currentPage = 1;
  let resetTimer: number | undefined;

  const eligibleItems = (): HTMLElement[] => items.filter((item) => !item.hidden);

  const render = (options: { scroll?: boolean } = {}): void => {
    const eligible = eligibleItems();
    const window = resolvePageWindow(eligible.length, pageSize, currentPage);
    currentPage = window.page;

    const visible = new Set(eligible.slice(window.start, window.end));
    for (const item of items) {
      if (visible.has(item)) item.removeAttribute(HIDDEN_ATTR);
      else item.setAttribute(HIDDEN_ATTR, '');
    }

    nav.hidden = window.totalPages <= 1;
    if (nav.hidden) {
      inner.textContent = '';
      return;
    }

    inner.textContent = '';
    const status = document.createElement('span');
    status.className = 'pagination__status';
    status.dataset.pageStatus = '';
    status.setAttribute('aria-live', 'polite');
    status.textContent = formatPageStatus(window.page, window.totalPages);

    inner.append(
      createTextButton('< 上一页', '上一页', window.page <= 1, () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        render({ scroll: true });
      }),
      status,
      createTextButton('下一页 >', '下一页', window.page >= window.totalPages, () => {
        if (currentPage >= window.totalPages) return;
        currentPage += 1;
        render({ scroll: true });
      })
    );

    if (options.scroll) {
      const first = eligible[window.start] ?? nav;
      first.scrollIntoView?.({ block: 'nearest' });
    }
  };

  /** 锚点条目若被分页藏到第二页，首次进入先翻到它所在页，避免 `#id` 死链。 */
  const revealHashTarget = (): void => {
    let id = window.location.hash.replace(/^#/, '');
    try {
      id = decodeURIComponent(id);
    } catch {
      return;
    }
    id = id.trim();
    if (!id) return;
    const target = items.find((item) => item.id === id);
    if (!target || target.hidden) return;
    const eligible = eligibleItems();
    const index = eligible.indexOf(target);
    if (index < 0) return;
    currentPage = Math.floor(index / pageSize) + 1;
    render();
  };

  render();
  revealHashTarget();
  window.addEventListener('hashchange', revealHashTarget);

  // 只观察列表条目的 `hidden`（筛选），不观察抽屉面板；筛选稳定后回到第 1 页。
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver((records) => {
      const itemSet = new Set(items);
      const filterChanged = records.some((record) => itemSet.has(record.target as HTMLElement));
      if (!filterChanged) return;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        currentPage = 1;
        render();
      }, 420);
    });
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }
};

const roots = Array.from(document.querySelectorAll<PaginationRoot>('[data-page-pagination-root]'));
for (const root of roots) initPagination(root);

export {};
