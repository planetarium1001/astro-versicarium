// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initCardDialogs } from '../src/scripts/dialog-controller';

/**
 * `/projects/` 深链与单弹窗契约：同一时间只开一个版本弹窗、打开同步 hash、
 * 关闭清理 hash、旧 entry.id 别名回退到最新版。
 */
const WIRING = {
  cardSelector: '[data-project-card]',
  openSelector: '[data-project-open]',
  closeSelector: '[data-project-close]',
  panelSelector: '[data-project-dialog-panel]',
  dialogIdAttribute: 'data-project-dialog',
  focusSelector: '.project-dialog__title',
  scrollResetSelector: '.project-dialog__content',
  hashDialogIdPrefix: 'project-dialog-',
  hashAliasAttribute: 'data-project-entry-id',
  hashLatestAnchorAttribute: 'data-project-latest-anchor',
  exclusiveOpen: true,
  syncHash: true,
  animatePanels: true,
  panelMotionSelector: '.project-dialog__inner'
} as const;

const markup = () => `
  <article class="project-card" data-project-card>
    <button type="button" data-project-open data-project-dialog="project-dialog-content-workflow">内容流程</button>
  </article>
  <article class="project-card" data-project-card>
    <button type="button" data-project-open data-project-dialog="project-dialog-2026-02-10-夜间施工流水线">夜间施工流水线</button>
  </article>

  <dialog
    id="project-dialog-content-workflow"
    data-project-dialog-panel
    data-project-anchor="content-workflow"
    data-project-latest-anchor="content-workflow"
    data-project-entry-id="2026-03-01-content-workflow-v2"
  >
    <h2 class="project-dialog__title" tabindex="-1">内容流程 v2</h2>
    <button type="button" data-project-close>关闭</button>
    <div class="project-dialog__content">
      <button
        type="button"
        data-project-open
        data-project-dialog="project-dialog-2026-01-01-content-workflow"
      >v1.0 初版</button>
    </div>
  </dialog>

  <dialog
    id="project-dialog-2026-01-01-content-workflow"
    data-project-dialog-panel
    data-project-anchor="2026-01-01-content-workflow"
    data-project-latest-anchor="content-workflow"
  >
    <h2 class="project-dialog__title" tabindex="-1">内容流程 v1</h2>
    <button type="button" data-project-close>关闭</button>
    <p class="project-version-notice">
      <span>历史版本 · v1.0 · 2026-01-01 · 该版本已归档。</span>
      <button type="button" data-project-open data-project-dialog="project-dialog-content-workflow">查看最新版 →</button>
    </p>
    <div class="project-dialog__content"></div>
  </dialog>

  <dialog
    id="project-dialog-2026-02-10-夜间施工流水线"
    data-project-dialog-panel
    data-project-anchor="2026-02-10-夜间施工流水线"
    data-project-latest-anchor="2026-02-10-夜间施工流水线"
  >
    <h2 class="project-dialog__title" tabindex="-1">夜间施工流水线</h2>
    <button type="button" data-project-close>关闭</button>
    <div class="project-dialog__content"></div>
  </dialog>
`;

const query = (selector: string) => document.querySelector<HTMLDialogElement>(selector);
const click = (element: Element) =>
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const hash = () => decodeURIComponent(window.location.hash.replace(/^#/, ''));

const boot = (initialHash = '') => {
  document.body.innerHTML = markup();
  window.history.replaceState(null, '', `/projects/${initialHash}`);
  initCardDialogs(WIRING);
};

beforeEach(() => {
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
});

describe('项目弹窗深链', () => {
  it('页面加载时按 hash 打开对应历史版本', () => {
    boot('#2026-01-01-content-workflow');

    expect(query('#project-dialog-2026-01-01-content-workflow')?.open).toBe(true);
    expect(query('#project-dialog-content-workflow')?.open).toBe(false);
    expect(hash()).toBe('2026-01-01-content-workflow');
  });

  it('旧 /projects/#<entryId> 通过 data-project-entry-id 打开最新版并规范化 hash', () => {
    boot('#2026-03-01-content-workflow-v2');

    expect(query('#project-dialog-content-workflow')?.open).toBe(true);
    expect(query('#project-dialog-2026-01-01-content-workflow')?.open).toBe(false);
    expect(hash()).toBe('content-workflow');
  });

  it('最新版 slug 直接打开最新版弹窗', () => {
    boot('#content-workflow');
    expect(query('#project-dialog-content-workflow')?.open).toBe(true);
  });

  it('未知 hash 不打开任何弹窗', () => {
    boot('#missing-anchor');

    expect(
      Array.from(document.querySelectorAll<HTMLDialogElement>('[data-project-dialog-panel]')).some(
        (dialog) => dialog.open
      )
    ).toBe(false);
  });

  it('hashchange 前进/后退可切换到对应版本，hash 清空时关闭弹窗', () => {
    boot();
    const navigate = (anchor: string) => {
      window.history.replaceState(null, '', anchor ? `#${anchor}` : '/projects/');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
    expect(query('#project-dialog-content-workflow')?.open).toBe(false);

    navigate('2026-01-01-content-workflow');
    expect(query('#project-dialog-2026-01-01-content-workflow')?.open).toBe(true);

    navigate('content-workflow');
    expect(query('#project-dialog-content-workflow')?.open).toBe(true);
    expect(query('#project-dialog-2026-01-01-content-workflow')?.open).toBe(false);

    navigate('');
    expect(query('#project-dialog-content-workflow')?.open).toBe(false);
  });
});

describe('项目弹窗只开一个 + hash 同步', () => {
  it('点击卡片打开最新版并写入 hash，关闭按钮清理 hash', () => {
    boot();
    const openTrigger = document.querySelector<HTMLElement>(
      '[data-project-card] [data-project-dialog="project-dialog-content-workflow"]'
    )!;

    click(openTrigger);
    expect(query('#project-dialog-content-workflow')?.open).toBe(true);
    expect(hash()).toBe('content-workflow');

    click(query('#project-dialog-content-workflow')!.querySelector('[data-project-close]')!);
    expect(query('#project-dialog-content-workflow')?.open).toBe(false);
    expect(hash()).toBe('');
  });

  it('版本历史切换时先关闭当前弹窗，只保留目标版本', () => {
    boot('#content-workflow');
    const versionTrigger = query('#project-dialog-content-workflow')!.querySelector<HTMLElement>(
      '[data-project-dialog="project-dialog-2026-01-01-content-workflow"]'
    )!;

    click(versionTrigger);
    expect(query('#project-dialog-content-workflow')?.open).toBe(false);
    expect(query('#project-dialog-2026-01-01-content-workflow')?.open).toBe(true);
    expect(hash()).toBe('2026-01-01-content-workflow');

    const openCount = Array.from(
      document.querySelectorAll<HTMLDialogElement>('[data-project-dialog-panel]')
    ).filter((dialog) => dialog.open).length;
    expect(openCount).toBe(1);
  });

  it('“查看最新版”从历史版本切回最新版', () => {
    boot('#2026-01-01-content-workflow');
    const latestTrigger = query('#project-dialog-2026-01-01-content-workflow')!.querySelector<HTMLElement>(
      '.project-version-notice [data-project-open]'
    )!;

    click(latestTrigger);
    expect(query('#project-dialog-2026-01-01-content-workflow')?.open).toBe(false);
    expect(query('#project-dialog-content-workflow')?.open).toBe(true);
    expect(hash()).toBe('content-workflow');
  });

  it('版本切换给旧弹窗淡出、目标弹窗淡入，再落到唯一弹窗', async () => {
    const originalAnimate = Element.prototype.animate;
    const keyframeSets: Keyframe[][] = [];
    Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[]) {
      keyframeSets.push(keyframes);
      return {
        finished: Promise.resolve(),
        cancel: vi.fn()
      } as unknown as Animation;
    }) as typeof Element.prototype.animate;

    try {
      boot('#content-workflow');
      const versionTrigger = query('#project-dialog-content-workflow')!.querySelector<HTMLElement>(
        '[data-project-dialog="project-dialog-2026-01-01-content-workflow"]'
      )!;

      click(versionTrigger);
      await vi.waitFor(() => {
        expect(query('#project-dialog-2026-01-01-content-workflow')?.open).toBe(true);
      });

      const fadesOut = keyframeSets.some(
        (frames) => frames[0]?.opacity === 1 && frames[1]?.opacity === 0
      );
      const fadesIn = keyframeSets.some(
        (frames) => frames[0]?.opacity === 0 && frames[1]?.opacity === 1
      );
      expect(fadesOut, '旧版本应先淡出').toBe(true);
      expect(fadesIn, '目标版本应随后淡入').toBe(true);
      expect(
        Array.from(document.querySelectorAll<HTMLDialogElement>('[data-project-dialog-panel]')).filter(
          (dialog) => dialog.open
        )
      ).toHaveLength(1);
    } finally {
      Element.prototype.animate = originalAnimate;
    }
  });

  it('点遮罩关闭弹窗，并清理匹配的 hash', () => {
    boot('#content-workflow');
    const dialog = query('#project-dialog-content-workflow')!;

    click(dialog);
    expect(dialog.open).toBe(false);
    expect(hash()).toBe('');
  });
});

describe('projects-dialog 接线契约', () => {
  it('把项目专属行为通过通用控制器配置注入，控制器本身不含页面选择器字面量', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');
    const [wiring, controller] = await Promise.all([
      read('src/scripts/projects-dialog.ts'),
      read('src/scripts/dialog-controller.ts')
    ]);

    expect(wiring).toContain("hashDialogIdPrefix: 'project-dialog-'");
    expect(wiring).toContain("hashAliasAttribute: 'data-project-entry-id'");
    expect(wiring).toContain("hashLatestAnchorAttribute: 'data-project-latest-anchor'");
    expect(wiring).toContain('exclusiveOpen: true');
    expect(wiring).toContain('syncHash: true');
    expect(wiring).toContain('animatePanels: true');
    expect(wiring).toContain("panelMotionSelector: '.project-dialog__inner'");
    expect(controller).not.toContain('project-dialog');
    expect(controller).not.toContain('data-project-');
  });
});
