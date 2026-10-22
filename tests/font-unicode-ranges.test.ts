import { describe, expect, it } from 'vitest';

import { parseCharsetText, parseFrequencyText, toCodePoints, uniqueSortedChars } from '../scripts/font/characters.mjs';
import {
  countCodePoints,
  findFaceOverlaps,
  findRangeOverlaps,
  formatRanges,
  parseUnicodeRange,
  toRanges,
  unionRanges
} from '../scripts/font/unicode-ranges.mjs';

describe('font/unicode-ranges', () => {
  it('compresses code points into contiguous ranges without duplicates', () => {
    expect(toRanges([0x4e01, 0x4e00, 0x4e00, 0x4e03, 0x4e02])).toEqual([[0x4e00, 0x4e03]]);
    expect(toRanges([0x41, 0x43])).toEqual([
      [0x41, 0x41],
      [0x43, 0x43]
    ]);
  });

  it('formats and parses CSS unicode-range with full fidelity', () => {
    const ranges = [
      [0x20, 0x7e],
      [0x4e00, 0x4e03],
      [0x20000, 0x20001]
    ];
    const text = formatRanges(ranges);
    expect(text).toBe('U+0020-007E, U+4E00-4E03, U+20000-20001');
    expect(parseUnicodeRange(text)).toEqual(ranges);
    expect(parseUnicodeRange('U+4E00')).toEqual([[0x4e00, 0x4e00]]);
    expect(() => parseUnicodeRange('U+zz')).toThrow();
  });

  it('detects overlapping ranges and enforces face exclusivity', () => {
    expect(findRangeOverlaps([[0x41, 0x50]], [[0x4f, 0x60]])).toEqual([[0x4f, 0x50]]);
    expect(findRangeOverlaps([[0x41, 0x50]], [[0x51, 0x60]])).toEqual([]);
    const overlaps = findFaceOverlaps([
      { id: 'a', ranges: [[0x41, 0x50]] },
      { id: 'b', ranges: [[0x50, 0x60]] },
      { id: 'c', ranges: [[0x61, 0x70]] }
    ]);
    expect(overlaps).toEqual([{ left: 'a', right: 'b', ranges: [[0x50, 0x50]] }]);
  });

  it('unions ranges and counts code points', () => {
    expect(unionRanges([[[0x41, 0x42]], [[0x43, 0x44]]])).toEqual([[0x41, 0x44]]);
    expect(countCodePoints([[0x41, 0x44]])).toBe(4);
  });

  it('parses charset and frequency text files, ignoring comments', () => {
    expect(parseCharsetText('# prior\n一\n二\n\n三 四\n')).toEqual(['一', '三', '二', '四'].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!));
    expect(parseFrequencyText('# comment\n的一是\n')).toEqual(['的', '一', '是']);
    expect(uniqueSortedChars('二一', '一二')).toEqual(['一', '二']);
    expect(toCodePoints('一', '二')).toEqual([0x4e00, 0x4e8c]);
  });
});
