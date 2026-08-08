import { describe, expect, it } from 'vitest';
import {
  getEntryDirPath,
  getEntryFilePath,
  getOrgFolderName,
  getParentDirPath,
  getUserScopeDirName,
  splitRelativePath,
} from '../file-store/path-utils';

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

describe('getUserScopeDirName', () => {
  it('is deterministic for the same user id', async () => {
    expect(await getUserScopeDirName('user-123')).toBe(await getUserScopeDirName('user-123'));
  });

  it('produces a different directory for a different user id', async () => {
    expect(await getUserScopeDirName('user-a')).not.toBe(await getUserScopeDirName('user-b'));
  });

  it('never exposes the raw user id — canvas scopes by Salesforce username', async () => {
    const userId = 'someone@example.com.prod';
    const dirName = await getUserScopeDirName(userId);
    expect(dirName).not.toContain(userId);
    expect(dirName).toMatch(/^u-[0-9a-f]{16}$/);
  });

  it('is a single safe path segment, so backends can join it onto a root', async () => {
    expect(splitRelativePath(await getUserScopeDirName('user-123'))).toHaveLength(1);
  });

  it('rejects an empty user id rather than producing a shared directory', async () => {
    await expect(getUserScopeDirName('')).rejects.toThrow();
  });
});
