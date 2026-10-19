// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/blog/...` 版本历史抽屉：
 * - 行为契约：trigger/aria-expanded/dialog.open 同步，关闭后焦点回到 trigger；
 * - 关闭契约：先挂 data-closing 播退出动画，animationend 或 240ms 兜底后才真正关闭；
 * - 兜底契约：即使 dialog 被挪到 section 外，trigger 的 aria-controls 仍能找回它。
 */

const drawerMarkup = (id: string) => `
  <dialog id="${id}" class="version-drawer" data-version-drawer aria-label="版本历史（2）">
    <div class="version-drawer__panel">
      <h2 class="version-drawer__title" tabindex="-1">版本历史（2）</h2>
      <button type="button" data-version-close aria-label="关闭版本历史">关闭</button>
      <ol class="version-list">
        <li class="version-item">v2.0 最新版</li>
        <li class="version-item">v1.0 初版</li>
      </ol>
    </div>
  </dialog>
`;

const triggerMarkup = (id: string) => `
  <button
    class="article-version-trigger"
    type="button"
    data-version-trigger
    aria-expanded="false"
    aria-controls="${id}"
    aria-label="打开版本历史（2）"
  >
    <span class="article-version-trigger__label" aria-hidden="true">版本历史</span>
    <span class="article-version-trigger__icon article-version-trigger__icon--wide" aria-hidden="true"></span>
    <span class="article-version-trigger__icon article-version-trigger__icon--narrow" aria-hidden="true"></span>
  </button>
`;

const appendDrawer = ({ insideSection }: { insideSection: boolean }) => {
  const drawerId = 'article-version-drawer-demo';
  const section = document.createElement('section');
  section.className = 'article-version-notice';
  section.setAttribute('aria-label', '版本信息');
  section.setAttribute('data-article-version', '');
  section.innerHTML = triggerMarkup(drawerId);

  if (insideSection) {
    section.insertAdjacentHTML('beforeend', drawerMarkup(drawerId));
    document.body.append(section);
  } else {
    // 模拟曾经的结构回归：dialog 是 section 的兄弟节点。
    document.body.append(section);
    document.body.insertAdjacentHTML('beforeend', drawerMarkup(drawerId));
  }

  const trigger = document.querySelector<HTMLButtonElement>('[data-version-trigger]')!;
  const dialog = document.querySelector<HTMLDialogElement>('[data-version-drawer]')!;
  return { trigger, dialog };
};

/**
 * jsdom 只实现了 HTMLDialogElement.open，没有 showModal/close。
 * 需要断言「动画结束才 close()」的用例手动补上浏览器行为。
 */
const installDialogMethods = (dialog: HTMLDialogElement) => {
  const closingStates: Array<string | undefined> = [];
  dialog.showModal = vi.fn(() => {
    dialog.setAttribute('open', '');
  });
  const close = vi.fn(() => {
    // 记录 close() 调用瞬间的 data-closing：必须先关闭再清标记，避免面板回弹一帧。
    closingStates.push(dialog.dataset.closing);
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
  });
  dialog.close = close;
  return { close, closingStates };
};

const importDrawerScript = async () => {
  await import('../src/scripts/article-version-drawer');
};

const flushAnimationFrame = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const dispatchAnimationEnd = (dialog: HTMLDialogElement, animationName: string) => {
  const panel = dialog.querySelector<HTMLElement>('.version-drawer__panel')!;
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  panel.dispatchEvent(event);
};

const stubReducedMotion = (matches: boolean) => {
  (window as unknown as { matchMedia: (query: string) => MediaQueryList }).matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as unknown as MediaQueryList;
};

const clearReducedMotionStub = () => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
};

describe('article-version-drawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
    // 抽屉打开后用 rAF 把焦点移到关闭按钮；测试里同步执行，避免时序抖动。
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    clearReducedMotionStub();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('首次点击打开抽屉并同步 aria-expanded / dataset，关闭动画结束后恢复状态与焦点', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();
    const { close, closingStates } = installDialogMethods(dialog);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(dialog.open).toBe(false);

    trigger.click();
    await flushAnimationFrame();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.dataset.versionOpen).toBe('true');
    expect(dialog.open).toBe(true);

    dialog.querySelector<HTMLButtonElement>('[data-version-close]')!.click();

    // 退出动画期间 dialog 仍然打开，只挂 data-closing。
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.closing).toBe('true');
    expect(close).not.toHaveBeenCalled();

    dispatchAnimationEnd(dialog, 'version-drawer-out');

    expect(close).toHaveBeenCalledTimes(1);
    expect(closingStates).toEqual(['true']);
    expect(dialog.open).toBe(false);
    expect(dialog.dataset.closing).toBeUndefined();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.dataset.versionOpen).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('点击文字说明（版本历史）与点击图标一样展开抽屉', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();
    installDialogMethods(dialog);

    const label = trigger.querySelector<HTMLElement>('.article-version-trigger__label');
    expect(label?.textContent).toBe('版本历史');

    label!.click();
    await flushAnimationFrame();

    expect(dialog.open).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('没有 animationend 时 600ms 兜底关闭', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    trigger.click();
    await flushAnimationFrame();
    expect(dialog.open).toBe(true);

    vi.useFakeTimers();
    trigger.click();

    expect(dialog.open).toBe(true);
    expect(dialog.dataset.closing).toBe('true');

    vi.advanceTimersByTime(599);
    expect(dialog.open).toBe(true);

    vi.advanceTimersByTime(1);
    expect(dialog.open).toBe(false);
    expect(dialog.dataset.closing).toBeUndefined();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('prefers-reduced-motion 时跳过动画立即关闭', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();
    const { close } = installDialogMethods(dialog);
    stubReducedMotion(true);

    trigger.click();
    await flushAnimationFrame();
    trigger.click();

    expect(dialog.open).toBe(false);
    expect(dialog.dataset.closing).toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it('再次点击 trigger 可关闭，backdrop 点击与 Esc(cancel) 也走关闭动画', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    trigger.click();
    trigger.click();
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.closing).toBe('true');
    dispatchAnimationEnd(dialog, 'version-drawer-out');
    expect(dialog.open).toBe(false);

    trigger.click();
    dialog.click();
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.closing).toBe('true');
    dispatchAnimationEnd(dialog, 'version-drawer-out');
    expect(dialog.open).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.closing).toBe('true');
    dispatchAnimationEnd(dialog, 'version-drawer-out');
    expect(dialog.open).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('退出动画的 animationend 名称不匹配时不提前关闭', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    trigger.click();
    trigger.click();
    expect(dialog.open).toBe(true);

    dispatchAnimationEnd(dialog, 'version-drawer-in');
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.closing).toBe('true');

    dispatchAnimationEnd(dialog, 'version-drawer-out');
    expect(dialog.open).toBe(false);
  });

  it('dialog 不在 section 内时回退到 trigger 的 aria-controls', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: false });
    const section = document.querySelector('[data-article-version]')!;

    expect(section.contains(dialog)).toBe(false);
    await importDrawerScript();

    trigger.click();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.open).toBe(true);
  });

  it('指针按下 trigger 时打 pointer 标记，键盘/失焦时清除', async () => {
    const { trigger } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(trigger.hasAttribute('data-pointer-focus')).toBe(true);

    trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    expect(trigger.hasAttribute('data-pointer-focus')).toBe(false);

    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(trigger.hasAttribute('data-pointer-focus')).toBe(true);

    trigger.dispatchEvent(new FocusEvent('blur'));
    expect(trigger.hasAttribute('data-pointer-focus')).toBe(false);
  });

  it('指针点击打开/关闭时不把焦点环留在按钮上', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    await flushAnimationFrame();

    const closeButton = dialog.querySelector<HTMLButtonElement>('[data-version-close]')!;
    const dialogTitle = dialog.querySelector<HTMLElement>('.version-drawer__title')!;
    expect(dialog.open).toBe(true);
    // 打开时焦点落在标题，不自动选中关闭按钮。
    expect(document.activeElement).toBe(dialogTitle);

    // 关闭按钮仍可被键盘聚焦，并显示主题焦点环。
    closeButton.setAttribute('data-pointer-focus', 'true');
    closeButton.focus();
    closeButton.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    expect(closeButton.hasAttribute('data-pointer-focus')).toBe(false);

    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    dispatchAnimationEnd(dialog, 'version-drawer-out');

    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.hasAttribute('data-pointer-focus')).toBe(true);
  });

  it('键盘 Esc 关闭后焦点回到 trigger 且不带 pointer 标记', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    trigger.click();
    await flushAnimationFrame();

    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    dispatchAnimationEnd(dialog, 'version-drawer-out');

    expect(document.activeElement).toBe(trigger);
    expect(trigger.hasAttribute('data-pointer-focus')).toBe(false);
  });
});
