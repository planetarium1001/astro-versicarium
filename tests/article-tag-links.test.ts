// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { toTagKey, isRoutableTagKey } from '../src/lib/tags';

/**
 * 文章详情页顶部的 tag 必须可点，且指向能真正筛选的地址。
 *
 * 用构建产物里的真实文章详情页 HTML 断言：每个 tag 都是 `<a>`，href 落在
 * `/blog/?tags=<key>`，key 与 `toTagKey(标签)` 一致且路由安全 —— 否则点进去筛不到东西。
 * 「点进去真的会筛选」由 tests/entry-search-client.test.ts 覆盖，两者合起来才是完整链路。
 */

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'article-page.dev.html');
const BLOG_LIST_FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'blog-page.dev.html');

const loadPage = async () => {
  const html = await readFile(FIXTURE, 'utf8');
  document.documentElement.innerHTML = html
    .replace(/^[\s\S]*?<html[^>]*>/i, '')
    .replace(/<\/html>[\s\S]*$/i, '');
};

const tagAnchors = () =>
  Array.from(document.querySelectorAll<HTMLAnchorElement>('.meta-line__item--tags a.tag'));

describe('文章详情页 tag 的可点入口', () => {
  beforeEach(async () => {
    await loadPage();
  });

  it('标签行里的每个 tag 都是可点链接', () => {
    const anchors = tagAnchors();
    expect(anchors.length, 'fixture 的文章需要有标签').toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.textContent?.trim().startsWith('#')).toBe(true);
      expect(anchor.getAttribute('href') ?? '').not.toBe('');
    }
  });

  it('href 指向 /blog/?tags=<key>，key 与客户端归一化一致', () => {
    for (const anchor of tagAnchors()) {
      const label = (anchor.textContent ?? '').trim().replace(/^#/, '');
      const expectedKey = toTagKey(label);
      expect(isRoutableTagKey(expectedKey), `标签「${label}」的 key 必须可路由`).toBe(true);

      const url = new URL(anchor.getAttribute('href')!, 'https://example.com');
      expect(url.pathname).toBe('/blog/');
      expect(url.searchParams.get('tags')).toBe(expectedKey);
      // 与 aria-label 一致（读屏用户听到的也是「筛选标签 X」）
      expect(anchor.getAttribute('aria-label')).toBe(`筛选标签 ${label}`);
      expect(anchor.dataset.articleTagLink).toBe(expectedKey);
    }
  });
});

/**
 * 博客列表卡里的 tag 也要像详情页一样可悬停、可点击筛选。
 *
 * 卡片原本是整块 `<a>`，在里面再放 `<a>` 属于非法嵌套（浏览器会切断外层链接、
 * 卡片结构散架）。现在卡片是 `<div>` 加标题上的「拉伸链接」铺满整卡，
 * tag 才是真正的 `<a>`，既保持整块可点，又能单独点标签。
 */
describe('博客列表卡 tag 的可点入口', () => {
  beforeEach(async () => {
    const html = await readFile(BLOG_LIST_FIXTURE, 'utf8');
    document.documentElement.innerHTML = html
      .replace(/^[\s\S]*?<html[^>]*>/i, '')
      .replace(/<\/html>[\s\S]*$/i, '');
  });

  it('卡片是 div + 拉伸链接，卡内 tag 是真链接且没有嵌套 <a>', () => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.list-item--link[data-entry-item]')
    );
    expect(cards.length, 'fixture 的博客列表需要卡片').toBeGreaterThan(0);

    let tagCount = 0;
    for (const card of cards) {
      expect(card.tagName, '卡片本体不能再是 <a>').toBe('DIV');
      expect(card.querySelector('a.list-item__stretch'), '需要铺满整卡的拉伸链接').not.toBeNull();

      for (const anchor of Array.from(card.querySelectorAll('a'))) {
        expect(anchor.querySelector('a'), '不允许 <a> 嵌套 <a>').toBeNull();
      }

      for (const tag of Array.from(card.querySelectorAll<HTMLAnchorElement>('.meta-line__item--tags a.tag'))) {
        const label = (tag.textContent ?? '').trim().replace(/^#/, '');
        const expectedKey = toTagKey(label);
        expect(isRoutableTagKey(expectedKey), `标签「${label}」的 key 必须可路由`).toBe(true);

        const url = new URL(tag.getAttribute('href')!, 'https://example.com');
        expect(url.pathname).toBe('/blog/');
        expect(url.searchParams.get('tags')).toBe(expectedKey);
        expect(tag.getAttribute('aria-label')).toBe(`筛选标签 ${label}`);
        expect(tag.dataset.articleTagLink).toBe(expectedKey);
        tagCount += 1;
      }
    }
    expect(tagCount, '列表卡里应当有可以点的 tag').toBeGreaterThan(0);
  });
});
