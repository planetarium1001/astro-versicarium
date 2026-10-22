import { describe, expect, it, vi } from 'vitest';
import {
  applyPreviewHtmlPreservingScroll,
  captureEditorScrollSnapshot,
  EDITOR_PREVIEW_SCROLL_GUARD_RELEASE_FRAMES,
  getEditorScrollRestoreTop,
  restoreEditorScrollSnapshot,
  type EditorPreviewScrollRefreshHooks,
  type EditorScrollSnapshot
} from '../src/components/admin/editor/shared/editor-shell-helpers';

const createScrollElement = (
  scrollHeight: number,
  clientHeight: number,
  scrollTop = 0
): HTMLElement => ({ scrollHeight, clientHeight, scrollTop }) as unknown as HTMLElement;

const createRefreshHooks = (
  overrides: Partial<EditorPreviewScrollRefreshHooks> = {},
  order: string[] = []
): EditorPreviewScrollRefreshHooks => ({
  captureScrollPosition: () => {
    order.push('capture');
    return null;
  },
  applyHtml: () => order.push('apply-html'),
  waitForRender: async () => {
    order.push('render');
  },
  restoreScrollPosition: () => order.push('restore'),
  waitForLayoutSettle: async () => {
    order.push('settle');
  },
  cancelQueuedScrollSync: () => order.push('cancel'),
  setScrollSyncGuarded: (guarded) => order.push(`guard:${guarded}`),
  releaseScrollSyncGuard: (frameDelay) => order.push(`release:${frameDelay}`),
  isScrollSyncActive: () => false,
  realignScrollSync: () => order.push('realign'),
  ...overrides
});

describe('admin editor scroll sync helpers', () => {
  it('captures the middle reading position as a ratio of the scrollable distance', () => {
    const snapshot = captureEditorScrollSnapshot(createScrollElement(2000, 400, 400));

    expect(snapshot).toEqual({
      scrollTop: 400,
      scrollHeight: 2000,
      clientHeight: 400,
      scrollRatio: 0.25
    });
  });

  it('restores a middle position proportionally when refreshed content gets taller', () => {
    const snapshot = captureEditorScrollSnapshot(createScrollElement(2000, 400, 400));
    const refreshedElement = createScrollElement(3000, 400);

    expect(getEditorScrollRestoreTop(snapshot, refreshedElement)).toBe(650);
    expect(restoreEditorScrollSnapshot(snapshot, refreshedElement)).toBe(true);
    expect(refreshedElement.scrollTop).toBe(650);
  });

  it('keeps the ratio when refreshed content gets shorter and clamps inside the new range', () => {
    const tallSnapshot = captureEditorScrollSnapshot(createScrollElement(2000, 400, 400));
    expect(getEditorScrollRestoreTop(tallSnapshot, createScrollElement(1000, 400))).toBe(150);

    const bottomSnapshot = captureEditorScrollSnapshot(createScrollElement(1000, 400, 600));
    expect(bottomSnapshot?.scrollRatio).toBe(1);
    expect(getEditorScrollRestoreTop(bottomSnapshot, createScrollElement(500, 400))).toBe(100);
  });

  it('keeps an untouched top position at zero when content height changes', () => {
    const snapshot = captureEditorScrollSnapshot(createScrollElement(2000, 400, 0));

    expect(snapshot?.scrollRatio).toBe(0);
    expect(getEditorScrollRestoreTop(snapshot, createScrollElement(3200, 400))).toBe(0);
    expect(getEditorScrollRestoreTop(snapshot, createScrollElement(500, 400))).toBe(0);
  });

  it('restores the exact scrollTop when the scrollable distance is unchanged', () => {
    const snapshot = captureEditorScrollSnapshot(createScrollElement(2000, 400, 401));

    expect(getEditorScrollRestoreTop(snapshot, createScrollElement(2000, 400))).toBe(401);
  });

  it('clamps an out-of-range scrollTop into the captured scrollable distance', () => {
    const snapshot = captureEditorScrollSnapshot(createScrollElement(1000, 400, 9999));

    expect(snapshot).toEqual({
      scrollTop: 600,
      scrollHeight: 1000,
      clientHeight: 400,
      scrollRatio: 1
    });
  });

  it('returns 0 when the refreshed content is not scrollable', () => {
    const snapshot = captureEditorScrollSnapshot(createScrollElement(2000, 400, 400));

    expect(getEditorScrollRestoreTop(snapshot, createScrollElement(300, 400))).toBe(0);
  });

  it('treats a missing or unmeasurable element as invalid without throwing', () => {
    expect(captureEditorScrollSnapshot(null)).toBeNull();
    expect(getEditorScrollRestoreTop(null, createScrollElement(2000, 400))).toBeNull();
    expect(restoreEditorScrollSnapshot(null, createScrollElement(2000, 400))).toBe(false);
    expect(restoreEditorScrollSnapshot(captureEditorScrollSnapshot(null), null)).toBe(false);

    const unmeasurableElement = {
      scrollHeight: Number.NaN,
      clientHeight: Number.NaN,
      scrollTop: Number.NaN
    } as unknown as HTMLElement;
    expect(captureEditorScrollSnapshot(unmeasurableElement)).toEqual({
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      scrollRatio: 0
    });
  });

  it('captures before applying html, restores after render, then realigns when sync is on', async () => {
    const order: string[] = [];
    const previousElement = createScrollElement(2000, 400, 400);
    const refreshedElement = createScrollElement(3000, 400);
    const hooks = createRefreshHooks(
      {
        captureScrollPosition: () => {
          order.push('capture');
          return captureEditorScrollSnapshot(previousElement);
        },
        restoreScrollPosition: (snapshot) => {
          order.push('restore');
          restoreEditorScrollSnapshot(snapshot, refreshedElement);
        },
        isScrollSyncActive: () => true
      },
      order
    );

    const snapshot = await applyPreviewHtmlPreservingScroll(hooks);

    expect(snapshot?.scrollRatio).toBe(0.25);
    expect(refreshedElement.scrollTop).toBe(650);
    expect(order).toEqual([
      'capture',
      'cancel',
      'guard:true',
      'apply-html',
      'render',
      'restore',
      'settle',
      'restore',
      'realign',
      `release:${EDITOR_PREVIEW_SCROLL_GUARD_RELEASE_FRAMES}`
    ]);
  });

  it('only restores the preview position when sync scrolling is off', async () => {
    const order: string[] = [];
    const refreshedElement = createScrollElement(2000, 400);
    const realignScrollSync = vi.fn();
    const hooks = createRefreshHooks(
      {
        captureScrollPosition: () => {
          order.push('capture');
          return captureEditorScrollSnapshot(createScrollElement(2000, 400, 300));
        },
        restoreScrollPosition: (snapshot) => {
          order.push('restore');
          restoreEditorScrollSnapshot(snapshot, refreshedElement);
        },
        realignScrollSync,
        isScrollSyncActive: () => false
      },
      order
    );

    await applyPreviewHtmlPreservingScroll(hooks);

    expect(refreshedElement.scrollTop).toBe(300);
    expect(realignScrollSync).not.toHaveBeenCalled();
    expect(order).not.toContain('realign');
  });

  it('releases the scroll-sync guard even when applying html throws', async () => {
    const order: string[] = [];
    const hooks = createRefreshHooks(
      {
        applyHtml: () => {
          order.push('apply-html');
          throw new Error('render failed');
        }
      },
      order
    );

    await expect(applyPreviewHtmlPreservingScroll(hooks)).rejects.toThrow('render failed');
    expect(order).toEqual([
      'capture',
      'cancel',
      'guard:true',
      'apply-html',
      `release:${EDITOR_PREVIEW_SCROLL_GUARD_RELEASE_FRAMES}`
    ]);
  });

  it('keeps the guard release delay above a single frame so reset scroll events are swallowed', () => {
    expect(EDITOR_PREVIEW_SCROLL_GUARD_RELEASE_FRAMES).toBeGreaterThan(1);
  });

  it('releases the guard when the render frame fails before the restore step', async () => {
    const releaseScrollSyncGuard = vi.fn();
    const restoreScrollPosition = vi.fn((_snapshot: EditorScrollSnapshot | null) => {});
    const hooks = createRefreshHooks({
      waitForRender: async () => {
        throw new Error('frame failed');
      },
      releaseScrollSyncGuard,
      restoreScrollPosition
    });

    await expect(applyPreviewHtmlPreservingScroll(hooks)).rejects.toThrow('frame failed');
    expect(restoreScrollPosition).not.toHaveBeenCalled();
    expect(releaseScrollSyncGuard).toHaveBeenCalledWith(EDITOR_PREVIEW_SCROLL_GUARD_RELEASE_FRAMES);
  });
});
