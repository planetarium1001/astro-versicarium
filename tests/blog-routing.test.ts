import { describe, expect, it } from 'vitest';
import {
  buildBlogRouting,
  getBlogEntryHrefMap,
  getLatestBlogEntries,
  suggestAvailableBlogSlug
} from '../src/lib/blog-routing';

const entry = (
  id: string,
  dateText: string,
  extra: Record<string, unknown> = {}
) => ({
  id,
  data: {
    title: id,
    date: new Date(`${dateText}T00:00:00+08:00`),
    dateText,
    draft: false,
    ...extra
  }
});

describe('blog routing', () => {
  it('builds a stable latest route, a dated alias, and permanent old-version routes', () => {
    const routing = buildBlogRouting([
      entry('2026-01-01-post-v1', '2026-01-01', {
        series: 'post',
        slug: 'post',
        versionLabel: 'v1'
      }),
      entry('2026-03-01-post-v2', '2026-03-01', {
        series: 'post',
        slug: 'post',
        versionLabel: 'v2'
      })
    ]);

    expect(routing.groups).toHaveLength(1);
    expect(routing.routes.map((route) => [route.path, route.kind, route.noindex])).toEqual([
      ['/blog/post/', 'latest-stable', false],
      ['/blog/2026-03-01-post-v2/', 'latest-alias', false],
      ['/blog/2026-01-01-post-v1/', 'version', true]
    ]);
    expect(routing.routes[2]?.canonicalPath).toBe('/blog/post/');
    expect(getBlogEntryHrefMap(routing).get('2026-01-01-post-v1')).toBe('/blog/2026-01-01-post-v1/');
    expect(getLatestBlogEntries([...routing.groups.flatMap((group) => group.versions)])).toHaveLength(1);
  });

  it('keeps a series without slug on dated URLs', () => {
    const routing = buildBlogRouting([
      entry('2026-01-01-post-v1', '2026-01-01', { series: 'post' }),
      entry('2026-03-01-post-v2', '2026-03-01', { series: 'post' })
    ]);

    expect(routing.routes.map((route) => [route.path, route.kind])).toEqual([
      ['/blog/2026-03-01-post-v2/', 'latest-dated'],
      ['/blog/2026-01-01-post-v1/', 'version']
    ]);
    expect(routing.groups[0]?.canonicalPath).toBe('/blog/2026-03-01-post-v2/');
  });

  it('allows the same slug inside one series but rejects it across series', () => {
    expect(() => buildBlogRouting([
      entry('2026-01-01-a', '2026-01-01', { series: 'a', slug: 'same' }),
      entry('2026-02-01-a', '2026-02-01', { series: 'a', slug: 'same' })
    ])).not.toThrow();

    expect(() => buildBlogRouting([
      entry('2026-01-01-a', '2026-01-01', { series: 'a', slug: 'same' }),
      entry('2026-01-01-b', '2026-01-01', { series: 'b', slug: 'same' })
    ])).toThrow(/Duplicate blog route/);
  });

  it('rejects differing slugs inside one series', () => {
    expect(() => buildBlogRouting([
      entry('2026-01-01-a', '2026-01-01', { series: 'a', slug: 'one' }),
      entry('2026-02-01-a', '2026-02-01', { series: 'a', slug: 'two' })
    ])).toThrow(/share one public slug/);
  });

  it('suggests date-prefixed and suffixed slugs', () => {
    expect(suggestAvailableBlogSlug({
      slug: 'hello',
      dateText: '2026-01-01',
      usedSlugs: new Set()
    })).toBe('2026-01-01-hello');

    expect(suggestAvailableBlogSlug({
      slug: 'hello',
      dateText: '2026-01-01',
      usedSlugs: new Set(['2026-01-01-hello'])
    })).toBe('2026-01-01-hello-1');

    expect(suggestAvailableBlogSlug({
      slug: '2026-01-01-hello',
      dateText: '2026-01-01',
      usedSlugs: new Set(['2026-01-01-hello'])
    })).toBe('2026-01-01-hello-1');
  });
});
