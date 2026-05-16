const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export async function gzipEncode(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  const json = JSON.stringify(value);
  const stream = new Blob([TEXT_ENCODER.encode(json) as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function gzipDecode<T = unknown>(bytes: Uint8Array): Promise<T> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = TEXT_DECODER.decode(await new Response(stream).arrayBuffer());
  return JSON.parse(text) as T;
}
