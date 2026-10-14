import { readFile } from 'node:fs/promises';
import { expect, vi } from 'vitest';
import { fixturePath, renderFixture, stubIndexFetch } from './fixture-page';

/**
 * 页面快照与真实客户端脚本的组合夹具，供 entry-search / bits-year-filter / archive-scope 的
 * 行为测试共用。快照来自构建产物（tests/fixtures），因此必须在用例内显式 import 待测脚本。
 */

export const PAGES = [
  { name: 'bits', html: 'bits-page.dev.html', index: 'bits-index.dev.json' },
  { name: 'blog', html: 'blog-page.dev.html', index: 'blog-index.dev.json' },
  { name: 'archive', html: 'archive-page.dev.html', index: 'archive-index.dev.json' }
] as const;

export type FixturePage = (typeof PAGES)[number];
export type EntrySearchIndexItem = { slug: string; tags: string[] };

export const loadPage = async <T = EntrySearchIndexItem>(page: { html: string; index: string }) => {
  const [html, indexJson] = await Promise.all([
    readFile(fixturePath(page.html), 'utf8'),
    readFile(fixturePath(page.index), 'utf8')
  ]);

  renderFixture(html);
  stubIndexFetch(indexJson);

  return { indexItems: JSON.parse(indexJson) as T[] };
};

export const pageItems = () => Array.from(document.querySelectorAll<HTMLElement>('[data-entry-item]'));
export const visibleItems = () => pageItems().filter((el) => !el.hidden);
export const visibleSlugs = () => visibleItems().map((el) => (el.dataset.slug ?? '').trim());

export const tagButtons = () => Array.from(document.querySelectorAll<HTMLElement>('[data-entry-tag-key]'));
export const tagButton = (key: string) =>
  tagButtons().find((el) => (el.dataset.entryTagKey ?? '').trim() === key) ?? null;

export const clickTag = async (key: string) => {
  const button = tagButton(key);
  expect(button, `找不到标签按钮：${key}`).not.toBeNull();
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  // applyFilter 走 debounce(120ms) + await loadIndex()
  await vi.waitFor(
    () => {
      expect(tagButton(key)!.getAttribute('aria-pressed')).toBe('true');
    },
    { timeout: 3000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
};

/** 载入与页面真实一致的脚本组合（顺序与页面的 import 顺序一致）。 */
export const importEntrySearch = async (
  options: { archiveScope?: boolean; bitsYear?: boolean } = {}
) => {
  vi.resetModules();
  await import('../src/scripts/entry-search');
  if (options.bitsYear) {
    await import('../src/scripts/bits-year-filter');
  }
  if (options.archiveScope) {
    await import('../src/scripts/archive-scope');
  }
};

/** jsdom 不实现 matchMedia；reducedMotion 为 true 时命中 prefers-reduced-motion。 */
export const stubMatchMedia = (reducedMotion = false) => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  );
};

/**
 * 每例开始前的环境桩。jsdom 的 document 与 URL 在同一文件的用例间共享：
 * 上一例写入的 ?tags= 会让下一例首次点击变成「取消选中」，且待测脚本在模块顶层读 document，
 * 因此每例都要清空查询串、重建 DOM 后再 import。
 */
export const stubEntrySearchEnvironment = (href = '/') => {
  window.history.replaceState(null, '', href);
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  stubMatchMedia(false);
};
