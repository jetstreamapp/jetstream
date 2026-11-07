/**
 * Backpressure coverage for StreamingZip: a producer that fills the output queue must wait for the
 * consumer to read before it can append more, and must be released when the consumer goes away.
 */
import { describe, expect, it } from 'vitest';
import { StreamingZip, ZIP_OUTPUT_HIGH_WATER_MARK_BYTES } from '../zip-utils';

const nextMacrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Track whether a promise has settled without awaiting it */
const trackSettled = (promise: Promise<unknown>) => {
  const state = { settled: false };
  promise.then(
    () => (state.settled = true),
    () => (state.settled = true),
  );
  return state;
};

describe('StreamingZip backpressure', () => {
  it('pauses appendData until the consumer drains the queue', async () => {
    const zip = new StreamingZip();
    const reader = zip.outputStream.getReader();
    await zip.startFile('file.bin');

    // A chunk the size of the high water mark fills the queue on its own
    const appendState = trackSettled(zip.appendData(new Uint8Array(ZIP_OUTPUT_HIGH_WATER_MARK_BYTES)));
    await nextMacrotask();
    expect(appendState.settled).toBe(false);

    // Reading the header and then the chunk drains the queue, which releases the producer
    await reader.read();
    await reader.read();
    await nextMacrotask();
    expect(appendState.settled).toBe(true);

    reader.releaseLock();
  });

  it('does not pause appendData while the queue is below the high water mark', async () => {
    const zip = new StreamingZip();
    zip.outputStream.getReader();
    await zip.startFile('file.bin');

    const appendState = trackSettled(zip.appendData(new Uint8Array(ZIP_OUTPUT_HIGH_WATER_MARK_BYTES / 4)));
    await nextMacrotask();
    expect(appendState.settled).toBe(true);
  });

  it('releases a paused producer when the consumer cancels the stream', async () => {
    const zip = new StreamingZip();
    const reader = zip.outputStream.getReader();
    await zip.startFile('file.bin');

    const appendState = trackSettled(zip.appendData(new Uint8Array(ZIP_OUTPUT_HIGH_WATER_MARK_BYTES)));
    await nextMacrotask();
    expect(appendState.settled).toBe(false);

    await reader.cancel();
    await nextMacrotask();
    expect(appendState.settled).toBe(true);
    expect(zip.isAborted()).toBe(true);
  });
});
