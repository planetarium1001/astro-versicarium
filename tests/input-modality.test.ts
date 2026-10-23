// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 输入模态标记的行为：媒体查询区分不了真鼠标与「上报 hover: hover 的触屏」，
 * 样式层靠 <html data-input> 判断，因此这里守住标记本身。
 * 重点是触屏 tap 之后浏览器补发的兼容鼠标事件——WebKit 会把它报成
 * pointerType: 'mouse' 的 PointerEvent，标记不能被它翻回 mouse。
 */

const load = async () => {
  vi.resetModules();
  await import('../src/scripts/input-modality');
};

const modality = () => document.documentElement.dataset.input;

/** jsdom 没有 PointerEvent 构造器：用普通事件补上 pointerType 即可。 */
const dispatchPointer = (type: 'pointerdown' | 'pointermove', pointerType: string) => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  window.dispatchEvent(event);
};

const touch = () => window.dispatchEvent(new Event('touchstart', { bubbles: true }));
const mouseMove = () => window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

describe('输入模态标记', () => {
  let now = 0;
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    now = 0;
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    delete document.documentElement.dataset.input;
  });

  afterEach(() => {
    nowSpy.mockRestore();
    vi.resetModules();
    delete document.documentElement.dataset.input;
  });

  it('touchstart 标记为 touch', async () => {
    await load();
    touch();
    expect(modality()).toBe('touch');
  });

  it('pointerdown 按 pointerType 区分 touch 与 mouse', async () => {
    await load();
    now = 5000;
    dispatchPointer('pointerdown', 'touch');
    expect(modality()).toBe('touch');

    now = 10000;
    dispatchPointer('pointerdown', 'mouse');
    expect(modality()).toBe('mouse');
  });

  it('触屏 tap 的兼容鼠标事件不把模态翻回 mouse（WebKit 事件序列）', async () => {
    await load();
    now = 1000;
    dispatchPointer('pointerdown', 'touch');
    touch();
    now = 1010;
    mouseMove();
    dispatchPointer('pointerdown', 'mouse');
    dispatchPointer('pointermove', 'mouse');
    mouseMove();
    expect(modality()).toBe('touch');
  });

  it('键盘 Tab 只打 keyboard 标记，不解除触屏 hover 门禁', async () => {
    await load();
    now = 1000;
    touch();
    expect(modality()).toBe('touch');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(modality()).toBe('touch');
    expect(document.documentElement.dataset.keyboard).toBe('true');
    // 真实指针输入后键盘标记解除
    now = 5000;
    dispatchPointer('pointerdown', 'mouse');
    expect(document.documentElement.dataset.keyboard).toBeUndefined();
  });

  it('非 Tab 按键不会打 keyboard 标记', async () => {
    await load();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.documentElement.dataset.keyboard).toBeUndefined();
  });

  it('超过兼容窗口后鼠标移动恢复 mouse（混合设备）', async () => {
    await load();
    now = 1000;
    touch();
    now = 1100;
    dispatchPointer('pointermove', 'mouse');
    expect(modality()).toBe('touch');

    now = 1000 + 801;
    dispatchPointer('pointermove', 'mouse');
    expect(modality()).toBe('mouse');
  });

  it('桌面首次移动即标记为 mouse', async () => {
    await load();
    now = 5000;
    dispatchPointer('pointermove', 'mouse');
    expect(modality()).toBe('mouse');
  });

  it('重复的同一模态不反复写属性', async () => {
    await load();
    now = 5000;
    dispatchPointer('pointerdown', 'mouse');
    const writes: string[] = [];
    const observer = new MutationObserver((records) => {
      records.forEach((record) => writes.push(record.attributeName ?? ''));
    });
    observer.observe(document.documentElement, { attributes: true });
    now = 6000;
    dispatchPointer('pointermove', 'mouse');
    dispatchPointer('pointermove', 'mouse');
    await Promise.resolve();
    observer.disconnect();
    expect(writes).toEqual([]);
  });
});
