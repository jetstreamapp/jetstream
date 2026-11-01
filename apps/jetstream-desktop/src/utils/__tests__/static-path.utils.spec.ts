import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveStaticFilePath, StaticPathImpl } from '../static-path.utils';

const ALLOWED_SUBDIRS = ['assets', 'client'];

/**
 * Both path flavours are exercised on every platform by injecting the implementation: the Windows
 * separator handling is the whole point, and CI for this app runs on macOS/Linux too.
 */
const PLATFORMS: Array<{ name: string; pathImpl: StaticPathImpl; rootDir: string }> = [
  { name: 'posix', pathImpl: path.posix, rootDir: '/opt/jetstream/dist' },
  { name: 'win32', pathImpl: path.win32, rootDir: 'C:\\Program Files\\Jetstream\\dist' },
];

describe('resolveStaticFilePath', () => {
  describe.each(PLATFORMS)('$name', ({ pathImpl, rootDir }) => {
    const resolveUnderRoot = (pathname: string) => resolveStaticFilePath({ rootDir, pathname, allowedSubdirs: ALLOWED_SUBDIRS, pathImpl });
    const expectedFile = (...segments: string[]) => pathImpl.resolve(rootDir, ...segments);

    it('serves files under the allowed subfolders', () => {
      expect(resolveUnderRoot('/client/index.html')).toBe(expectedFile('client', 'index.html'));
      expect(resolveUnderRoot('/client/nested/app.js')).toBe(expectedFile('client', 'nested', 'app.js'));
      expect(resolveUnderRoot('/assets/x.png')).toBe(expectedFile('assets', 'x.png'));
    });

    it('serves the production client URL path (app://jetstream/client/index.html)', () => {
      const { pathname } = new URL('app://jetstream/client/index.html');
      expect(resolveUnderRoot(pathname)).toBe(expectedFile('client', 'index.html'));
    });

    it('refuses backslash traversal, raw and percent-encoded', () => {
      expect(resolveUnderRoot('/client/..\\..\\secret')).toBeNull();
      expect(resolveUnderRoot('/client\\..\\secret')).toBeNull();
      expect(resolveUnderRoot('/client/%5c..%5c')).toBeNull();
      expect(resolveUnderRoot('/client/%5C..%5C..%5Csecret')).toBeNull();
      expect(resolveUnderRoot('/client/safe\\name.txt')).toBeNull();
    });

    it('refuses dot segments even though the URL parser normally removes them', () => {
      expect(resolveUnderRoot('/client/../assets/x')).toBeNull();
      expect(resolveUnderRoot('/client/./index.html')).toBeNull();
      expect(resolveUnderRoot('/client/..')).toBeNull();
    });

    it('refuses a sibling folder that only shares the allowed prefix', () => {
      expect(resolveUnderRoot('/clientx/..')).toBeNull();
      expect(resolveUnderRoot('/clientx/file.js')).toBeNull();
      expect(resolveUnderRoot('/assets2/x.png')).toBeNull();
    });

    it('refuses anything outside the allowed subfolders', () => {
      expect(resolveUnderRoot('/other/file')).toBeNull();
      expect(resolveUnderRoot('/main.js')).toBeNull();
      expect(resolveUnderRoot('/')).toBeNull();
      expect(resolveUnderRoot('/client')).toBeNull();
      expect(resolveUnderRoot('/client/')).toBeNull();
    });

    it('refuses null bytes and non-absolute pathnames', () => {
      expect(resolveUnderRoot('/client/index.html\0.js')).toBeNull();
      expect(resolveUnderRoot('/client/index%00.html')).toBeNull();
      expect(resolveUnderRoot('client/index.html')).toBeNull();
      expect(resolveUnderRoot('')).toBeNull();
    });
  });

  it('a backslash traversal that passes a prefix check would escape the root on win32 without the guard', () => {
    // Documents the exact bug class this helper exists for: `path.win32.resolve` treats `\` as a
    // separator, so the unguarded `join(__dirname, pathname)` climbed out of the bundle folder.
    const escaped = path.win32.resolve('C:\\app\\dist', '.' + '/client/..\\..\\secret');
    expect(escaped).toBe('C:\\app\\secret');
    expect('/client/..\\..\\secret'.startsWith('/client/')).toBe(true);
  });

  it('only accepts dot-segment-free pathnames the real URL parser produces', () => {
    // The parser collapses forward-slash traversal before we ever see it; what remains is in-bounds
    const { pathname } = new URL('app://jetstream/client/../assets/x.png');
    expect(pathname).toBe('/assets/x.png');
    expect(resolveStaticFilePath({ rootDir: '/opt/dist', pathname, allowedSubdirs: ALLOWED_SUBDIRS, pathImpl: path.posix })).toBe(
      '/opt/dist/assets/x.png',
    );
  });
});
