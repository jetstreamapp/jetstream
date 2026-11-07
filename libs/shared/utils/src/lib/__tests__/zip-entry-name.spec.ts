import { describe, expect, it } from 'vitest';
import { sanitizeZipEntryName } from '../zip-entry-name';

describe('sanitizeZipEntryName', () => {
  it.each([
    ['Quarterly Report', 'Quarterly Report'],
    ['invoice (2)', 'invoice (2)'],
    ['résumé – final', 'résumé – final'],
    ['Photo 2024.01.02', 'Photo 2024.01.02'],
    ['a0B5g00000AbCdEEAU', 'a0B5g00000AbCdEEAU'],
  ])('keeps an ordinary name unchanged (%s)', (name, expected) => {
    expect(sanitizeZipEntryName(name)).toBe(expected);
  });

  it.each([
    ['../../.bashrc', 'bashrc'],
    ['..\\..\\Startup\\x.bat', 'Startup_x.bat'],
    ['/etc/passwd', 'etc_passwd'],
    ['C:\\Windows\\win.ini', 'C:_Windows_win.ini'],
    ['foo/bar/baz', 'foo_bar_baz'],
    ['foo//bar', 'foo_bar'],
    ['./hidden', 'hidden'],
    ['..', ''],
    ['.', ''],
    ['...', ''],
    ['/', ''],
    ['\\\\server\\share\\file', 'server_share_file'],
    ['.hidden', 'hidden'],
    ['..config', 'config'],
    [' . ..  spaced', 'spaced'],
  ])('neutralizes path separators and dot segments (%s)', (name, expected) => {
    expect(sanitizeZipEntryName(name)).toBe(expected);
  });

  it.each([
    ['file\x00name', 'filename'],
    ['file\nname', 'filename'],
    ['file\tname', 'filename'],
    ['file\x7fname', 'filename'],
    ['\x00../\x00../x', 'x'],
  ])('removes NUL and control characters (%s)', (name, expected) => {
    expect(sanitizeZipEntryName(name)).toBe(expected);
  });

  it.each([
    ['  padded  ', 'padded'],
    ['\t\ttabbed\t', 'tabbed'],
    [' a / b ', 'a_b'],
  ])('trims whitespace (%s)', (name, expected) => {
    expect(sanitizeZipEntryName(name)).toBe(expected);
  });

  it.each(['', '   ', '..', '/', '\\', '\x00', null, undefined])('returns the fallback when nothing usable is left (%s)', (name) => {
    expect(sanitizeZipEntryName(name, '00P000000000001AAA')).toBe('00P000000000001AAA');
  });

  it('returns an empty string when there is no fallback and nothing usable is left', () => {
    expect(sanitizeZipEntryName('../')).toBe('');
  });
});
