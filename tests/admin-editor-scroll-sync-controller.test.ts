import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditorScrollSyncController,
  type EditorScrollSyncController
} from '../src/components/admin/editor/shared/editor-scroll-sync';
import type { EditorScrollSource } from '../src/components/admin/editor/shared/editor-shell-helpers';

type FrameCallback = (time: number) => void;

const createWindowStub = () => {
  const frames = new Map<number, FrameCallback>();
  const timers = new Map<number, () => void>();
  let nextFrameId = 1;
  let nextTimerId = 1;

  const windowStub = {
    requestAnimationFrame: vi.fn((callback: FrameCallback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frames.set(frameId, callback);
      return frameId;
    }),
    cancelAnimationFrame: vi.fn((frameId: number) => {
      frames.delete(frameId);
    }),
    setTimeout: vi.fn((callback: () => void) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, callback);
      return timerId;
    }),
    clearTimeout: vi.fn((timerId: number) => {
      timers.delete(timerId);
    })
  };

  const flushAnimationFrames = (maxFrames = 10) => {
    for (let frameIndex = 0; frameIndex < maxFrames && frames.size > 0; frameIndex += 1) {
      const pendingCallbacks = [...frames.values()];
      frames.clear();
      pendingCallbacks.forEach((callback) => callback(0));
    }
  };

  return {
    windowStub,
    flushAnimationFrames,
    pendingFrameCount: () => frames.size
  };
};

type ScrollElementOptions = {
  scrollHeight: number;
  clientHeight: number;
  scrollTop?: number;
  /** 模拟目标元素可达范围比几何尺寸更小（例如布局或 clamp 变化）。 */
  maxScrollTop?: number;
};

const createScrollElement = ({
  scrollHeight,
  clientHeight,
  scrollTop = 0,
  maxScrollTop
}: ScrollElementOptions): HTMLElement => {
  const element = { dataset: {}, scrollHeight, clientHeight } as unknown as HTMLElement;
  let currentScrollTop = scrollTop;

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      const upperBound = maxScrollTop ?? Math.max(0, element.scrollHeight - element.clientHeight);
      currentScrollTop = Math.min(Math.max(0, value), upperBound);
    }
  });

  return element;
};

type HarnessOptions = {
  previewMaxScrollTop?: number;
  previewScrollHeight?: number;
  bodyMaxScrollTop?: number;
  bodyScrollHeight?: number;
};

const createHarness = (options: HarnessOptions = {}) => {
  const { windowStub, flushAnimationFrames, pendingFrameCount } = createWindowStub();
  vi.stubGlobal('window', windowStub);

  const elements: Record<EditorScrollSource, HTMLElement> = {
    body: createScrollElement({
      scrollHeight: options.bodyScrollHeight ?? 1000,
      clientHeight: 400,
      ...(options.bodyMaxScrollTop === undefined ? {} : { maxScrollTop: options.bodyMaxScrollTop })
    }),
    preview: createScrollElement({
      scrollHeight: options.previewScrollHeight ?? 3000,
      clientHeight: 400,
      ...(options.previewMaxScrollTop === undefined ? {} : { maxScrollTop: options.previewMaxScrollTop })
    })
  };
  const state = { enabled: true, available: true };

  const controller: EditorScrollSyncController = createEditorScrollSyncController({
    getScrollElement: (source) => elements[source],
    isEnabled: () => state.enabled,
    setEnabled: (enabled) => {
      state.enabled = enabled;
    },
    isAvailable: () => state.available,
    scrollbarVisibilityTimeoutMs: 800
  });

  return {
    controller,
    body: elements.body,
    preview: elements.preview,
    state,
    flushAnimationFrames,
    pendingFrameCount
  };
};

describe('admin editor scroll sync controller', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('reaches the bottom without bouncing when the target echo arrives late', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness();

    body.scrollTop = 600;
    controller.handlePaneScroll('body');
    flushAnimationFrames();

    expect(preview.scrollTop).toBe(2600);
    expect(pendingFrameCount()).toBe(0);

    // 写入帧早已结束，目标的 scroll 事件此时才到：旧实现会把它当用户滚动反推 body。
    controller.handlePaneScroll('preview');

    expect(body.scrollTop).toBe(600);
    expect(preview.scrollTop).toBe(2600);
    expect(pendingFrameCount()).toBe(0);
  });

  it('does not roll the source back when a late target echo races an ongoing source scroll', () => {
    const { controller, body, preview, flushAnimationFrames } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    // 用户继续把 source 滚到 45%，紧接着上一个目标写入的回声才到达。
    body.scrollTop = 450;
    controller.handlePaneScroll('body');
    controller.handlePaneScroll('preview');
    flushAnimationFrames();

    expect(body.scrollTop).toBe(450);
    expect(preview.scrollTop).toBeCloseTo(1950);
  });

  it('ignores a stale echo that arrives after a newer sync write', () => {
    const { controller, body, preview, flushAnimationFrames } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    body.scrollTop = 450;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1950);

    // 旧回声晚到：preview 回填到 1300，队列里仍保留着这次写入的期望值。
    preview.scrollTop = 1300;
    controller.handlePaneScroll('preview');
    flushAnimationFrames();

    expect(body.scrollTop).toBe(450);
    expect(preview.scrollTop).toBe(1300);
  });

  it('switches the sync source when the user scrolls the target outside pending echoes', () => {
    const { controller, body, preview, flushAnimationFrames } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();

    body.scrollTop = 450;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1950);

    preview.scrollTop = 800;
    controller.handlePaneScroll('preview');
    flushAnimationFrames();

    expect(preview.scrollTop).toBe(800);
    expect(body.scrollTop).toBeCloseTo(600 * (800 / 2600));
  });

  it('does not register an echo when a write is clamped to the current scrollTop', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness({
      previewMaxScrollTop: 1000
    });

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1000);

    // 先消费第一次写入的回声，队列清空。
    controller.handlePaneScroll('preview');
    expect(pendingFrameCount()).toBe(0);

    // 第二次写入被 clamp 到相同位置：没有 scroll 事件，也不应留下回声。
    body.scrollTop = 500;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1000);

    // 随后的 0.5px 用户滚动必须被当作真实滚动，不能被陈旧回声吞掉。
    preview.scrollTop = 999.5;
    controller.handlePaneScroll('preview');
    expect(pendingFrameCount()).toBe(1);
  });

  it('snaps the target to its exact max when the source reaches a fractional bottom', () => {
    const { controller, body, preview, flushAnimationFrames } = createHarness({
      bodyScrollHeight: 1000.5,
      bodyMaxScrollTop: 600.2,
      previewScrollHeight: 3000.75
    });

    expect(body.scrollHeight - body.clientHeight).toBe(600.5);
    body.scrollTop = 600.2;
    controller.handlePaneScroll('body');
    flushAnimationFrames();

    // 源几何 max 是 600.5、可达 600.2（1px 内算到底），目标应精确落到自己的 max。
    expect(preview.scrollTop).toBe(preview.scrollHeight - preview.clientHeight);
    expect(preview.scrollTop).toBe(2600.75);
  });

  it('clears stale echoes when the external guard turns on', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    // 预览恢复/目录跳转前的 guard 必须清空旧回声，避免释放后吞掉用户滚动。
    controller.setGuarded(true);
    controller.releaseGuard(1);
    flushAnimationFrames();

    preview.scrollTop = 1300.5;
    controller.handlePaneScroll('preview');
    expect(pendingFrameCount()).toBe(1);
  });

  it('drops echoes that outlive the short suppression window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    vi.setSystemTime(1000);
    preview.scrollTop = 1300.5;
    controller.handlePaneScroll('preview');
    expect(pendingFrameCount()).toBe(1);
  });

  it('does not move the target backwards when the source max grows during forward scrolling', () => {
    const { controller, body, preview, flushAnimationFrames } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    // CodeMirror 在滚动中修正内容高度：body max 从 600 变成 900。
    // 按比例重算会得到 1155（回退），方向保护必须让它保持在 1300。
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 1300 });
    body.scrollTop = 400;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    body.scrollTop = 800;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBeCloseTo(2600 * (800 / 900));

    body.scrollTop = 900;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(2600);
  });

  it('allows the target to move backwards when the source scrolls backwards', () => {
    const { controller, body, preview, flushAnimationFrames } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    body.scrollTop = 150;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBeCloseTo(650);
  });

  it('records the clamped scrollTop of the target and ignores its echo', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness({
      previewMaxScrollTop: 1000
    });

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();

    // 期望写入 1300，但目标实际只能到 1000：回声队列记录的必须是读回值。
    expect(preview.scrollTop).toBe(1000);
    expect(pendingFrameCount()).toBe(0);

    controller.handlePaneScroll('preview');

    expect(body.scrollTop).toBe(300);
    expect(preview.scrollTop).toBe(1000);
    expect(pendingFrameCount()).toBe(0);

    controller.queueLastSource();
    flushAnimationFrames();
    expect(body.scrollTop).toBe(300);
  });

  it('switches the sync source when the user really scrolls the target', () => {
    const { controller, body, preview, flushAnimationFrames } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    // 用户主动滚动目标：值在回声队列之外，队列清空并正常切换同步源。
    preview.scrollTop = 2000;
    controller.handlePaneScroll('preview');
    flushAnimationFrames();

    expect(preview.scrollTop).toBe(2000);
    expect(body.scrollTop).toBeCloseTo(600 * (2000 / 2600));
  });

  it('treats a 1px drift as the programmatic echo and anything larger as user scroll', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    // 允许 1px clamp 容差内仍算回声。
    preview.scrollTop = 1301;
    controller.handlePaneScroll('preview');
    expect(pendingFrameCount()).toBe(0);

    // 超过 1px 视为用户滚动，重新切换来源。
    preview.scrollTop = 1305;
    controller.handlePaneScroll('preview');
    expect(pendingFrameCount()).toBe(1);
  });

  it('marks both panes when scrolling to top so their echo events are ignored', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness();

    body.scrollTop = 300;
    preview.scrollTop = 1300;
    controller.scrollToTop('both');

    expect(body.scrollTop).toBe(0);
    expect(preview.scrollTop).toBe(0);

    controller.handlePaneScroll('body');
    controller.handlePaneScroll('preview');

    expect(body.scrollTop).toBe(0);
    expect(preview.scrollTop).toBe(0);
    expect(pendingFrameCount()).toBe(0);

    // 回声被消费后，真实用户滚动仍能正常切换同步源。
    preview.scrollTop = 260;
    controller.handlePaneScroll('preview');
    flushAnimationFrames();

    expect(body.scrollTop).toBeCloseTo(60);
  });

  it('keeps the external preview-refresh guard independent from per-element suppression', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness();

    controller.setGuarded(true);
    preview.scrollTop = 500;
    controller.handlePaneScroll('preview');

    expect(pendingFrameCount()).toBe(0);
    expect(body.scrollTop).toBe(0);

    controller.releaseGuard(1);
    flushAnimationFrames();

    // guard 释放后，用户真实滚动目标必须重新生效，不能被残留标记吞掉。
    preview.scrollTop = 800;
    controller.handlePaneScroll('preview');
    flushAnimationFrames();

    expect(body.scrollTop).toBeCloseTo(600 * (800 / 2600));
  });

  it('does not sync panes when sync scrolling is disabled', () => {
    const { controller, body, preview, state, flushAnimationFrames, pendingFrameCount } = createHarness();

    state.enabled = false;
    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();

    expect(preview.scrollTop).toBe(0);
    expect(pendingFrameCount()).toBe(0);
  });

  it('clears pending programmatic echoes when elements are cleared or the controller is destroyed', () => {
    const { controller, body, preview, flushAnimationFrames, pendingFrameCount } = createHarness();

    body.scrollTop = 300;
    controller.handlePaneScroll('body');
    flushAnimationFrames();
    expect(preview.scrollTop).toBe(1300);

    controller.clearElement(preview);
    controller.handlePaneScroll('preview');
    // 回声队列已随元素清理移除，该事件按真实滚动处理并重新排队。
    expect(pendingFrameCount()).toBe(1);

    flushAnimationFrames();
    controller.destroy();
    expect(pendingFrameCount()).toBe(0);
  });
});
