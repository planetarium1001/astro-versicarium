import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ROLE_KEYS,
  diffRoleCharsets,
  formatRoleCharsetDiff,
  toSortedChars
} from '../scripts/font/freshness.mjs';

/* font:coverage --strict 的过期门禁：dist 角色字符集变了但没重跑 font:build 时必须能发现。
   charset-roles.json 的角色集合由 scripts/font-roles.mjs 写入，这里锁定两边的角色键契约。 */

const SNAPSHOT = JSON.parse(
  readFileSync(path.join(process.cwd(), 'tools', 'charset-roles.json'), 'utf8')
);

describe('font/coverage freshness', () => {
  it('角色字符集完全一致时不报差异（同一次 font:build 的 dist 与快照）', () => {
    expect(diffRoleCharsets(SNAPSHOT.charsets, SNAPSHOT.charsets)).toEqual([]);
  });

  it('发现 dist 新增字符：报告角色、新增字与数量', () => {
    const diffs = diffRoleCharsets({ text: '字体' }, { text: '字体管' });

    expect(diffs).toEqual([{ role: 'text', added: ['管'], removed: [] }]);
  });

  it('发现 dist 移除字符：内容删减后同样会过期', () => {
    const diffs = diffRoleCharsets({ text: '字体管线' }, { text: '字体线' });

    expect(diffs).toEqual([{ role: 'text', added: [], removed: ['管'] }]);
  });

  it('按码位排序输出，避免每次运行的差异因 Set 插入顺序抖动', () => {
    const diffs = diffRoleCharsets({ text: 'ab' }, { text: 'ba龘' });

    expect(diffs.map((diff) => diff.added)).toEqual([['龘']]);
    expect(diffs.map((diff) => diff.removed)).toEqual([[]]);
    expect(toSortedChars('ba龘')).toEqual(['a', 'b', '龘']);
  });

  it('逐角色比较并按 ROLE_KEYS 顺序返回，未变化的角色不输出', () => {
    const recorded = { text: '字体', textOnly: '字体', display: '', meta: '元', brand: '' };
    const current = { text: '字体', textOnly: '字体新', display: '标', meta: '元', brand: '' };
    const diffs = diffRoleCharsets(recorded, current);

    expect(diffs.map((diff) => diff.role)).toEqual(['textOnly', 'display']);
    expect(diffs[0]).toEqual({ role: 'textOnly', added: ['新'], removed: [] });
    expect(diffs[1]).toEqual({ role: 'display', added: ['标'], removed: [] });
  });

  it('当前 dist 用 Set 传入（mergePageRoleCharsets 的输出）也能比较', () => {
    const merged = { ...SNAPSHOT.charsets, text: new Set([...SNAPSHOT.charsets.text, '龘']) };
    const diffs = diffRoleCharsets(SNAPSHOT.charsets, merged);

    expect(diffs).toHaveLength(1);
    expect(diffs.map((diff) => diff.role)).toEqual(['text']);
    expect(diffs.map((diff) => diff.added)).toEqual([['龘']]);
    expect(diffs.map((diff) => diff.removed)).toEqual([[]]);
  });

  it('快照缺少某角色时把该角色全部字视为新增（旧快照也能拦住）', () => {
    const diffs = diffRoleCharsets({ text: '字' }, { text: '字', display: '标题' });

    expect(diffs).toEqual([{ role: 'display', added: ['标', '题'], removed: [] }]);
  });

  it('差异摘要包含角色、方向、数量与示例，超长时截断', () => {
    const chars = Array.from({ length: 35 }, (_, index) => String.fromCodePoint(0x4e00 + index));
    const summary = formatRoleCharsetDiff({ role: 'display', added: chars, removed: ['旧'] }, 30);

    expect(summary).toContain('display');
    expect(summary).toContain('dist 新增 35 字: 一丁丂');
    expect(summary).toContain('…');
    expect(summary).toContain('dist 移除 1 字: 旧');
  });

  it('tools/charset-roles.json 的 charsets 覆盖全部校验角色（font-roles 契约）', () => {
    for (const role of ROLE_KEYS) {
      expect(typeof SNAPSHOT.charsets[role]).toBe('string');
    }
    expect(SNAPSHOT.pageCount).toBeGreaterThan(0);
  });
});
