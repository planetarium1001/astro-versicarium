// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateListSwap, canAnimate, cancelListSwap } from '../src/scripts/list-swap';

type FakeAnimation = {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finished: Promise<void>;
  canceled: boolean;
  resolve: () => void;
  reject: (error?: unknown) => void;
  cancel: () => void;
};

let animations: FakeAnimation[] = [];
let reducedMotion = false;

const createFakeAnimation = (keyframes: Keyframe[], options: KeyframeAnimationOptions): FakeAnimation => {
  let resolveFinished = () => {};
  let rejectFinished: (error?: unknown) => void = () => {};
  let settled = false;
  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    rejectFinished = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
  });

  const record = {
    keyframes,
    options,
    finished,
    canceled: false,
    resolve: resolveFinished,
    reject: rejectFinished,
    cancel: () => {
      record.canceled = true;
      rejectFinished(new Error('animation canceled'));
    }
  } as FakeAnimation;
  return record;
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const mount = () => {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
};

describe('列表整块换页过渡', () => {
  beforeEach(() => {
    animations = [];
    reducedMotion = false;
    // jsdom 不实现 matchMedia 与 WAAPI；只替换本用例需要的部分。
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }));
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: (
        keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
        options?: number | KeyframeAnimationOptions
      ) => {
        const record = createFakeAnimation(
          Array.isArray(keyframes) ? (keyframes as Keyframe[]) : [],
          (typeof options === 'object' && options !== null ? options : {}) as KeyframeAnimationOptions
        );
        animations.push(record);
        return record as unknown as Animation;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (Element.prototype as { animate?: unknown }).animate;
    document.body.innerHTML = '';
  });

  it('减少动效时同步落状态，不创建动画', () => {
    reducedMotion = true;
    const element = mount();
    const apply = vi.fn();

    expect(canAnimate(element)).toBe(false);
    animateListSwap(element, apply);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(animations).toHaveLength(0);
  });

  it('环境不支持 WAAPI 时同步落状态', () => {
    delete (Element.prototype as { animate?: unknown }).animate;
    const element = mount();
    const apply = vi.fn();

    expect(canAnimate(element)).toBe(false);
    animateListSwap(element, apply);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(animations).toHaveLength(0);
  });

  it('先淡出 110ms，落状态后再淡入 180ms', async () => {
    const element = mount();
    const apply = vi.fn();

    animateListSwap(element, apply);

    expect(apply).not.toHaveBeenCalled();
    expect(animations).toHaveLength(1);
    expect(animations[0]!.options.duration).toBe(110);
    expect(animations[0]!.options.fill).toBe('forwards');
    expect(animations[0]!.keyframes[0]).toMatchObject({ opacity: 1, transform: 'translateY(0)' });
    expect(animations[0]!.keyframes[1]).toMatchObject({ opacity: 0, transform: 'translateY(-4px)' });

    animations[0]!.resolve();
    await flushMicrotasks();

    expect(apply).toHaveBeenCalledTimes(1);
    // 淡出的 forwards 效果必须先撤掉，否则会压住淡入后的透明度
    expect(animations[0]!.canceled).toBe(true);
    expect(animations).toHaveLength(2);
    expect(animations[1]!.options.duration).toBe(180);
    expect(animations[1]!.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateY(4px)' });
    expect(animations[1]!.keyframes[1]).toMatchObject({ opacity: 1, transform: 'translateY(0)' });
  });

  it('动画被外部中断时仍然落状态', async () => {
    const element = mount();
    const apply = vi.fn();

    animateListSwap(element, apply);
    animations[0]!.reject(new Error('interrupted'));
    await flushMicrotasks();

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('连续触发时取消上一轮，只落最新一页的状态', async () => {
    const element = mount();
    const firstApply = vi.fn();
    const secondApply = vi.fn();

    animateListSwap(element, firstApply);
    animateListSwap(element, secondApply);

    expect(animations[0]!.canceled).toBe(true);
    await flushMicrotasks();
    expect(firstApply).not.toHaveBeenCalled();

    animations[1]!.resolve();
    await flushMicrotasks();
    expect(secondApply).toHaveBeenCalledTimes(1);
    expect(firstApply).not.toHaveBeenCalled();
  });

  it('直接取消时不再落状态（调用方自行同步渲染）', async () => {
    const element = mount();
    const apply = vi.fn();

    animateListSwap(element, apply);
    cancelListSwap(element);
    await flushMicrotasks();

    expect(animations[0]!.canceled).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });
});
