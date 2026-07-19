/**
 * Pure path helpers shared by the main thread and the storage worker. Paths are always RELATIVE
 * (`<orgFolder>/<entryKey>/<fileName>`) and validated before touching any filesystem so a
 * corrupted row can never traverse outside the history root in any backend.
 */

const SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;

export const DATA_HISTORY_ROOT_DIR = 'jetstream-history';

export const DATA_HISTORY_FILE_NAMES = {
  manifest: 'manifest.json',
  inputCsv: 'input.csv.gz',
  requestJson: 'request.json.gz',
  resultsCsv: 'results.csv.gz',
  resultsJson: 'results.json.gz',
} as const;

/** Split and validate a relative path. Throws on empty/unsafe segments or traversal attempts. */
export function splitRelativePath(relativePath: string): string[] {
  const segments = relativePath.split('/');
  if (segments.length === 0) {
    throw new Error(`Invalid path: ${relativePath}`);
  }
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || !SAFE_SEGMENT_REGEX.test(segment)) {
      throw new Error(`Invalid path segment in: ${relativePath}`);
    }
  }
  return segments;
}

export function getEntryDirPath(orgFolder: string, entryKey: string): string {
  return `${orgFolder}/${entryKey}`;
}

export function getEntryFilePath(orgFolder: string, entryKey: string, fileName: string): string {
  return `${orgFolder}/${entryKey}/${fileName}`;
}

/** `<orgFolder>/<entryKey>/<fileName>` -> `<orgFolder>/<entryKey>` */
export function getParentDirPath(relativeFilePath: string): string {
  const segments = splitRelativePath(relativeFilePath);
  return segments.slice(0, -1).join('/');
}

/**
 * Stable, filesystem-safe folder name for an org. The readable prefix keeps user-visible backends
 * (FSA/native) meaningful; the hash suffix prevents collisions between org ids that sanitize to
 * the same string.
 */
export async function getOrgFolderName(orgUniqueId: string): Promise<string> {
  const sanitized =
    orgUniqueId
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'org';
  const hash = await sha1Hex(orgUniqueId);
  return `${sanitized}-${hash.slice(0, 8)}`;
}

async function sha1Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
