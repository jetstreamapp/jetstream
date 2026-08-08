/**
 * Minimal typings for the File System Access API (user-chosen directories). These APIs are
 * Chromium-only and are not part of TypeScript's DOM lib, so we declare exactly what we use and
 * cast at the boundaries. See https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
 */

export type FsaPermissionState = 'granted' | 'denied' | 'prompt';

export interface FsaWritableFileStream {
  write(chunk: Uint8Array | Blob): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface FsaFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FsaWritableFileStream>;
}

export interface FsaDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsaDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsaFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<FsaDirectoryHandle | FsaFileHandle>;
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<FsaPermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<FsaPermissionState>;
}

interface WindowWithDirectoryPicker {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }): Promise<FsaDirectoryHandle>;
}

/** Whether this browser context can offer the user-chosen-folder backend */
export function isFileSystemAccessSupported(): boolean {
  try {
    return typeof window !== 'undefined' && typeof (window as unknown as WindowWithDirectoryPicker).showDirectoryPicker === 'function';
  } catch {
    return false;
  }
}

/** Must be called from a user gesture. Throws AbortError when the user cancels. */
export function showHistoryDirectoryPicker(): Promise<FsaDirectoryHandle> {
  return (window as unknown as WindowWithDirectoryPicker).showDirectoryPicker({
    id: 'jetstream-data-history',
    mode: 'readwrite',
    startIn: 'documents',
  });
}

/** Thrown when the persisted directory handle exists but read-write permission is not granted */
export class DataHistoryDirectoryPermissionError extends Error {
  constructor() {
    super('Permission to the data history folder has not been granted');
    this.name = 'DataHistoryDirectoryPermissionError';
  }
}
