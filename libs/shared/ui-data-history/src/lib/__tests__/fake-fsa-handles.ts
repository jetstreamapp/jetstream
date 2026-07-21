import { FsaDirectoryHandle, FsaFileHandle, FsaPermissionState, FsaWritableFileStream } from '../file-store/fsa-types';

/**
 * In-memory File System Access API handles for testing `DirectoryHandleFileStore` — jsdom has no
 * FSA implementation. Mirrors Chromium semantics for the small surface the store uses.
 */

export class FakeFsaFileHandle implements FsaFileHandle {
  readonly kind = 'file' as const;
  bytes: Uint8Array = new Uint8Array(0);

  constructor(public readonly name: string) {}

  async getFile(): Promise<File> {
    // The store only uses Blob APIs (stream/arrayBuffer/text) — a Blob is sufficient
    return new Blob([this.bytes as BlobPart]) as unknown as File;
  }

  async createWritable(): Promise<FsaWritableFileStream> {
    const chunks: Uint8Array[] = [];
    let aborted = false;
    return {
      write: async (chunk: Uint8Array | Blob) => {
        chunks.push(ArrayBuffer.isView(chunk) ? chunk : new Uint8Array(await chunk.arrayBuffer()));
      },
      close: async () => {
        if (!aborted) {
          this.bytes = concatChunks(chunks);
        }
      },
      abort: async () => {
        aborted = true;
      },
    };
  }
}

export class FakeFsaDirectoryHandle implements FsaDirectoryHandle {
  readonly kind = 'directory' as const;
  directories = new Map<string, FakeFsaDirectoryHandle>();
  files = new Map<string, FakeFsaFileHandle>();
  permissionState: FsaPermissionState = 'granted';
  permissionStateAfterRequest: FsaPermissionState = 'granted';

  constructor(public readonly name = 'history-root') {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsaDirectoryHandle> {
    let dir = this.directories.get(name);
    if (!dir) {
      if (!options?.create) {
        throw new DOMException(`Directory not found: ${name}`, 'NotFoundError');
      }
      dir = new FakeFsaDirectoryHandle(name);
      this.directories.set(name, dir);
    }
    return dir;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FsaFileHandle> {
    let file = this.files.get(name);
    if (!file) {
      if (!options?.create) {
        throw new DOMException(`File not found: ${name}`, 'NotFoundError');
      }
      file = new FakeFsaFileHandle(name);
      this.files.set(name, file);
    }
    return file;
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }): Promise<void> {
    if (!this.directories.delete(name) && !this.files.delete(name)) {
      throw new DOMException(`Entry not found: ${name}`, 'NotFoundError');
    }
  }

  async *values(): AsyncIterableIterator<FsaDirectoryHandle | FsaFileHandle> {
    yield* this.directories.values();
    yield* this.files.values();
  }

  async queryPermission(): Promise<FsaPermissionState> {
    return this.permissionState;
  }

  async requestPermission(): Promise<FsaPermissionState> {
    this.permissionState = this.permissionStateAfterRequest;
    return this.permissionState;
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}
