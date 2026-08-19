import { DataHistoryItem } from '@jetstream/types';

/**
 * Every file-backed entry directory contains a `manifest.json` snapshot of its metadata row. This
 * makes entry folders self-describing so user-visible backends (File System Access / native
 * filesystem) can re-index Dexie rows from disk after a folder is moved or restored.
 */

/** Bump when the manifest shape changes incompatibly — re-index ignores manifests from other versions */
export const DATA_HISTORY_MANIFEST_VERSION = 1;

export function buildManifestJson(item: DataHistoryItem): string {
  return JSON.stringify({ manifestVersion: DATA_HISTORY_MANIFEST_VERSION, ...item }, null, 2);
}
