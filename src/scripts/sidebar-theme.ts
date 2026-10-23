import { prefersReducedMotion } from './input-modality';

const THEME_KEY = 'theme';
const THEME_MODE_KEY = 'theme-mode';
type Theme = 'light' | 'dark';
type ThemeMode = Theme | 'system';
type LegacyMediaQueryList = {
  addListener?: (listener: () => void) => void;
};

const root = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const colorSchemeMq = window.matchMedia('(prefers-color-scheme: dark)');

const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark';

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'system' || isTheme(value);

const getSystemTheme = (): Theme => colorSchemeMq.matches ? 'dark' : 'light';

const resolveTheme = (mode: ThemeMode): Theme =>
  mode === 'system' ? getSystemTheme() : mode;

const readThemeMode = (): ThemeMode => {
  try {
    const storedMode = localStorage.getItem(THEME_MODE_KEY);
    if (isThemeMode(storedMode)) return storedMode;

    const legacyTheme = localStorage.getItem(THEME_KEY);
    if (isTheme(legacyTheme)) return legacyTheme;
  } catch (_) {
    // 隐私模式/禁用存储：读不到就当作没有偏好，返回 system。
  }

  return 'system';
};

const writeThemeMode = (mode: ThemeMode) => {
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
    if (mode === 'system') {
      localStorage.removeItem(THEME_KEY);
    } else {
      localStorage.setItem(THEME_KEY, mode);
    }
  } catch (_) {
    // 隐私模式/禁用存储：写不进去也继续切主题，仅本次访问生效。
  }
};

const getNextThemeMode = (mode: ThemeMode): ThemeMode => {
  if (mode === 'system') return 'light';
  if (mode === 'light') return 'dark';
  return 'system';
};

const getThemeModeLabel = (mode: ThemeMode, theme: Theme): string => {
  if (mode === 'system') {
    return `跟随系统（${theme === 'dark' ? '深色模式' : '浅色模式'}）`;
  }

  return theme === 'dark' ? '深色模式' : '浅色模式';
};

const setControlLabel = (element: HTMLElement, label: string) => {
  element.setAttribute('aria-label', label);
  if (element.hasAttribute('data-tooltip')) {
    element.setAttribute('data-tooltip', label);
    element.removeAttribute('title');
    return;
  }
  element.setAttribute('title', label);
};

let activeThemeMode: ThemeMode = readThemeMode();

const applyTheme = (theme: Theme, mode: ThemeMode = activeThemeMode) => {
  root.dataset.theme = theme;
  root.dataset.themeMode = mode;
  const dark = theme === 'dark';
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', mode === 'system' ? 'mixed' : (dark ? 'true' : 'false'));
    const label = getThemeModeLabel(mode, theme);
    setControlLabel(themeBtn, label);
  }
};

const setThemeMode = (mode: ThemeMode, persist = true) => {
  activeThemeMode = mode;
  applyTheme(resolveTheme(mode), mode);
  if (persist) writeThemeMode(mode);
};

const listenSystemThemeChange = (listener: () => void) => {
  if (typeof colorSchemeMq.addEventListener === 'function') {
    colorSchemeMq.addEventListener('change', listener);
    return;
  }

  // 兼容只实现 addListener 的旧版 Safari / WebView。
  const legacyColorSchemeMq = colorSchemeMq as unknown as LegacyMediaQueryList;
  legacyColorSchemeMq.addListener?.(listener);
};

/**
 * 主题切换涟漪：切到亮色时新快照自按钮中心放大（`::view-transition-new(root)`），
 * 切到暗色时旧快照反向收缩回按钮中心（`::view-transition-old(root)`）；
 * 不支持 View Transitions 或偏好减少动效时直接切换。
 */
type ViewTransitionLike = { ready: Promise<void> };
type StartViewTransitionLike = (callback: () => void) => ViewTransitionLike;

const RIPPLE_DURATION_MS = 1040;
const RIPPLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
// 快照原点相对视口原点的合理上限；超出视为测量异常，不参与补偿。
const RIPPLE_ORIGIN_OFFSET_LIMIT_PX = 160;
// 透明探针元素在过渡期间以命名快照存在，用于读取快照坐标系的位置。
const RIPPLE_PROBE_NAME = 'theme-ripple-origin';

const getStartViewTransition = (): StartViewTransitionLike | null => {
  const candidate = (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  if (typeof candidate !== 'function') return null;
  // 必须以 document 为 this 调用，不能取裸函数。
  return (candidate as StartViewTransitionLike).bind(document);
};

type RipplePoint = { x: number; y: number };

// 圆心取主题切换按钮自身的中心；按钮缺失或量不到尺寸时回退到视口顶部中点。
const resolveRippleOrigin = (): RipplePoint => {
  const rect = themeBtn?.getBoundingClientRect();
  if (rect && (rect.width > 0 || rect.height > 0)) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  return { x: window.innerWidth / 2, y: 0 };
};

const clampRippleOffset = (value: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, 0), RIPPLE_ORIGIN_OFFSET_LIMIT_PX) : 0;

/**
 * 透明探针以命名快照参与过渡：新旧快照里它都在按钮中心，因此
 * `::view-transition-group()` 的位移可直接用来反推出快照坐标系。
 */
const createRippleProbe = (origin: RipplePoint): HTMLElement | null => {
  if (!document.body) return null;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position: fixed; left: ${origin.x}px; top: ${origin.y}px; width: 1px; height: 1px; background: transparent; pointer-events: none; view-transition-name: ${RIPPLE_PROBE_NAME};`;
  document.body.appendChild(probe);
  return probe;
};

const readPseudoPx = (pseudo: string, property: string): number | null => {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement, pseudo).getPropertyValue(property)
  );
  return Number.isFinite(value) ? value : null;
};

/**
 * 读取快照坐标系相对 layout viewport 的原点偏移。
 * 伪元素的参考盒是 snapshot containing block：带可收缩地址栏的移动浏览器会把它放在
 * 浏览器 UI 之下，原点因此高于 layout viewport。命名快照的 group 位移按规范以该
 * 坐标系为基准，减去元素自身的视口坐标就是这段偏移。桌面与当前以视口为坐标系的
 * iOS Safari 读数为 0，不会误补偿；读不到或数值异常时同样不补偿。
 */
const readRippleOriginOffset = (origin: RipplePoint): RipplePoint => {
  const transform = getComputedStyle(
    document.documentElement,
    `::view-transition-group(${RIPPLE_PROBE_NAME})`
  ).transform;
  const match = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!match) return { x: 0, y: 0 };

  const values = (match[1] ?? '').split(',').map((value) => Number.parseFloat(value));
  if (values.length !== 6) return { x: 0, y: 0 };

  const translateX = values[4];
  const translateY = values[5];
  if (
    translateX === undefined || translateY === undefined
    || !Number.isFinite(translateX) || !Number.isFinite(translateY)
  ) {
    return { x: 0, y: 0 };
  }

  return {
    x: clampRippleOffset(translateX - origin.x),
    y: clampRippleOffset(translateY - origin.y)
  };
};

// clip-path 的百分比按被动画伪元素的参考盒解析；该盒在桌面等于视口，在快照原点
// 高于视口的移动浏览器上是完整的 snapshot containing block。读不到时回退到视口尺寸。
const readRippleReferenceBox = (pseudo: string): { width: number; height: number } => {
  const width = readPseudoPx(pseudo, 'width');
  const height = readPseudoPx(pseudo, 'height');
  if (width && height && width > 0 && height > 0) return { width, height };

  return { width: window.innerWidth, height: window.innerHeight };
};

const resolveRippleCenter = (origin: RipplePoint, expanding: boolean): RipplePoint => {
  const pseudo = expanding ? '::view-transition-new(root)' : '::view-transition-old(root)';
  const box = readRippleReferenceBox(pseudo);
  const offset = readRippleOriginOffset(origin);
  const x = origin.x + offset.x;
  const y = origin.y + offset.y;

  return {
    x: (x / box.width) * 100,
    y: (y / box.height) * 100
  };
};

/**
 * 涟漪方向标记（`<html>` 的 `data-theme-ripple`）：`expand` 动画新快照，`converge` 动画旧快照，
 * 两个方向的层叠顺序不同（样式见 `global.css`）。
 */
const RIPPLE_ATTR = 'themeRipple';

type RippleSession = {
  probe: HTMLElement | null;
  previousDirection: string | undefined;
  inlineColorScheme: string;
  /** 极端内核可能既不 resolve 也不 reject `ready`，用超时兜底回收探针与标记。 */
  watchdog: number | undefined;
};

let activeRipple: RippleSession | null = null;

/**
 * 结束一次涟漪的共享状态。连续切换时新过渡会接管标记与 color-scheme，
 * 旧过渡的清理只能回收自己的探针，不能改回新过渡的状态。
 */
const endRippleSession = (session: RippleSession) => {
  if (session.watchdog !== undefined) window.clearTimeout(session.watchdog);
  session.probe?.remove();
  if (activeRipple !== session) return;

  activeRipple = null;
  if (session.previousDirection === undefined) delete root.dataset[RIPPLE_ATTR];
  else root.dataset[RIPPLE_ATTR] = session.previousDirection;
  if (session.inlineColorScheme) root.style.colorScheme = session.inlineColorScheme;
  else root.style.removeProperty('color-scheme');
};

const applyThemeWithRipple = (apply: () => void, targetTheme: Theme) => {
  const startViewTransition = getStartViewTransition();
  if (!startViewTransition || prefersReducedMotion()) {
    apply();
    return;
  }

  if (activeRipple) endRippleSession(activeRipple);

  const origin = resolveRippleOrigin();
  const session: RippleSession = {
    probe: null,
    previousDirection: root.dataset[RIPPLE_ATTR],
    inlineColorScheme: root.style.colorScheme,
    watchdog: undefined
  };
  activeRipple = session;
  // 探针必须在新旧快照拍摄前插入，否则 group 不存在，偏移读数会退化为 0。
  session.probe = createRippleProbe(origin);

  // 只有有效主题发生变化才会走到这里：切到亮色 = 发散（新快照从小圆放大到整屏），
  // 切到暗色 = 收缩（旧快照从整屏收到按钮中心）。
  const expanding = targetTheme === 'light';
  root.dataset[RIPPLE_ATTR] = expanding ? 'expand' : 'converge';

  /** 过渡期间把 `color-scheme` 钉在旧主题：View Transition 不拍滚动条快照，否则滚动条会先变新主题。 */
  const previousScheme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  root.style.colorScheme = previousScheme;

  const clearRippleFlag = () => endRippleSession(session);

  // circle() 的百分比半径按参考盒对角线的 1/sqrt(2) 解析，150% 从任意圆心都能覆盖视口。
  const radius = 150;

  let transition: ViewTransitionLike;
  try {
    transition = startViewTransition(apply);
  } catch (_) {
    // 过渡无法启动（文档状态或内核限制）时放弃本次涟漪，并回收探针与共享状态。
    clearRippleFlag();
    return;
  }

  // 动画本身 1040ms；留出两帧余量后兜底清理，避免异常内核让探针与标记长期残留。
  session.watchdog = window.setTimeout(clearRippleFlag, RIPPLE_DURATION_MS + 800);

  transition.ready
    .then(() => {
      const center = resolveRippleCenter(origin, expanding);
      const circle = (percent: number) => `circle(${percent}% at ${center.x}% ${center.y}%)`;
      const animation = document.documentElement.animate(
        {
          clipPath: expanding
            ? [circle(0), circle(radius)]
            : [circle(radius), circle(0)]
        },
        {
          duration: RIPPLE_DURATION_MS,
          easing: RIPPLE_EASING,
          pseudoElement: expanding
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)'
        }
      );
      animation.finished.then(clearRippleFlag, clearRippleFlag);
    })
    .catch(clearRippleFlag);
};

const initTheme = () => {
  setThemeMode(activeThemeMode, false);
  themeBtn?.addEventListener('click', () => {
    const nextMode = getNextThemeMode(activeThemeMode);
    const currentTheme = resolveTheme(activeThemeMode);
    const nextTheme = resolveTheme(nextMode);
    const apply = () => setThemeMode(nextMode);

    // 有效主题未变（如亮色 → 跟随系统且系统为浅色）时不跑涟漪，直接切换模式。
    if (nextTheme === currentTheme) {
      apply();
      return;
    }

    applyThemeWithRipple(apply, nextTheme);
  });

  const syncSystemTheme = () => {
    if (activeThemeMode === 'system') setThemeMode('system', false);
  };

  listenSystemThemeChange(syncSystemTheme);
};

initTheme();

export {};
