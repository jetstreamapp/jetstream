import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearOpenableFiles, registerOpenableFile, resolveOpenableFile } from '../openable-file-registry';

describe('openable-file-registry', () => {
  beforeEach(() => {
    clearOpenableFiles();
  });

  it('refuses a path that was never registered', () => {
    expect(resolveOpenableFile('/tmp/not-downloaded.sh')).toBeNull();
  });

  it('refuses non-string and empty values', () => {
    expect(resolveOpenableFile(undefined)).toBeNull();
    expect(resolveOpenableFile(null)).toBeNull();
    expect(resolveOpenableFile(42)).toBeNull();
    expect(resolveOpenableFile('')).toBeNull();
    expect(resolveOpenableFile({ toString: () => '/tmp/x' })).toBeNull();
  });

  it('returns the resolved path for a registered download', () => {
    const filePath = resolve('/tmp/downloads/results.csv');
    registerOpenableFile(filePath);
    expect(resolveOpenableFile(filePath)).toBe(filePath);
  });

  it('matches a registered file by its resolved path, not its spelling', () => {
    const filePath = resolve('/tmp/downloads/results.csv');
    registerOpenableFile(filePath);
    expect(resolveOpenableFile('/tmp/downloads/./other/../results.csv')).toBe(filePath);
    // A path that merely shares a prefix with a registered download is still refused
    expect(resolveOpenableFile(filePath + '.exe')).toBeNull();
    expect(resolveOpenableFile(join(filePath, '..', 'evil.sh'))).toBeNull();
  });

  it('keeps only the most recent 200 registrations', () => {
    const paths = Array.from({ length: 201 }, (_, i) => resolve(`/tmp/downloads/file-${i}.csv`));
    paths.forEach((path) => registerOpenableFile(path));
    expect(resolveOpenableFile(paths[0])).toBeNull();
    expect(resolveOpenableFile(paths[1])).toBe(paths[1]);
    expect(resolveOpenableFile(paths[200])).toBe(paths[200]);
  });

  it('re-registering a path refreshes its position instead of letting it age out', () => {
    const first = resolve('/tmp/downloads/file-first.csv');
    registerOpenableFile(first);
    for (let i = 0; i < 199; i++) {
      registerOpenableFile(resolve(`/tmp/downloads/file-${i}.csv`));
    }
    registerOpenableFile(first);
    registerOpenableFile(resolve('/tmp/downloads/file-overflow.csv'));
    expect(resolveOpenableFile(first)).toBe(first);
    expect(resolveOpenableFile(resolve('/tmp/downloads/file-0.csv'))).toBeNull();
  });
});
