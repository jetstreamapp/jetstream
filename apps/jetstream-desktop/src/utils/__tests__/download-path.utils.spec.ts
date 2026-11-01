import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  claimAvailableDownloadPath,
  getNumberedFilePath,
  isDownloadPathClaimed,
  MAX_NUMBERED_FILE_NAME_ATTEMPTS,
  releaseDownloadPath,
} from '../download-path.utils';

describe('getNumberedFilePath', () => {
  it('adds the number before the extension', () => {
    expect(getNumberedFilePath('/downloads/results.csv', 2)).toBe('/downloads/results (2).csv');
    expect(getNumberedFilePath('/downloads/archive.tar.gz', 1)).toBe('/downloads/archive.tar (1).gz');
  });

  it('appends the number when there is no extension', () => {
    expect(getNumberedFilePath('/downloads/download', 1)).toBe('/downloads/download (1)');
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
