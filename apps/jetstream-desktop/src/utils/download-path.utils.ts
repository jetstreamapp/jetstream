import { existsSync } from 'node:fs';
import { extname } from 'node:path';

export const MAX_NUMBERED_FILE_NAME_ATTEMPTS = 1000;

/**
 * Paths picked for Chromium downloads (`will-download`) that are still in progress. Chromium only creates the file
 * once the download completes, so without this, two downloads of the same name would both pick it and the second
 * would replace the first.
 */
const claimedDownloadPaths = new Set<string>();

/** `results.csv` -> `results (2).csv` */
export function getNumberedFilePath(filePath: string, number: number) {
  const extension = extname(filePath);
  return `${filePath.slice(0, filePath.length - extension.length)} (${number})${extension}`;
}

/** `results.csv`, `results (1).csv`, `results (2).csv`, ... */
export function* getCandidateFilePaths(filePath: string) {
  yield filePath;
  for (let number = 1; number < MAX_NUMBERED_FILE_NAME_ATTEMPTS; number++) {
    yield getNumberedFilePath(filePath, number);
  }
}

export function isDownloadPathClaimed(filePath: string) {
  return claimedDownloadPaths.has(filePath);
}

/**
 * Pick the first of `name.ext`, `name (1).ext`, ... that is neither on disk nor claimed by another download in
 * progress, and claim it until `releaseDownloadPath` is called.
 *
 * @returns null if every candidate name is taken
 */
export function claimAvailableDownloadPath(filePath: string): string | null {
  for (const candidatePath of getCandidateFilePaths(filePath)) {
    if (!claimedDownloadPaths.has(candidatePath) && !existsSync(candidatePath)) {
      claimedDownloadPaths.add(candidatePath);
      return candidatePath;
    }
  }
  return null;
}

export function releaseDownloadPath(filePath: string) {
  claimedDownloadPaths.delete(filePath);
}
