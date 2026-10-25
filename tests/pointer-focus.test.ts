// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { markPointerFocus } from '../src/scripts/pointer-focus';

/**
 * 指针焦点标记的监听管理。
 *
 * `markPointerFocus` 在关闭弹窗/灯箱时被调用，同一元素可能在一轮关闭流程里被标记多次。
 * 每次调用都新建 `clear` 闭包，而 `addEventListener` 按函数身份去重——闭包不同就会叠加监听，
 * 所以幂等必须显式做。这里守住「监听数量不随调用次数增长」。
 */

const mounted: HTMLElement[] = [];

const mountButton = (): HTMLButtonElement => {
  const button = document.createElement('button');
  document.body.appendChild(button);
  mounted.push(button);
  return button;
};

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
  vi.restoreAllMocks();
});

describe('指针焦点标记', () => {
  it('重复标记同一元素只注册一组监听', () => {
    const button = mountButton();
    const added: string[] = [];
    const addSpy = vi.spyOn(button, 'addEventListener');
    addSpy.mockImplementation(((type: string) => {
      added.push(type);
    }) as never);

    markPointerFocus(button);
    markPointerFocus(button);
    markPointerFocus(button);

    // 幂等：三次标记只挂 keydown + blur 各一次
    expect(added.filter((type) => type === 'keydown')).toHaveLength(1);
    expect(added.filter((type) => type === 'blur')).toHaveLength(1);
    expect(button.hasAttribute('data-pointer-focus')).toBe(true);
  });

  it('一次键盘事件清除标记，之后可重新标记', () => {
    const button = mountButton();

    markPointerFocus(button);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(button.hasAttribute('data-pointer-focus'), '键盘导航后应清除标记').toBe(false);

    markPointerFocus(button);
    expect(button.hasAttribute('data-pointer-focus'), '清理后重新标记应生效').toBe(true);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(button.hasAttribute('data-pointer-focus')).toBe(false);
  });

  it('失焦同样清除标记', () => {
    const button = mountButton();

    markPointerFocus(button);
    button.dispatchEvent(new FocusEvent('blur'));
    expect(button.hasAttribute('data-pointer-focus'), '失焦后应清除标记').toBe(false);
  });

  it('非元素输入不抛错', () => {
    expect(() => markPointerFocus(null)).not.toThrow();
  });
});
