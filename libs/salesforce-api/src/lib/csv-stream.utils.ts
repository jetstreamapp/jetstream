const NEWLINE_BYTE = 0x0a;

export type CsvStreamSource = () => Promise<ReadableStream<Uint8Array>>;

/**
 * Concatenate CSV streams that each start with the same header row into one CSV stream with a single header.
 *
 * Sources are opened lazily and read one at a time, in order, as the consumer pulls, so only one upstream
 * response is open at once. The header line of sources 2..n is dropped at the byte level (everything up to and
 * including the first newline, even when that line spans multiple chunks).
 *
 * Any failure opening or reading a source errors the combined stream - a partial result is never presented as
 * complete. Cancelling the combined stream cancels the source that is currently being read.
 */
export function concatenateCsvStreams(sources: CsvStreamSource[]): ReadableStream<Uint8Array> {
  let sourceIndex = 0;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let isCurrentSourceHeaderPending = false;
  let lastEmittedByte: number | undefined;
  let isRowSeparatorPending = false;
  let isCancelled = false;

  return new ReadableStream<Uint8Array>({
    pull: async (controller) => {
      while (!isCancelled) {
        if (!currentReader) {
          if (sourceIndex >= sources.length) {
            controller.close();
            return;
          }
          const source = await sources[sourceIndex]();
          if (isCancelled) {
            await source.cancel();
            return;
          }
          currentReader = source.getReader();
          isCurrentSourceHeaderPending = sourceIndex > 0;
          sourceIndex++;
        }

        const { done, value } = await currentReader.read();
        if (done) {
          currentReader.releaseLock();
          currentReader = undefined;
          continue;
        }

        let chunk = value;
        if (isCurrentSourceHeaderPending) {
          const newlineIndex = chunk.indexOf(NEWLINE_BYTE);
          if (newlineIndex === -1) {
            // header line continues in the next chunk
            continue;
          }
          isCurrentSourceHeaderPending = false;
          chunk = chunk.subarray(newlineIndex + 1);
          // Guard against a previous source that did not end with a newline, which would merge two rows.
          // Deferred until data is actually emitted, since the header may arrive in a chunk of its own.
          isRowSeparatorPending = lastEmittedByte !== undefined && lastEmittedByte !== NEWLINE_BYTE;
        }

        if (chunk.byteLength > 0 && !isCancelled) {
          if (isRowSeparatorPending) {
            isRowSeparatorPending = false;
            controller.enqueue(new Uint8Array([NEWLINE_BYTE]));
          }
          lastEmittedByte = chunk[chunk.byteLength - 1];
          controller.enqueue(chunk);
          return;
        }
      }
    },
    cancel: async (reason) => {
      isCancelled = true;
      await currentReader?.cancel(reason);
    },
  });
}
