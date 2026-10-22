import { describe, expect, it } from 'vitest';

import {
  countCharacters,
  mergeCounts,
  priorFromText,
  rankChars,
  topPriorChars
} from '../scripts/font/frequency.mjs';

describe('font/frequency', () => {
  const isCjk = (codePoint: number) => codePoint >= 0x4e00 && codePoint <= 0x9fff;

  it('builds prior rank from frequency-ordered text', () => {
    const prior = priorFromText('# header\n的一是\n');
    expect(prior.get('的')).toBe(0);
    expect(prior.get('一')).toBe(1);
    expect(prior.get('是')).toBe(2);
  });

  it('counts only CJK characters when asked', () => {
    const counts = countCharacters('的的a一', { cjkOnly: true, isCjk });
    expect(counts.get('的')).toBe(2);
    expect(counts.get('一')).toBe(1);
    expect(counts.has('a')).toBe(false);
  });

  it('ranks by site frequency first, prior rank second, codepoint last', () => {
    const prior = priorFromText('的一是');
    const siteCounts = new Map([
      ['是', 10],
      ['一', 3]
    ]);
    const ranked = rankChars(['一', '是', '的', '二'], { siteCounts, prior });
    // 是(10) > 一(3) > 的(prior 0) > 二(无 prior，按码位)
    expect(ranked).toEqual(['是', '一', '的', '二']);
  });

  it('merges counts and returns top prior chars', () => {
    const target = new Map([['的', 1]]);
    mergeCounts(target, new Map([['的', 2], ['一', 5]]));
    expect(target.get('的')).toBe(3);
    expect(topPriorChars(priorFromText('的一是'), 2)).toEqual(['的', '一']);
  });
});
