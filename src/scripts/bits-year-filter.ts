/**
 * `/bits/` 年份胶囊。本脚本只声明年份：切换激活态、搬动滑块，再用 `entry-search:set-year`
 * 把年份交给 `entry-search.ts`；可见集合（年份 ∧ 标签 ∧ 关键词 ∧ 分页）始终由后者一次算出，
 * 本脚本不写 `item.hidden`。`?year=` 由本脚本独占读写（`entry-search.ts` 只管 `?tags=&mode=`），
 * 双方都基于当前 URL 改自己的参数；内容区滑动与 `/archive/` 一级胶囊共用 `content-slide.ts`。
 */

import { createContentSlider, createPillCursor, pillDirection } from './content-slide';

const QUERY_PARAM_YEAR = 'year';

const bar = document.querySelector<HTMLElement>('[data-bits-year-bar]');

if (bar) {
  const PILLS = Array.from(bar.querySelectorAll<HTMLButtonElement>('[data-bits-year-item]'));
  const cursor = createPillCursor(
    bar,
    bar.querySelector<HTMLElement>('[data-bits-year-cursor]'),
    PILLS
  );
  const slider = createContentSlider(() => document.querySelector<HTMLElement>('[data-bits-browse]'));

  const readYear = (pill: HTMLElement): number | null => {
    const raw = (pill.dataset.bitsYear ?? '').trim();
    if (raw === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const availableYears = new Set(
    PILLS.map((pill) => readYear(pill)).filter((year): year is number => year !== null)
  );

  let activeYear: number | null = null;

  const syncUrl = (year: number | null) => {
    const nextUrl = new URL(window.location.href);
    if (year === null) {
      nextUrl.searchParams.delete(QUERY_PARAM_YEAR);
    } else {
      nextUrl.searchParams.set(QUERY_PARAM_YEAR, String(year));
    }
    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState({}, '', next);
  };

  const setActiveYear = (year: number | null, options: { syncUrl?: boolean; animate?: boolean } = {}) => {
    // 方向按胶囊在条上的位置顺序决定。条上的顺序是「全部 / 2026 / 2025 / …」（年份倒序），
    // 因此「全部 → 2025」是往右点一颗（forward），「2025 → 2026」是往左点一颗。
    const direction = pillDirection(PILLS, readYear, activeYear, year);

    activeYear = year;
    let activePill: HTMLButtonElement | null = null;
    PILLS.forEach((pill) => {
      const isActive = readYear(pill) === year;
      pill.classList.toggle('is-active', isActive);
      // 与原 /bits/ 年份胶囊一致：用 aria-pressed 表达选中态（不是 tablist/aria-selected）
      pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) activePill = pill;
    });

    if (activePill) cursor.moveTo(activePill);
    if (options.syncUrl !== false) syncUrl(year);

    // 胶囊激活态与滑块立即更新（点击反馈不延迟），内容切换交给滑动过渡
    slider.run(
      () => {
        document.dispatchEvent(
          new CustomEvent('entry-search:set-year', {
            detail: { year, instant: true }
          })
        );
      },
      { animate: options.animate === true, direction }
    );
  };

  PILLS.forEach((pill) => {
    pill.addEventListener('click', () => {
      const year = readYear(pill);
      if (year === activeYear) return;
      setActiveYear(year, { animate: true });
    });
  });

  // 初始年份：`?year=` 只接受确实存在的年份，非法值静默忽略
  const rawYear = (new URL(window.location.href).searchParams.get(QUERY_PARAM_YEAR) ?? '').trim();
  const parsedYear = rawYear === '' ? null : Number(rawYear);
  const initialYear =
    parsedYear !== null && Number.isFinite(parsedYear) && availableYears.has(parsedYear) ? parsedYear : null;

  // 初始态来自 URL 时不要写回去（避免多一次 replaceState）；首屏也不播滑动动画。
  setActiveYear(initialYear, { syncUrl: rawYear !== '' && initialYear === null });
}

export {};
