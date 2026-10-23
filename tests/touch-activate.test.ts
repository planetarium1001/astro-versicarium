// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindTouchActivate,
  TOUCH_ACTIVATE_CLICK_DEDUPE_MS,
  TOUCH_ACTIVATE_MAX_DISTANCE_PX,
  TOUCH_ACTIVATE_MAX_DURATION_MS
} from '../src/scripts/touch-activate';

/**
 * 触摸兜底绑定器：华为等内核会吞掉浮动列按钮的 click，但 pointer 事件正常到达。
 * 这里直接驱动 DOM 事件断言四条路径（touch / pen / mouse / 键盘）与放弃条件，
 * 不依赖真实浏览器。
 */

const button = () => {
  const element = document.getElementById('target');
  if (!(element instanceof HTMLButtonElement)) throw new Error('测试按钮缺失');
  return element;
};

const pointerEvent = (
  type: string,
  init: { x?: number; y?: number; pointerType?: string; pointerId?: number; button?: number } = {}
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x ?? 10,
    clientY: init.y ?? 10,
    button: init.button ?? 0
  });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'touch' });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  return event;
};

const clickEvent = (init: { pointerType?: string; detail?: number } = {}) => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    detail: init.detail ?? 1
  });
  if (init.pointerType) Object.defineProperty(event, 'pointerType', { value: init.pointerType });
  return event;
};

const touchTap = (element: HTMLElement, at = { x: 10, y: 10 }) => {
  element.dispatchEvent(pointerEvent('pointerdown', at));
  element.dispatchEvent(pointerEvent('pointerup', at));
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  document.body.innerHTML = '<button id="target" type="button">目标</button>';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('touch-activate：触摸兜底触发', () => {
  it('阈值与去重窗口与契约一致', () => {
    expect(TOUCH_ACTIVATE_MAX_DISTANCE_PX).toBe(8);
    expect(TOUCH_ACTIVATE_MAX_DURATION_MS).toBe(650);
    expect(TOUCH_ACTIVATE_CLICK_DEDUPE_MS).toBe(500);
  });

  it('touch pointerdown + pointerup 只触发一次，随后原生 click 不重复', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    touchTap(button());
    expect(activate).toHaveBeenCalledTimes(1);

    // 未吞 click 的浏览器（Chrome/Via）会继续补发 click，必须被去重
    button().dispatchEvent(clickEvent({ pointerType: 'touch' }));
    expect(activate, '同一次触摸的 click 不得重复触发').toHaveBeenCalledTimes(1);
  });

  it('pen 与 touch 同样走兜底', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    button().dispatchEvent(pointerEvent('pointerdown', { pointerType: 'pen' }));
    button().dispatchEvent(pointerEvent('pointerup', { pointerType: 'pen' }));
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('mouse 的 pointer 事件不触发，原生 click 走一次', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    button().dispatchEvent(pointerEvent('pointerdown', { pointerType: 'mouse' }));
    button().dispatchEvent(pointerEvent('pointerup', { pointerType: 'mouse' }));
    expect(activate, '鼠标不应被 pointer 兜底触发').toHaveBeenCalledTimes(0);

    button().dispatchEvent(clickEvent({ pointerType: 'mouse' }));
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('键盘 / 脚本 click（detail=0）即使在触摸去重窗口内也放行', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    touchTap(button());
    expect(activate).toHaveBeenCalledTimes(1);

    button().dispatchEvent(clickEvent({ detail: 0 }));
    expect(activate, '键盘点击不能被触摸去重误伤').toHaveBeenCalledTimes(2);
  });

  it('去重窗口结束后，新的点击重新触发', async () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate, { clickDedupeMs: 20 });

    touchTap(button());
    await sleep(30);
    button().dispatchEvent(clickEvent({ pointerType: 'touch' }));
    expect(activate).toHaveBeenCalledTimes(2);
  });
});

describe('touch-activate：放弃条件', () => {
  it('位移超过 8px 不触发（pointermove 提前放弃）', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    button().dispatchEvent(pointerEvent('pointerdown', { x: 10, y: 10 }));
    button().dispatchEvent(pointerEvent('pointermove', { x: 25, y: 10 }));
    button().dispatchEvent(pointerEvent('pointerup', { x: 25, y: 10 }));
    expect(activate).toHaveBeenCalledTimes(0);
  });

  it('按下与抬起位置相差超过 8px 不触发', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    button().dispatchEvent(pointerEvent('pointerdown', { x: 10, y: 10 }));
    button().dispatchEvent(pointerEvent('pointerup', { x: 20, y: 10 }));
    expect(activate).toHaveBeenCalledTimes(0);
  });

  it('按压时长超过上限不触发（长按菜单场景）', async () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate, { maxDurationMs: 20 });

    button().dispatchEvent(pointerEvent('pointerdown'));
    await sleep(40);
    button().dispatchEvent(pointerEvent('pointerup'));
    expect(activate).toHaveBeenCalledTimes(0);
  });

  it('pointercancel 不触发', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    button().dispatchEvent(pointerEvent('pointerdown'));
    button().dispatchEvent(pointerEvent('pointercancel'));
    button().dispatchEvent(pointerEvent('pointerup'));
    expect(activate).toHaveBeenCalledTimes(0);
  });

  it('第二根手指按下时忽略，不产生重复触发', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    button().dispatchEvent(pointerEvent('pointerdown', { pointerId: 1 }));
    button().dispatchEvent(pointerEvent('pointerdown', { pointerId: 2 }));
    button().dispatchEvent(pointerEvent('pointerup', { pointerId: 2 }));
    expect(activate).toHaveBeenCalledTimes(0);
    button().dispatchEvent(pointerEvent('pointerup', { pointerId: 1 }));
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('不改事件默认行为（不 preventDefault），激活回调收到原始事件', () => {
    const activate = vi.fn();
    bindTouchActivate(button(), activate);

    const down = pointerEvent('pointerdown');
    const up = pointerEvent('pointerup');
    button().dispatchEvent(down);
    button().dispatchEvent(up);
    expect(down.defaultPrevented, '兜底不能阻止滚动/系统手势').toBe(false);
    expect(up.defaultPrevented).toBe(false);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate.mock.calls[0]?.[0]).toBe(up);
  });

  it('disabled 时 pointer 与 click 都不触发，恢复后正常', () => {
    const activate = vi.fn();
    let disabled = true;
    bindTouchActivate(button(), activate, { disabled: () => disabled });

    touchTap(button());
    button().dispatchEvent(clickEvent({ pointerType: 'touch' }));
    expect(activate).toHaveBeenCalledTimes(0);

    disabled = false;
    touchTap(button());
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('解绑后不再响应任何路径', () => {
    const activate = vi.fn();
    const unbind = bindTouchActivate(button(), activate);
    unbind();

    touchTap(button());
    button().dispatchEvent(clickEvent({ pointerType: 'touch' }));
    expect(activate).toHaveBeenCalledTimes(0);
  });
});
