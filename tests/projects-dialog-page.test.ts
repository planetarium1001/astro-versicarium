// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderFixturePage } from './fixture-page';

/**
 * 真实 `/projects/` 构建产物 + 真实 `projects-dialog.ts`：
 * 覆盖「弹窗里的历史版本行点了没反应」这类只在真实 SSR 标记上出现的问题。
 */
const click = (element: Element) =>
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const dialogOf = (anchor: string) =>
  document.querySelector<HTMLDialogElement>(`#project-dialog-${anchor}`);

const openDialogs = () =>
  Array.from(document.querySelectorAll<HTMLDialogElement>('[data-project-dialog-panel]')).filter(
    (dialog) => dialog.open
  );

beforeEach(async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    }
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    }
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  window.history.replaceState(null, '', '/projects/');
  await renderFixturePage('projects-page.dev.html');
  vi.resetModules();
  await import('../src/scripts/projects-dialog');
});

describe('projects 页面：弹窗版本历史可点击', () => {
  it('点击卡片打开最新版弹窗，版本历史列出全部文档版本且当前版本不可点', () => {
    const card = document.querySelector<HTMLElement>(
      '[data-project-card] [data-project-dialog="project-dialog-whono-theme"]'
    )!;
    click(card);

    const dialog = dialogOf('whono-theme')!;
    expect(dialog.open).toBe(true);

    const versionButtons = Array.from(
      dialog.querySelectorAll<HTMLElement>('[data-project-open][data-project-dialog^="project-dialog-"]')
    ).map((el) => el.getAttribute('data-project-dialog'));

    expect(versionButtons).toEqual(
      expect.arrayContaining([
        'project-dialog-2026-04-01-whono-theme',
        'project-dialog-2025-10-01-whono-theme'
      ])
    );
    expect(versionButtons).not.toContain('project-dialog-whono-theme');
  });

  it('点击历史版本行打开对应版本文档弹窗，并关闭当前弹窗', () => {
    click(
      document.querySelector<HTMLElement>(
        '[data-project-card] [data-project-dialog="project-dialog-whono-theme"]'
      )!
    );
    const latestDialog = dialogOf('whono-theme')!;

    const historyTrigger = latestDialog.querySelector<HTMLElement>(
      '[data-project-open][data-project-dialog="project-dialog-2026-04-01-whono-theme"]'
    )!;
    click(historyTrigger);

    expect(latestDialog.open).toBe(false);
    const historyDialog = dialogOf('2026-04-01-whono-theme')!;
    expect(historyDialog.open).toBe(true);
    expect(openDialogs()).toHaveLength(1);
    expect(historyDialog.textContent).toContain('历史版本');
    expect(historyDialog.textContent).toContain('0.5.0');
  });

  it('历史版本弹窗里的「查看最新版」回到最新版', () => {
    click(
      document.querySelector<HTMLElement>(
        '[data-project-card] [data-project-dialog="project-dialog-whono-theme"]'
      )!
    );
    click(
      dialogOf('whono-theme')!.querySelector<HTMLElement>(
        '[data-project-open][data-project-dialog="project-dialog-2025-10-01-whono-theme"]'
      )!
    );

    const historyDialog = dialogOf('2025-10-01-whono-theme')!;
    expect(historyDialog.open).toBe(true);

    const latestLink = historyDialog.querySelector<HTMLElement>('.project-version-notice [data-project-open]')!;
    click(latestLink);

    expect(dialogOf('whono-theme')!.open).toBe(true);
    expect(historyDialog.open).toBe(false);
  });
});
