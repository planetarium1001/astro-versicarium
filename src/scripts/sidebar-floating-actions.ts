// 右下角浮动按钮列：回到顶部、回到上次阅读位置、查看目录（退出阅读由 sidebar-reading.ts 控制）。
// 位置记忆分两层：跨次打开按路径存 localStorage，本次会话用位置栈（目录跳转、回到顶部前入栈）。
// 每条记「最近标题 + 段内偏移」与「滚动比例」，锚点优先、比例兜底。

import { bindTouchActivate } from './touch-activate';

const STACK_SIZE = 12;
const STORAGE_KEY = 'astro-whono:reading-position';
const SAVE_INTERVAL_MS = 1500;
const MIN_SCROLL_PX = 240;
const MIN_DELTA_RATIO = 0.18;
// 页面开头没有回退价值：此高度内不记返回位置。
const MIN_FALLBACK_PX = 80;

type SavedPosition = {
  headingId: string | null;
  offset: number;
  ratio: number;
  ts: number;
};

const stackButton = document.getElementById('scroll-top');
const resumeButton = document.getElementById('resume-reading');

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollToY = (y: number) => {
  window.scrollTo({
    top: Math.max(0, Math.round(y)),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth'
  });
};

const readStore = (): Record<string, SavedPosition> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SavedPosition>) : {};
  } catch (_) {
    return {};
  }
};

const writeStore = (store: Record<string, SavedPosition>) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (_) {
  }
};

const pruneStore = (store: Record<string, SavedPosition>) => {
  const entries = Object.entries(store);
  if (entries.length <= 60) return store;
  entries.sort((a, b) => (b[1]?.ts ?? 0) - (a[1]?.ts ?? 0));
  return Object.fromEntries(entries.slice(0, 60));
};

const initFloatingStack = () => {
  const stack = document.querySelector<HTMLElement>('[data-float-stack]');
  if (!stack) return;

  /**
   * 浮动列按钮不保留 title：华为浏览器（HarmonyOS，ArkWeb 内核）会把 title 当原生长按提示，
   * 触摸时可能吞掉首次点按；Chrome / Via 不会弹。可访问名称由 aria-label 提供，
   * 桌面悬停提示暂时取消（如需恢复，改用 CSS 的 [data-tooltip] 机制）。
   * sidebar-reading.ts 等脚本会动态写回 title，这里统一观察并移除，保证按钮始终没有原生提示。
   */
  const stripButtonTitles = () => {
    stack.querySelectorAll<HTMLElement>('.float-stack__button[title]').forEach((button) => {
      button.removeAttribute('title');
    });
  };
  stripButtonTitles();
  if (typeof MutationObserver === 'function') {
    new MutationObserver(stripButtonTitles).observe(stack, {
      attributes: true,
      attributeFilter: ['title'],
      subtree: true
    });
  }

  // 标题清理要先于按钮判断：即使只保留阅读/目录按钮，也要阻止其它脚本写回 title。
  // 两个按钮都由「浮动操作列」设置单独控制，只剩一个也要照常工作。
  if (!stackButton && !resumeButton) return;

  const pageKey = `${window.location.pathname}${window.location.search}`;
  const headings = Array.from(document.querySelectorAll<HTMLElement>('.prose :is(h2, h3)[id]'));

  const currentY = () => window.scrollY || document.documentElement.scrollTop || 0;

  const maxScroll = () =>
    Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

  // 当前位置所属章节与整体比例。
  const capturePosition = (): SavedPosition => {
    const y = currentY();
    let headingId: string | null = null;
    let offset = 0;

    headings.forEach((heading) => {
      const top = heading.getBoundingClientRect().top + y;
      if (top <= y + 4) {
        headingId = heading.id;
        offset = y - top;
      }
    });

    return {
      headingId,
      offset,
      ratio: Math.min(1, Math.max(0, y / maxScroll())),
      ts: Date.now()
    };
  };

  const resolveTargetY = (position: SavedPosition) => {
    if (position.headingId) {
      const heading = document.getElementById(position.headingId);
      if (heading instanceof HTMLElement) {
        return heading.getBoundingClientRect().top + currentY() + (position.offset ?? 0);
      }
    }
    return (position.ratio ?? 0) * maxScroll();
  };

  const labelFor = (position: SavedPosition) => {
    let text = '';
    if (position.headingId) {
      const heading = document.getElementById(position.headingId);
      text = heading?.textContent?.trim() ?? '';
    }
    return text ? `回到上次阅读位置：${text}` : '回到上次阅读位置';
  };

  const positionStack: SavedPosition[] = [];
  /**
   * 目录按钮的返回位置锁定标记：点目录按钮时把跳转前的位置入栈并锁定，
   * 此后从目录条目跳转不再入栈，返回位置保持为「使用目录按钮之前」的位置。
   * 返回位置被「回到上次阅读位置」用掉（或再次点目录按钮时重算）后解锁。
   */
  let tocReturnPinned = false;

  const pushCurrentPosition = () => {
    // 页面开头没有回退价值。
    if (currentY() < MIN_FALLBACK_PX) return;
    const current = capturePosition();
    const last = positionStack[positionStack.length - 1];
    // 位置几乎没变则不入栈，避免连点堆积历史。
    if (last && Math.abs(last.ratio - current.ratio) * maxScroll() < MIN_SCROLL_PX) return;
    positionStack.push(current);
    if (positionStack.length > STACK_SIZE) positionStack.shift();
  };

  let stored = readStore();
  let storedPosition: SavedPosition | null = stored[pageKey] ?? null;
  let saveTimer: number | undefined;

  const saveCurrentPosition = () => {
    const y = currentY();
    if (y < MIN_SCROLL_PX) return;
    stored = pruneStore({ ...stored, [pageKey]: capturePosition() });
    writeStore(stored);
  };

  const scheduleSave = () => {
    if (saveTimer !== undefined) return;
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      saveCurrentPosition();
    }, SAVE_INTERVAL_MS);
  };

  const syncResumeButton = () => {
    if (!resumeButton) return;

    const next = positionStack[positionStack.length - 1] ?? storedPosition;
    if (!next) {
      resumeButton.hidden = true;
      return;
    }

    const delta = Math.abs(resolveTargetY(next) - currentY());
    const visible = positionStack.length > 0 || delta > Math.max(MIN_SCROLL_PX, window.innerHeight * MIN_DELTA_RATIO);
    resumeButton.hidden = !visible;
    if (visible) {
      const label = labelFor(next);
      // 只写 aria-label：title 会触发部分内核的原生长按提示，见 stripButtonTitles 的说明。
      resumeButton.setAttribute('aria-label', label);
    }
  };

  const syncScrollTopButton = () => {
    if (!stackButton) return;
    // 一屏看完时没有回到顶部可言，直接隐藏。
    const scrollable = maxScroll() > 48;
    stackButton.hidden = !scrollable;
    stackButton.setAttribute(
      'aria-disabled',
      !scrollable || currentY() <= 8 ? 'true' : 'false'
    );
  };

  const syncAll = () => {
    syncResumeButton();
    syncScrollTopButton();
  };

  /**
   * 两个按钮都走同一条激活路径：pointerdown/up 兜底（华为等会吞 click 的内核）
   * + 原生 click（鼠标 / 键盘 / 未吞 click 的浏览器），由 touch-activate 去重。
   */
  const scrollTopDisabled = () => {
    // 状态可能过期（滚动事件还没同步）：先重算，避免这次点按被直接吞掉。
    syncScrollTopButton();
    return !stackButton || stackButton.getAttribute('aria-disabled') === 'true';
  };
  const activateScrollTop = () => {
    // disabled 已在激活前由绑定器复查；这里直接执行动作。
    pushCurrentPosition();
    scrollToY(0);
    syncAll();
  };
  if (stackButton) {
    bindTouchActivate(stackButton, activateScrollTop, { disabled: scrollTopDisabled });
  }

  const resumeDisabled = () => {
    // 先按当前位置重算可见性，再决定是否可用（与原来的 click 逻辑一致）。
    syncResumeButton();
    return !resumeButton || resumeButton.hidden;
  };
  const activateResume = () => {
    const fromStored = positionStack.length === 0;
    const target = positionStack.pop() ?? storedPosition;
    if (!target) return;
    // 目录按钮记下的返回位置已用掉，之后的目录跳转恢复入栈。
    tocReturnPinned = false;
    // 记下当前位置，便于再跳回来。
    pushCurrentPosition();
    if (fromStored) {
      // 跨次记忆已用掉，避免下次打开又提示同一位置。
      storedPosition = null;
      if (stored[pageKey]) {
        delete stored[pageKey];
        writeStore(stored);
      }
    }
    scrollToY(resolveTargetY(target));
    syncAll();
  };
  if (resumeButton) {
    bindTouchActivate(resumeButton, activateResume, { disabled: resumeDisabled });
  }

  // 目录按钮跳转前入栈（article-toc.ts 在滚动前派发）。
  window.addEventListener('astro-whono:toc-jump', () => {
    pushCurrentPosition();
    // 页面开头没有可回退的位置，此时不锁定，后续目录跳转照常入栈。
    tocReturnPinned = currentY() >= MIN_FALLBACK_PX;
    syncAll();
  });

  // 目录条目跳转前入栈（article-toc.ts 在滚动前派发）。
  window.addEventListener('astro-whono:reading-jump', () => {
    // 用目录按钮进来的场景：中途的目录跳转不覆盖已锁定的返回位置。
    if (!tocReturnPinned) pushCurrentPosition();
    syncAll();
  });

  window.addEventListener('scroll', () => {
    scheduleSave();
    syncScrollTopButton();
  }, { passive: true });

  window.addEventListener('resize', syncAll);
  window.addEventListener('load', syncAll);
  window.addEventListener('pagehide', saveCurrentPosition);
  window.addEventListener('astro-whono:reading-mode-change', () => {
    // 布局过渡结束后位置才有效，延后一拍校准。
    window.setTimeout(syncAll, 600);
  });

  // 图片/字体加载会改变页面高度，需重算能否回到顶部。
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => syncAll()).observe(document.body);
  }

  syncAll();
};

initFloatingStack();

export {};
