import { describe, expect, it } from 'vitest';
import { getEntryDirPath, getEntryFilePath, getOrgFolderName, getParentDirPath, splitRelativePath } from '../file-store/path-utils';

describe('splitRelativePath', () => {
  it('splits a valid relative path', () => {
    expect(splitRelativePath('org-abc123/dh_key/results.csv.gz')).toEqual(['org-abc123', 'dh_key', 'results.csv.gz']);
  });

  it('allows single-segment paths', () => {
    expect(splitRelativePath('index-meta.json')).toEqual(['index-meta.json']);
  });

  it.each(['', 'a//b', '../evil', 'a/../b', 'a/./b', '/absolute/path', 'a/b\\c', 'a/b c', 'a/b*'])('rejects unsafe path: %s', (path) => {
    expect(() => splitRelativePath(path)).toThrow();
  });
});

describe('path builders', () => {
  it('builds entry dir and file paths', () => {
    expect(getEntryDirPath('org-1', 'dh_a')).toBe('org-1/dh_a');
    expect(getEntryFilePath('org-1', 'dh_a', 'input.csv.gz')).toBe('org-1/dh_a/input.csv.gz');
  });

  it('resolves the parent dir of a file path', () => {
    expect(getParentDirPath('org-1/dh_a/input.csv.gz')).toBe('org-1/dh_a');
  });
});

describe('getOrgFolderName', () => {
  it('sanitizes unsafe characters and appends a stable hash', async () => {
    const folder = await getOrgFolderName('00D8b:test@example.com/Prod Org!');
    expect(folder).toMatch(/^[a-z0-9_-]+-[0-9a-f]{8}$/);
    expect(splitRelativePath(folder)).toHaveLength(1);
  });

  it('is deterministic and collision-resistant for ids that sanitize identically', async () => {
    const folderA1 = await getOrgFolderName('org:a');
    const folderA2 = await getOrgFolderName('org:a');
    const folderB = await getOrgFolderName('org!a');
    expect(folderA1).toBe(folderA2);
    expect(folderA1).not.toBe(folderB);
  });
});
