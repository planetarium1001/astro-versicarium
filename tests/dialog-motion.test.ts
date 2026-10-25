// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initCardDialogs } from '../src/scripts/dialog-controller';

/**
 * 卡片弹窗（`/projects/`、`/bits/`）的动画边界。
 *
 * 两个回归点都只在开合动画存在时才出现，jsdom 默认没有 WAAPI，所以这里显式桩一个
 * `Element.prototype.animate`，把「动画进行中」这个时间窗造出来。
 */

const PANEL_SELECTOR = '[data-test-panel]';
/** 桩动画时长：足够长，让「动画进行中」这个时间窗可以被连点命中。 */
const ANIMATION_MS = 60;

type Harness = {
  dialog: HTMLDialogElement;
  click: (element: Element) => void;
  animateCalls: () => number;
  /** 该弹窗被 showModal 打开的那一帧，是否要求遮罩瞬间到位 */
  instantAtShow: (dialog: HTMLDialogElement) => boolean | undefined;
};

const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

const mount = (): Harness => {
  // initCardDialogs 在 document 上注册 click 监听且不返回销毁句柄，多次 mount 会累积：
  // 每次点击会被此前所有轮次的监听各处理一遍。打开/关闭都是幂等操作（已打开则跳过、
  // 关闭动画中则被守卫拦住），因此重复处理不会改变最终状态，断言仍然有效。
  // 若要断言「监听只被调用一次」这类计数，必须先解决监听累积。
  document.body.innerHTML = `
    <button data-test-card data-test-open data-test-dialog-id="dlg-a">open a</button>
    <button data-test-card data-test-open data-test-dialog-id="dlg-b">open b</button>
    <dialog id="dlg-a" data-test-panel><div class="panel">a</div><button data-test-close>close</button></dialog>
    <dialog id="dlg-b" data-test-panel><div class="panel">b</div><button data-test-close>close</button></dialog>
  `;

  let animateCalls = 0;
  (Element.prototype as unknown as { animate: unknown }).animate = vi.fn(() => {
    animateCalls += 1;
    return {
      finished: new Promise((resolve) => window.setTimeout(resolve, ANIMATION_MS)),
      cancel: () => undefined
    };
  });

  const instantAtShow = new Map<HTMLDialogElement, boolean>();
  const dialogA = document.querySelector<HTMLDialogElement>('#dlg-a')!;
  for (const dialog of [dialogA, document.querySelector<HTMLDialogElement>('#dlg-b')!]) {
    // jsdom 没有实现 dialog 的模态方法，补最小的 open 状态语义。
    Object.defineProperty(dialog, 'showModal', {
      configurable: true,
      value: () => {
        // 记录「打开的那一帧」是否要求遮罩瞬间到位——这是修复的关键契约
        instantAtShow.set(dialog, dialog.hasAttribute('data-backdrop-instant'));
        dialog.setAttribute('open', '');
      }
    });
    Object.defineProperty(dialog, 'close', {
      configurable: true,
      value: () => dialog.removeAttribute('open')
    });
  }

  initCardDialogs({
    cardSelector: '[data-test-card]',
    openSelector: '[data-test-open]',
    closeSelector: '[data-test-close]',
    panelSelector: PANEL_SELECTOR,
    dialogIdAttribute: 'data-test-dialog-id',
    focusSelector: '.panel',
    scrollResetSelector: '.panel',
    exclusiveOpen: true,
    syncHash: false,
    animatePanels: true,
    panelMotionSelector: '.panel'
  });

  return {
    dialog: dialogA,
    click: (element) =>
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    animateCalls: () => animateCalls,
    instantAtShow: (dialog: HTMLDialogElement) => instantAtShow.get(dialog)
  };
};

const openA = (harness: Harness) =>
  harness.click(document.querySelector('[data-test-open][data-test-dialog-id="dlg-a"]')!);

describe('卡片弹窗：关闭动画期间连点遮罩', () => {
  beforeEach(() => {
    // animate 是直接赋值到原型上的桩，restoreAllMocks 清不掉，显式删除交给 mount 重装
    delete (Element.prototype as unknown as { animate?: unknown }).animate;
  });

  /**
   * 回归点：退出动画有 500ms，期间每次点遮罩都会重新触发关闭流程。若没有守卫，
   * 每轮都会递增 motionRunId 并重启动画，上一轮的收尾因 runId 失效而不执行关闭——
   * 表现就是弹窗反复淡出、一闪一闪，但始终关不掉。
   */
  it('连点遮罩不会重启动画，弹窗在动画结束后关闭', async () => {
    const harness = mount();
    openA(harness);
    await nextFrame();

    const callsAfterOpen = harness.animateCalls();

    // 关闭动画进行中连续点 4 次
    harness.click(harness.dialog);
    const callsAfterFirstClose = harness.animateCalls();
    harness.click(harness.dialog);
    harness.click(harness.dialog);
    harness.click(harness.dialog);

    expect(
      harness.animateCalls(),
      '重复点击不应再启动退出动画（每次重启都会让画面重新淡出）'
    ).toBe(callsAfterFirstClose);
    expect(callsAfterFirstClose, '第一次点击应启动退出动画').toBeGreaterThan(callsAfterOpen);

    // 等动画结束，弹窗应当真的关掉
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    expect(harness.dialog.open, '动画结束后弹窗应关闭').toBe(false);
  });

  it('关闭完成后再打开，可以正常打开', async () => {
    const harness = mount();
    openA(harness);
    await nextFrame();
    harness.click(harness.dialog);
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    expect(harness.dialog.open).toBe(false);

    openA(harness);
    await nextFrame();
    expect(harness.dialog.open, '守卫不应把后续打开也挡掉').toBe(true);
  });
});

describe('卡片弹窗：版本切换的遮罩连续性', () => {
  beforeEach(() => {
    delete (Element.prototype as unknown as { animate?: unknown }).animate;
  });

  /**
   * 回归点：切换版本时旧弹窗先关、新弹窗再开，两者是不同元素。旧遮罩随旧弹窗消失，
   * 新遮罩若还从透明淡入，中间就露出整页背景（亮色下是一次闪白）。因此切换时
   * 新弹窗必须带 `data-backdrop-instant`，让遮罩同帧到位。
   */
  it('切换版本时新弹窗的遮罩同帧到位，并在下一帧撤掉标记', async () => {
    const harness = mount();
    openA(harness);
    await nextFrame();
    const dialogB = document.querySelector<HTMLDialogElement>('#dlg-b')!;

    // 打开另一个弹窗 = 版本切换（exclusiveOpen 会先关闭 A）
    harness.click(document.querySelector('[data-test-open][data-test-dialog-id="dlg-b"]')!);
    await new Promise((resolve) => window.setTimeout(resolve, 200));

    expect(harness.dialog.open, '旧弹窗应已关闭').toBe(false);
    expect(dialogB.open, '新弹窗应已打开').toBe(true);

    // 关键契约：切换时新弹窗打开的那一帧必须带标记，遮罩才不会从 0 淡入
    expect(
      harness.instantAtShow(dialogB),
      '版本切换时遮罩必须瞬间到位，否则旧遮罩消失后画面会闪白'
    ).toBe(true);

    // 标记必须及时撤掉，否则会盖住之后的关闭淡出
    await nextFrame();
    expect(
      dialogB.hasAttribute('data-backdrop-instant'),
      '首帧之后应撤掉标记，否则关闭时遮罩不会淡出'
    ).toBe(false);
  });

  it('首次打开（无旧弹窗）保留遮罩淡入', async () => {
    const harness = mount();
    openA(harness);
    expect(
      harness.instantAtShow(harness.dialog),
      '非切换场景不应跳过遮罩淡入'
    ).toBe(false);
  });
});

/**
 * 遮罩「瞬间到位」靠一条 CSS 规则实现，脚本只负责打标记。规则本身读不到运行时效果，
 * 所以在这里守住它的两个成立条件：写在 `@starting-style` 之后，且特异性更高。
 * 缺任何一条，`@starting-style` 的 `opacity: 0` 都会赢回来，闪白静默复现。
 */
describe('卡片弹窗：遮罩瞬间到位的 CSS 契约', () => {
  const read = (relative: string) => readFile(path.join(process.cwd(), relative), 'utf8');

  it('project-dialog 的规则在 @starting-style 之后，且特异性更高', async () => {
    const css = await read('src/styles/projects-page.css');

    // 锚在 `@starting-style {` 本体而不是裸串：注释里也写着这个 at-rule 的名字，
    // 用 indexOf 会被注释命中，规则连同注释一起上移时断言就恒真、测不出顺序回退。
    const startingAt = /@starting-style\s*\{/.exec(css)?.index ?? -1;
    expect(startingAt, '应有 @starting-style 块').toBeGreaterThan(-1);
    const ruleAt = /^\.project-dialog\[open\]\[data-backdrop-instant\]::backdrop\s*\{/m.exec(css)?.index ?? -1;
    expect(ruleAt, '应有 data-backdrop-instant 规则').toBeGreaterThan(-1);
    expect(ruleAt, '规则必须写在 @starting-style 之后').toBeGreaterThan(startingAt);

    // 特异性：(0,3,1) 压过 @starting-style 里的 (0,2,1)
    const block = /\.project-dialog\[open\]\[data-backdrop-instant\]::backdrop\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block, '规则体应存在').not.toBe('');
    expect(block).toMatch(/opacity:\s*1/);
    expect(block, '同时去掉过渡，避免首帧仍从 0 补间').toMatch(/transition:\s*none/);
  });

  it('只有互斥打开的弹窗需要该规则，bits 弹窗不声明', async () => {
    // bits 的 wiring 没有 exclusiveOpen，切换时不存在「旧弹窗在场」的场景，
    // 给它加规则是死代码——这条断言防止它被重新加回去。
    const bitCss = await read('src/styles/components/bit-card.css');
    expect(bitCss).not.toContain('data-backdrop-instant');
  });
});
