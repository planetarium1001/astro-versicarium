// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncPageSubtitleFit } from '../src/scripts/page-subtitle';

/**
 * 描述行「·」的自适应：jsdom 不做布局，这里用固定 rect 模拟
 * 「同一行」与「整组回退第二行」两种结果，断言脚本只按布局结果补/去分隔点。
 */

const buildSubtitle = () => {
  document.body.innerHTML = `
    <span class="page-subtitle page-subtitle--entry-filters">
      <span class="page-subtitle__text">按提交记录主题的每一次改动</span>
      <span class="page-subtitle__meta">
        <span class="page-subtitle__count" data-page-subtitle-count>共 8 条更新</span>
      </span>
    </span>`;
  return document.querySelector<HTMLElement>('.page-subtitle--entry-filters')!;
};

const stubLineTops = (descTop: number, metaTop: number) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = this.classList.contains('page-subtitle__meta') ? metaTop : descTop;
    const rect = {
      top,
      bottom: top + 20,
      left: 0,
      right: 120,
      width: 120,
      height: 20,
      x: 0,
      y: top,
      toJSON: () => ({})
    };
    return rect as DOMRect;
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('描述行分隔点自适应', () => {
  it('描述与计数组同一行时补 data-meta-inline（样式据此显示「·」）', () => {
    const root = buildSubtitle();
    stubLineTops(40, 40);
    syncPageSubtitleFit(root);
    expect(root.hasAttribute('data-meta-inline')).toBe(true);
  });

  it('计数组回退到第二行时去掉 data-meta-inline（行末不留「·」）', () => {
    const root = buildSubtitle();
    stubLineTops(40, 66);
    syncPageSubtitleFit(root);
    expect(root.hasAttribute('data-meta-inline')).toBe(false);
  });

  it('布局变化后可双向切换', () => {
    const root = buildSubtitle();
    stubLineTops(40, 66);
    syncPageSubtitleFit(root);
    expect(root.hasAttribute('data-meta-inline')).toBe(false);

    vi.restoreAllMocks();
    stubLineTops(40, 40);
    syncPageSubtitleFit(root);
    expect(root.hasAttribute('data-meta-inline')).toBe(true);
  });

  it('缺少计数组时清掉标记，不抛错', () => {
    document.body.innerHTML = `
      <span class="page-subtitle page-subtitle--entry-filters" data-meta-inline>
        <span class="page-subtitle__text">描述</span>
      </span>`;
    const root = document.querySelector<HTMLElement>('.page-subtitle--entry-filters')!;
    expect(() => syncPageSubtitleFit(root)).not.toThrow();
    expect(root.hasAttribute('data-meta-inline')).toBe(false);
  });
});
