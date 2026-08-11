import { DataHistoryItem } from '@jetstream/types';

/**
 * Every file-backed entry directory contains a `manifest.json` snapshot of its metadata row. This
 * makes entry folders self-describing so user-visible backends (File System Access / native
 * filesystem) can re-index Dexie rows from disk after a folder is moved or restored.
 */
export function buildManifestJson(item: DataHistoryItem): string {
  return JSON.stringify({ manifestVersion: 1, ...item }, null, 2);
}
