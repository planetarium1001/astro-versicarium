import { describe, expect, it } from 'vitest';
import {
  MEDIA_FILE_ICON_PATHS,
  getMediaFileExtension,
  resolveMediaFileVisual
} from '../src/lib/admin-console/media-file-visual';

describe('getMediaFileExtension', () => {
  it('normalizes nested paths and ignores query strings', () => {
    expect(getMediaFileExtension('content/blog/entry/files/Report.PDF')).toBe('pdf');
    expect(getMediaFileExtension('C:\\Users\\demo\\archive.tar.gz')).toBe('gz');
    expect(getMediaFileExtension('no-extension')).toBe('');
  });
});

describe('resolveMediaFileVisual', () => {
  it('maps pdf to a red pdf icon', () => {
    expect(resolveMediaFileVisual('spec.pdf')).toEqual({
      label: 'PDF',
      tone: 'red',
      icon: 'pdf'
    });
  });

  it('maps zip to an amber archive icon', () => {
    expect(resolveMediaFileVisual('bundle.ZIP')).toEqual({
      label: 'ZIP',
      tone: 'amber',
      icon: 'archive'
    });
  });

  it('maps markdown to a compact md label', () => {
    expect(resolveMediaFileVisual('notes.markdown')).toEqual({
      label: 'MD',
      tone: 'teal',
      icon: 'text'
    });
  });

  it('falls back to a neutral file icon for unknown extensions', () => {
    expect(resolveMediaFileVisual('mystery.unknownext')).toEqual({
      label: 'UNKNO',
      tone: 'stone',
      icon: 'file'
    });
    expect(resolveMediaFileVisual('README')).toEqual({
      label: 'FILE',
      tone: 'stone',
      icon: 'file'
    });
  });

  it('covers every required extension family with a distinct icon', () => {
    const covered = [
      'pdf',
      'doc', 'docx', 'rtf', 'odt',
      'xls', 'xlsx', 'csv', 'ods',
      'zip', 'rar', '7z', 'tar', 'gz',
      'txt', 'md', 'log',
      'json', 'yaml', 'toml', 'xml',
      'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'sh', 'py', 'go', 'rs', 'java', 'c', 'cpp',
      'mp3', 'wav', 'flac', 'ogg', 'm4a',
      'mp4', 'mov', 'webm', 'mkv',
      'woff', 'woff2', 'ttf', 'otf'
    ];
    for (const extension of covered) {
      const visual = resolveMediaFileVisual(`sample.${extension}`);
      expect(MEDIA_FILE_ICON_PATHS[visual.icon].length).toBeGreaterThan(0);
      expect(visual.icon).not.toBe('file');
      expect(visual.label).toBe(extension.toUpperCase());
    }
  });
});
