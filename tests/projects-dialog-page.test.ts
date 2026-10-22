// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderFixturePage } from './fixture-page';

/**
 * 真实 `/projects/` 构建产物 + 真实 `projects-dialog.ts`：
 * 覆盖「弹窗里的历史版本行点了没反应」这类只在真实 SSR 标记上出现的问题。
 *
 * 用例不写死项目锚点与版本号：先从 fixture 里找出一个有多份历史文档的项目，
 * 再按它自己的锚点断言。换一套示例内容时不会误报。
 */
const click = (element: Element) =>
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const dialogOf = (anchor: string) =>
  document.querySelector<HTMLDialogElement>(`#project-dialog-${anchor}`);

const openDialogs = () =>
  Array.from(document.querySelectorAll<HTMLDialogElement>('[data-project-dialog-panel]')).filter(
    (dialog) => dialog.open
  );

const DIALOG_PREFIX = 'project-dialog-';

const anchorOf = (element: Element) =>
  element.getAttribute('data-project-dialog')!.slice(DIALOG_PREFIX.length);

const versionTriggers = (dialog: HTMLDialogElement) =>
  Array.from(
    dialog.querySelectorAll<HTMLElement>(
      `[data-project-open][data-project-dialog^="${DIALOG_PREFIX}"]`
    )
  );

const cardFor = (anchor: string) =>
  document.querySelector<HTMLElement>(
    `[data-project-card] [data-project-dialog="${DIALOG_PREFIX}${anchor}"]`
  )!;

type MultiVersionProject = {
  anchor: string;
  latestDialog: HTMLDialogElement;
  historyAnchors: string[];
};

/** 找一个至少带一份历史版本文档的项目；找不到说明 fixture 覆盖不足。 */
const findMultiVersionProject = (): MultiVersionProject => {
  for (const card of document.querySelectorAll<HTMLElement>(
    `[data-project-card] [data-project-dialog^="${DIALOG_PREFIX}"]`
  )) {
    const anchor = anchorOf(card);
    const dialog = dialogOf(anchor);
    if (!dialog) continue;

    const historyAnchors = versionTriggers(dialog)
      .map(anchorOf)
      .filter((candidate) => candidate !== anchor);

    if (historyAnchors.length > 0) {
      return { anchor, latestDialog: dialog, historyAnchors };
    }
  }
  throw new Error('fixture 里没有多版本文档的项目，无法覆盖版本弹窗');
};

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
  it('点击卡片打开最新版弹窗，版本历史列出历史文档且当前版本不可点', () => {
    const project = findMultiVersionProject();
    click(cardFor(project.anchor));

    expect(project.latestDialog.open).toBe(true);

    const listedAnchors = versionTriggers(project.latestDialog).map(anchorOf);
    expect(listedAnchors).toEqual(expect.arrayContaining(project.historyAnchors));
    expect(listedAnchors).not.toContain(project.anchor);
  });

  it('点击历史版本行打开对应版本文档弹窗，并关闭当前弹窗', () => {
    const project = findMultiVersionProject();
    click(cardFor(project.anchor));

    const historyAnchor = project.historyAnchors[0]!;
    const historyTrigger = versionTriggers(project.latestDialog).find(
      (element) => anchorOf(element) === historyAnchor
    )!;
    click(historyTrigger);

    expect(project.latestDialog.open).toBe(false);
    const historyDialog = dialogOf(historyAnchor)!;
    expect(historyDialog.open).toBe(true);
    expect(openDialogs()).toHaveLength(1);
    expect(historyDialog.textContent).toContain('历史版本');
  });

  it('历史版本弹窗里的「查看最新版」回到最新版', () => {
    const project = findMultiVersionProject();
    click(cardFor(project.anchor));

    const historyAnchor = project.historyAnchors[0]!;
    click(
      versionTriggers(project.latestDialog).find(
        (element) => anchorOf(element) === historyAnchor
      )!
    );

    const historyDialog = dialogOf(historyAnchor)!;
    expect(historyDialog.open).toBe(true);

    const latestLink = historyDialog.querySelector<HTMLElement>(
      '.project-version-notice [data-project-open]'
    )!;
    click(latestLink);

    expect(dialogOf(project.anchor)!.open).toBe(true);
    expect(historyDialog.open).toBe(false);
  });
});
