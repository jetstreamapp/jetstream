const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export async function gzipEncode(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  return gzipEncodeText(JSON.stringify(value));
}

export async function gzipEncodeText(value: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([TEXT_ENCODER.encode(value) as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function gzipDecode<T = unknown>(bytes: Uint8Array): Promise<T> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = TEXT_DECODER.decode(await new Response(stream).arrayBuffer());
  return JSON.parse(text) as T;
}
