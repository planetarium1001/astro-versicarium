/**
 * 列表页描述行：描述与「计数 + RSS + 标签入口」同一行时补「·」，
 * 整组回退到第二行时去掉；是否放得下由浏览器布局决定，不用固定断点猜。
 *
 * 分隔符在样式里是绝对定位（见 entry-tags.css），不参与 flex 布局，
 * 因此“去掉点就能放下、放下又加点”的来回抖动不会发生。
 */

const LINE_TOLERANCE_PX = 2;
const INLINE_ATTR = 'data-meta-inline';

/** 根据当前布局同步「描述 + 计数组」是否仍在同一行。 */
export const syncPageSubtitleFit = (root: HTMLElement): void => {
  const desc = root.querySelector<HTMLElement>('.page-subtitle__text');
  const meta = root.querySelector<HTMLElement>('.page-subtitle__meta');
  // 计数组可能只挂着空的 slot：没有可见内容时不补点，避免描述后面出现孤立「·」。
  if (!desc || !meta || !(meta.textContent ?? '').trim()) {
    root.removeAttribute(INLINE_ATTR);
    return;
  }
  const inline = meta.getBoundingClientRect().top <= desc.getBoundingClientRect().top + LINE_TOLERANCE_PX;
  root.toggleAttribute(INLINE_ATTR, inline);
};

/**
 * 监听页头描述行：容器宽度变化（旋转、窗口缩放）、计数组文案变化
 * （客户端筛选更新计数）与字体加载完成都会重新判定。
 */
const initPageSubtitleFit = (): void => {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('.page-subtitle--entry-filters'));
  if (roots.length === 0) return;

  const syncAll = () => {
    roots.forEach(syncPageSubtitleFit);
  };

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(syncAll);
    roots.forEach((root) => {
      observer.observe(root);
      root.querySelectorAll('.page-subtitle__text, .page-subtitle__meta').forEach((el) => observer.observe(el));
    });
  } else {
    // 旧内核或测试环境没有 ResizeObserver：退化为窗口尺寸变化时重算。
    window.addEventListener('resize', syncAll);
  }

  // 字体替换会改变文案宽度，加载完成后再量一次。
  if (document.fonts?.ready) {
    document.fonts.ready.then(syncAll).catch(() => {});
  }

  syncAll();
};

initPageSubtitleFit();
