import { describe, expect, it } from 'vitest';
import { filePathError, normalizeFilePath } from './file-path';
import type { Snapshot } from './workspace-api';

const file = (fileId: number, path: string): Snapshot['tree'][number] => ({
  fileId,
  path,
  contentKind: 'text',
  sha256: '0'.repeat(64),
  sizeBytes: 0,
  mediaType: 'text/plain',
});

describe('file path validation', () => {
  it('normalizes Unicode to NFC without trimming', () => {
    expect(normalizeFilePath('  cafe\u0301/🧪.typ ')).toBe('  café/🧪.typ ');
    expect(filePathError('  🧪.txt ', [])).toBe('');
  });

  it('accepts Ukrainian and emoji names', () => {
    expect(filePathError('тексти/Привіт 🧪.txt', [])).toBe('');
  });

  it.each([
    '',
    '/root.typ',
    'a/',
    'a//b',
    './a',
    '../a',
    'a/../b',
    'a\\b',
    'a:b',
    '.GIT/x',
    'x/.Typstoria/y',
  ])('rejects unsafe path %s', (path) => {
    expect(filePathError(path, [])).not.toBe('');
  });

  it('rejects canonically equivalent duplicates and file-directory collisions', () => {
    expect(filePathError('café.typ', [file(1, 'cafe\u0301.typ')])).toContain('існує');
    expect(filePathError('docs/guide.typ', [file(1, 'docs')])).toContain('конфліктує');
    expect(filePathError('docs', [file(1, 'docs/guide.typ')])).toContain('конфліктує');
  });

  it('excludes the file being renamed', () => {
    expect(filePathError('same.typ', [file(1, 'same.typ')], 1)).toBe('');
    expect(filePathError('same.typ', [file(1, 'same.typ'), file(2, 'same.typ')], 1)).not.toBe('');
  });

  it('enforces UTF-8 segment and full path boundaries', () => {
    expect(filePathError(`${'a'.repeat(251)}.typ`, [])).toBe('');
    expect(filePathError(`${'a'.repeat(252)}.typ`, [])).toContain('255 байтів');
    const tooLong = ['a', 'b', 'c', 'd', 'e'].map((part) => part.repeat(205)).join('/');
    expect(filePathError(tooLong, [])).toContain('1024 байти');
    expect(filePathError(`${'🧪'.repeat(64)}.typ`, [])).toContain('255 байтів');
  });

  it('rejects control characters and invalid surrogate sequences', () => {
    expect(filePathError('a\u0085b', [])).not.toBe('');
    expect(filePathError(`a${String.fromCharCode(0xd800)}b`, [])).toContain('Unicode');
  });
});
