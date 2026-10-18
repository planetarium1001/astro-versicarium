// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/blog/...` 版本历史抽屉：
 * - 结构契约：drawer 必须落在 `[data-article-version]` 的 section 内，避免脚本 query 落空；
 * - 行为契约：trigger/aria-expanded/dialog.open 同步，关闭后焦点回到 trigger；
 * - 兜底契约：即使 dialog 被挪到 section 外，trigger 的 aria-controls 仍能找回它。
 */

const NOTICE_COMPONENT = 'src/components/ArticleVersionNotice.astro';

const drawerMarkup = (id: string) => `
  <dialog id="${id}" class="version-drawer" data-version-drawer aria-label="版本历史（2）">
    <div class="version-drawer__panel">
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
  >
    <span>版本历史 (2)</span>
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

const importDrawerScript = async () => {
  await import('../src/scripts/article-version-drawer');
};

const flushAnimationFrame = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('首次点击打开抽屉并同步 aria-expanded / dataset，关闭按钮恢复状态与焦点', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(dialog.open).toBe(false);

    trigger.click();
    await flushAnimationFrame();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.dataset.versionOpen).toBe('true');
    expect(dialog.open).toBe(true);

    dialog.querySelector<HTMLButtonElement>('[data-version-close]')!.click();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.dataset.versionOpen).toBe('false');
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('再次点击 trigger 可关闭，backdrop 点击与 Esc(cancel) 也能关闭', async () => {
    const { trigger, dialog } = appendDrawer({ insideSection: true });
    await importDrawerScript();

    trigger.click();
    trigger.click();
    expect(dialog.open).toBe(false);

    trigger.click();
    expect(dialog.open).toBe(true);
    dialog.click();
    expect(dialog.open).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    expect(dialog.open).toBe(true);
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
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

  it('源码契约：data-version-drawer 位于 data-article-version 的 section 内', async () => {
    const source = await readFile(path.join(process.cwd(), NOTICE_COMPONENT), 'utf8');

    // section 开始标签带 class:list 且跨多行，用 [^>]* 留出属性与换行余地。
    const sectionStart = /<section\b[^>]*\bdata-article-version\b[^>]*>/.exec(source);
    expect(sectionStart, '组件里应有带 data-article-version 的 <section>').not.toBeNull();

    const sectionOpenEnd = (sectionStart?.index ?? 0) + (sectionStart?.[0].length ?? 0);
    const sectionCloseIndex = source.indexOf('</section>', sectionOpenEnd);
    const drawerIndex = source.search(/<dialog\b[^>]*\bdata-version-drawer\b/);

    expect(sectionCloseIndex).toBeGreaterThanOrEqual(sectionOpenEnd);
    expect(drawerIndex, '组件里应有 data-version-drawer 的 <dialog>').toBeGreaterThanOrEqual(sectionOpenEnd);
    expect(drawerIndex, 'dialog 不能是 section 的兄弟节点，必须在 </section> 之前').toBeLessThan(sectionCloseIndex);
  });
});
