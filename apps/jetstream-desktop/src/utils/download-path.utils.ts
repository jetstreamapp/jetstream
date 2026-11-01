import { existsSync } from 'node:fs';
import { basename, extname } from 'node:path';

export const MAX_NUMBERED_FILE_NAME_ATTEMPTS = 1000;

/** Most file systems (APFS, NTFS, ext4) limit a single file name to 255 bytes or characters */
export const MAX_FILE_NAME_BYTES = 255;

/**
 * Paths picked for downloads that are still in progress - Chromium downloads (`will-download`), which only create
 * their file once complete, and native saves while they move their file into place. Without this, two downloads of
 * the same name could both pick it and the second would replace the first.
 */
const claimedDownloadPaths = new Set<string>();

/** Drop characters from the end until `value` is at most `maxBytes` long in UTF-8, never splitting a character */
export function truncateToByteLength(value: string, maxBytes: number) {
  const characters = Array.from(value);
  while (characters.length > 0 && Buffer.byteLength(characters.join('')) > maxBytes) {
    characters.pop();
  }
  return characters.join('');
}

/**
 * `results.csv` -> `results (2).csv`
 *
 * The name is shortened if needed so the numbered name still fits in `MAX_FILE_NAME_BYTES`. If the extension alone
 * leaves no room, the whole name is treated as the part to shorten.
 */
export function getNumberedFilePath(filePath: string, number: number) {
  const fileName = basename(filePath);
  const directoryPrefix = filePath.slice(0, filePath.length - fileName.length);
  const numberSuffix = ` (${number})`;

  let extension = extname(fileName);
  if (Buffer.byteLength(`${numberSuffix}${extension}`) >= MAX_FILE_NAME_BYTES) {
    extension = '';
  }
  const stem = fileName.slice(0, fileName.length - extension.length);
  const stemBudget = MAX_FILE_NAME_BYTES - Buffer.byteLength(`${numberSuffix}${extension}`);
  return `${directoryPrefix}${truncateToByteLength(stem, stemBudget)}${numberSuffix}${extension}`;
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
 * Claim `filePath` until `releaseDownloadPath` is called, without checking whether it exists on disk
 *
 * @returns false if another download in progress already claimed it
 */
export function tryClaimDownloadPath(filePath: string) {
  if (claimedDownloadPaths.has(filePath)) {
    return false;
  }
  claimedDownloadPaths.add(filePath);
  return true;
}

/**
 * Pick the first of `name.ext`, `name (1).ext`, ... that is neither on disk nor claimed by another download in
 * progress, and claim it until `releaseDownloadPath` is called.
 *
 * @returns null if every candidate name is taken
 */
export function claimAvailableDownloadPath(filePath: string): string | null {
  for (const candidatePath of getCandidateFilePaths(filePath)) {
    if (!existsSync(candidatePath) && tryClaimDownloadPath(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

export function releaseDownloadPath(filePath: string) {
  claimedDownloadPaths.delete(filePath);
}
