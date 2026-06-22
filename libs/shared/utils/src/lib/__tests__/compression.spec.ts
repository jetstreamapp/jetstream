// @vitest-environment node
// gzip helpers use Blob.stream()/CompressionStream, which jsdom does not implement; Node's Web Streams do.
import { describe, expect, it } from 'vitest';
import { gzipDecode, gzipEncode } from '../compression';

describe('gzipEncode / gzipDecode', () => {
  it('round-trips a simple object', async () => {
    const value = { phase: 'field_usage_v1', truncated: false, count: 3 };
    const encoded = await gzipEncode(value);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.byteLength).toBeGreaterThan(0);
    await expect(gzipDecode(encoded)).resolves.toEqual(value);
  });

  it('round-trips deeply nested structures and arrays', async () => {
    const value = {
      objects: {
        Account: { fieldUsage: { Name__c: { filled: 10, pct: 50, latestFilledRowModified: null } } },
      },
      whereUsed: { 'Account.Name__c': [{ type: 'ApexClass', name: 'Foo', kind: 'apex' }] },
      failedObjects: ['Contact', 'Lead'],
    };
    await expect(gzipDecode(await gzipEncode(value))).resolves.toEqual(value);
  });

  it('handles large payloads (many records) without loss', async () => {
    const value = {
      rows: Array.from({ length: 5000 }, (_, index) => ({ id: index, name: `Field_${index}__c`, pct: index % 100 })),
    };
    const decoded = await gzipDecode<typeof value>(await gzipEncode(value));
    expect(decoded.rows).toHaveLength(5000);
    expect(decoded.rows[4999]).toEqual({ id: 4999, name: 'Field_4999__c', pct: 99 });
  });

  it('preserves unicode content', async () => {
    const value = { label: 'Coût — naïve 日本語 😀' };
    await expect(gzipDecode(await gzipEncode(value))).resolves.toEqual(value);
  });
});
