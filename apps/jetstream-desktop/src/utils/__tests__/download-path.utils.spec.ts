import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  claimAvailableDownloadPath,
  getNumberedFilePath,
  isDownloadPathClaimed,
  MAX_FILE_NAME_BYTES,
  MAX_NUMBERED_FILE_NAME_ATTEMPTS,
  releaseDownloadPath,
  tryClaimDownloadPath,
} from '../download-path.utils';

describe('getNumberedFilePath', () => {
  it('adds the number before the extension', () => {
    expect(getNumberedFilePath('/downloads/results.csv', 2)).toBe('/downloads/results (2).csv');
    expect(getNumberedFilePath('/downloads/archive.tar.gz', 1)).toBe('/downloads/archive.tar (1).gz');
  });

  it('appends the number when there is no extension', () => {
    expect(getNumberedFilePath('/downloads/download', 1)).toBe('/downloads/download (1)');
  });

  it('shortens a name close to the length limit so the numbered name still fits', () => {
    const numberedPath = getNumberedFilePath(`/downloads/${'a'.repeat(250)}.csv`, 12);
    const numberedName = numberedPath.slice('/downloads/'.length);

    expect(Buffer.byteLength(numberedName)).toBe(MAX_FILE_NAME_BYTES);
    expect(numberedName).toBe(`${'a'.repeat(MAX_FILE_NAME_BYTES - ' (12).csv'.length)} (12).csv`);
  });

  it('never splits a multi-byte character when shortening a name', () => {
    // 3 bytes per character: 83 characters + `.csv` = 253 bytes, leaving room for 82 characters + ` (1).csv`
    const numberedPath = getNumberedFilePath(`/downloads/${'界'.repeat(83)}.csv`, 1);
    const numberedName = numberedPath.slice('/downloads/'.length);

    expect(Buffer.byteLength(numberedName)).toBeLessThanOrEqual(MAX_FILE_NAME_BYTES);
    expect(numberedName).toBe(`${'界'.repeat(82)} (1).csv`);
  });

  it('shortens the whole name when the extension alone leaves no room for the number', () => {
    const numberedPath = getNumberedFilePath(`/downloads/a.${'b'.repeat(253)}`, 1);
    const numberedName = numberedPath.slice('/downloads/'.length);

    expect(Buffer.byteLength(numberedName)).toBe(MAX_FILE_NAME_BYTES);
    expect(numberedName.endsWith(' (1)')).toBe(true);
  });
});

describe('tryClaimDownloadPath', () => {
  it('claims a path only once until it is released', () => {
    const filePath = join(tmpdir(), 'jetstream-try-claim', 'results.csv');
    try {
      expect(tryClaimDownloadPath(filePath)).toBe(true);
      expect(tryClaimDownloadPath(filePath)).toBe(false);
      releaseDownloadPath(filePath);
      expect(tryClaimDownloadPath(filePath)).toBe(true);
    } finally {
      releaseDownloadPath(filePath);
    }
  });
});

describe('claimAvailableDownloadPath', () => {
  let downloadDir: string;
  const claimedPaths: string[] = [];

  function claim(fileName: string) {
    const claimedPath = claimAvailableDownloadPath(join(downloadDir, fileName));
    if (claimedPath) {
      claimedPaths.push(claimedPath);
    }
    return claimedPath;
  }

  beforeEach(async () => {
    downloadDir = await fs.mkdtemp(join(tmpdir(), 'jetstream-download-path-'));
  });

  afterEach(async () => {
    claimedPaths.splice(0).forEach(releaseDownloadPath);
    await fs.rm(downloadDir, { recursive: true, force: true });
  });

  it('uses the requested name when it is free', () => {
    expect(claim('results.csv')).toBe(join(downloadDir, 'results.csv'));
    expect(isDownloadPathClaimed(join(downloadDir, 'results.csv'))).toBe(true);
  });

  it('adds a number when the file already exists', async () => {
    await fs.writeFile(join(downloadDir, 'results.csv'), 'existing');

    expect(claim('results.csv')).toBe(join(downloadDir, 'results (1).csv'));
  });

  it('gives downloads in progress with the same name their own names', () => {
    expect(claim('results.csv')).toBe(join(downloadDir, 'results.csv'));
    expect(claim('results.csv')).toBe(join(downloadDir, 'results (1).csv'));
    expect(claim('results.csv')).toBe(join(downloadDir, 'results (2).csv'));
  });

  it('makes the name available again once released', () => {
    const claimedPath = claim('results.csv') as string;
    releaseDownloadPath(claimedPath);

    expect(isDownloadPathClaimed(claimedPath)).toBe(false);
    expect(claim('results.csv')).toBe(claimedPath);
  });

  it('returns null when every candidate name is taken', () => {
    for (let i = 0; i < MAX_NUMBERED_FILE_NAME_ATTEMPTS; i++) {
      claim('results.csv');
    }

    expect(claim('results.csv')).toBeNull();
  });
});
