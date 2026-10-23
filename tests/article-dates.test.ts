// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { localizeArticleDateTimes } from '../src/scripts/article-dates';

const SITE_TIME_ZONE = 'Asia/Shanghai';
const ISO = '2026-07-15T02:30:00.000Z'; // 上海 10:30

const renderTime = (dateKind: 'date' | 'datetime' = 'datetime'): HTMLTimeElement => {
  document.body.innerHTML = `
    <time
      datetime="${ISO}"
      data-site-timezone="${SITE_TIME_ZONE}"
      data-date-kind="${dateKind}"
      data-date-label="发布于："
      data-site-offset="UTC+8"
    >发布于：2026-07-15 10:30</time>
  `;
  const element = document.querySelector<HTMLTimeElement>('time');
  if (!element) throw new Error('time element missing');
  return element;
};

describe('article-dates 客户端时区后缀', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('访客时区与站点一致时不追加时区后缀', () => {
    const element = renderTime();

    localizeArticleDateTimes({ visitorTimeZone: SITE_TIME_ZONE });

    expect(element.textContent).toBe('发布于：2026-07-15 10:30');
    expect(element.textContent).not.toContain('CST');
  });

  it('访客时区不同时保持站点时间，只追加站点时区短名 CST', () => {
    const element = renderTime();

    localizeArticleDateTimes({ visitorTimeZone: 'UTC' });

    // 不按访客时区换算：仍是上海的 10:30，只是补上 CST。
    expect(element.textContent).toBe('发布于：2026-07-15 10:30 CST');
    expect(element.title).toBe('UTC+8（Asia/Shanghai）');
  });

  it('重复执行不会叠加后缀', () => {
    const element = renderTime();

    localizeArticleDateTimes({ visitorTimeZone: 'UTC' });
    localizeArticleDateTimes({ visitorTimeZone: 'UTC' });

    expect(element.textContent).toBe('发布于：2026-07-15 10:30 CST');
  });

  it('只处理 data-date-kind="datetime" 的元素', () => {
    const element = renderTime('date');

    localizeArticleDateTimes({ visitorTimeZone: 'UTC' });

    expect(element.textContent).toBe('发布于：2026-07-15 10:30');
  });
});
