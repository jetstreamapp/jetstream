/**
 * gzip helpers shared by every file-store backend that compresses in the browser (the OPFS worker
 * and the user-chosen-folder store): the stream encoders a write stream drives, and the bounded
 * read that caps those same decompression streams. Uses the platform `CompressionStream` — no
 * dependencies, so importing this does not grow the worker bundle.
 *
 * `gzipEncode`/`gzipDecode` in `@jetstream/shared/utils` are JSON-oriented (they stringify/parse);
 * these deal in raw bytes and streams.
 */

export async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Collect at most `maxBytes` from a stream, then CANCEL it — the whole point of a capped read.
 * `new Response(stream).blob()` followed by a slice would decompress the entire file first, which
 * on a large bulk-load results file is exactly the work the cap exists to avoid.
 */
export async function readStreamUpTo(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Blob> {
  const reader = stream.getReader();
  const chunks: BlobPart[] = [];
  let bytesRead = 0;
  try {
    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const remaining = maxBytes - bytesRead;
      chunks.push((value.byteLength > remaining ? value.subarray(0, remaining) : value) as BlobPart);
      bytesRead += value.byteLength;
    }
  } finally {
    // Releases the underlying source (and the file handle behind it) without draining the rest
    await abortQuietly(reader.cancel());
  }
  return new Blob(chunks);
}

/**
 * The read side every browser backend shares once it holds the stored `Blob`: a plain file is sliced
 * (a `File` is lazily backed, so slicing reads only the window asked for), a gzip'd one is inflated
 * through `DecompressionStream` and — with `maxBytes` — capped AT THE STREAM rather than inflated in
 * full and sliced afterwards, which would defeat the cap.
 */
export async function readStoredBlob(file: Blob, { gunzip, maxBytes }: { gunzip: boolean; maxBytes?: number }): Promise<Blob> {
  if (!gunzip) {
    return maxBytes == null ? file : file.slice(0, maxBytes);
  }
  const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
  return maxBytes == null ? await new Response(stream).blob() : await readStreamUpTo(stream, maxBytes);
}

/** Await a cleanup promise that is allowed to fail (already closed/errored streams) */
export async function abortQuietly(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // already closed/errored
  }
}

/**
 * What a write stream drives between the caller's chunks and the backend's sink. A backend picks
 * `createGzipEncoder` or `createPassthroughEncoder` when the stream opens and then runs ONE
 * write/close/abort lifecycle — rather than carrying "gzip or not" as optional state and branching on
 * it at every step, which is how a teardown path gets written once per branch per backend.
 */
export interface StreamEncoder {
  /** Hand one chunk towards the sink. Rejects if the sink has failed — never hangs. */
  write(chunk: Uint8Array): Promise<void>;
  /** Flush anything still buffered (the gzip trailer) and wait for every byte to reach the sink. */
  close(): Promise<void>;
  /** Best-effort teardown; the caller still discards its partial file. */
  abort(): Promise<void>;
}

export type StreamEncoderSink = (chunk: Uint8Array) => Promise<void> | void;

/** Uncompressed streams: every chunk goes straight to the sink; nothing is buffered, so close/abort are no-ops. */
export function createPassthroughEncoder(writeChunk: StreamEncoderSink): StreamEncoder {
  return {
    write: async (chunk: Uint8Array) => {
      await writeChunk(chunk);
    },
    close: async () => undefined,
    abort: async () => undefined,
  };
}

/**
 * Incremental gzip encoder over a caller-supplied sink: each compressed chunk is handed to
 * `writeCompressedChunk` as it comes out of the `CompressionStream`. The two backends differ only in
 * that sink — an FSA writable stream vs. an OPFS sync access handle at an offset.
 *
 * A failed drain is recorded and re-thrown from the next `write`/`close`, and the writer is aborted
 * so backpressure is released. Without that, a sink failure (disk full, revoked permission) would
 * park the next `write()` forever on a readable nothing is draining — hanging the capture queue with
 * the file still locked.
 */
export function createGzipEncoder(writeCompressedChunk: StreamEncoderSink): StreamEncoder {
  const compression = new CompressionStream('gzip');
  const writer = compression.writable.getWriter();
  const reader = compression.readable.getReader();
  let drainError: Error | undefined;

  const drain = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await writeCompressedChunk(value);
    }
  })().catch(async (ex) => {
    drainError = ex instanceof Error ? ex : new Error(String(ex));
    await abortQuietly(writer.abort(drainError));
  });

  return {
    write: async (chunk: Uint8Array) => {
      if (drainError) {
        throw drainError;
      }
      // structured clone always yields a plain ArrayBuffer-backed view, never SharedArrayBuffer
      await writer.write(chunk as Uint8Array<ArrayBuffer>);
    },
    close: async () => {
      if (drainError) {
        throw drainError;
      }
      await writer.close();
      await drain;
      if (drainError) {
        throw drainError;
      }
    },
    abort: async () => {
      await abortQuietly(writer.abort());
      await abortQuietly(drain);
    },
  };
}
