import crypto from 'node:crypto';
import { escapeJsonForScript, getParts, verifyAndDecodeAsJson, verifySignature } from '../canvas.utils';

describe('escapeJsonForScript', () => {
  it('should produce output that JSON.parse can decode back to the original data', () => {
    const data = { name: "O'Connor", path: '</script><img onerror=alert(1)>', nested: { key: 'value' } };
    const escaped = escapeJsonForScript(JSON.stringify(data));
    const parsed = JSON.parse(escaped);
    expect(parsed).toEqual(data);
  });

  it('should escape < to prevent </script> breakout', () => {
    const json = JSON.stringify({ html: '</script><script>alert(1)</script>' });
    const escaped = escapeJsonForScript(json);
    expect(escaped).not.toContain('<');
    expect(escaped).toContain('\\u003c');
  });

  it('should escape > to prevent HTML injection', () => {
    const json = JSON.stringify({ value: '>' });
    const escaped = escapeJsonForScript(json);
    expect(escaped).not.toContain('>');
    expect(escaped).toContain('\\u003e');
  });

  it('should escape / to prevent </script> and <!-- sequences', () => {
    const json = JSON.stringify({ value: '/' });
    const escaped = escapeJsonForScript(json);
    expect(escaped).not.toContain('/');
    expect(escaped).toContain('\\u002f');
  });

  it('should escape single quotes that would break a JS single-quoted string', () => {
    const json = JSON.stringify({ name: "O'Connor" });
    const escaped = escapeJsonForScript(json);
    expect(escaped).not.toContain("'");
    expect(escaped).toContain('\\u0027');
  });

  it('should handle all escape cases together and roundtrip correctly', () => {
    const data = {
      xss: '</script><script>alert(1)</script>',
      name: "It's a test",
      comment: '<!-- hidden -->',
      path: '/api/endpoint',
    };
    const escaped = escapeJsonForScript(JSON.stringify(data));

    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).not.toContain('/');
    expect(escaped).not.toContain("'");

    expect(JSON.parse(escaped)).toEqual(data);
  });

  it('should be safe when embedded in a simulated single-quoted JS string eval', () => {
    const data = { name: "O'Connor", xss: "</script><script>alert('xss')</script>" };
    const escaped = escapeJsonForScript(JSON.stringify(data));

    // Simulate what the browser does: eval the single-quoted string, then JSON.parse
    // eslint-disable-next-line no-eval
    const result = eval(`JSON.parse('${escaped}')`);
    expect(result).toEqual(data);
  });

  it('should return unchanged output for JSON with no special characters', () => {
    const json = JSON.stringify({ key: 'simple value', count: 42 });
    const escaped = escapeJsonForScript(json);
    // Only / in the output would be from JSON itself (there are none here)
    expect(JSON.parse(escaped)).toEqual({ key: 'simple value', count: 42 });
  });

  it('should handle empty object', () => {
    const escaped = escapeJsonForScript(JSON.stringify({}));
    expect(JSON.parse(escaped)).toEqual({});
  });
});

describe('getParts', () => {
  it('should split a signed request into signature and envelope', () => {
    const [sig, envelope] = getParts('signature.envelope');
    expect(sig).toBe('signature');
    expect(envelope).toBe('envelope');
  });

  it('should only split on the first dot', () => {
    const [sig, envelope] = getParts('signature.envelope.extra.dots');
    expect(sig).toBe('signature');
    expect(envelope).toBe('envelope');
  });

  it('should throw for a string with no dot', () => {
    expect(() => getParts('nodot')).toThrow('Invalid signed request format');
  });

  it('should throw for an empty string', () => {
    expect(() => getParts('')).toThrow('Invalid signed request format');
  });
});

describe('verifySignature', () => {
  const secret = 'test-secret';

  function createHmacSignature(secret: string, data: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('base64');
  }

  it('should succeed for a valid HMACSHA256 signature', () => {
    const envelope = Buffer.from('test-data').toString('base64');
    const signature = createHmacSignature(secret, envelope);
    expect(() => verifySignature(secret, 'HMACSHA256', envelope, signature)).not.toThrow();
  });

  it('should throw for an unsupported algorithm', () => {
    expect(() => verifySignature(secret, 'SHA512', 'data', 'sig')).toThrow('Unsupported algorithm: SHA512');
  });

  it('should throw for an invalid signature', () => {
    const envelope = Buffer.from('test-data').toString('base64');
    const wrongSignature = createHmacSignature('wrong-secret', envelope);
    expect(() => verifySignature(secret, 'HMACSHA256', envelope, wrongSignature)).toThrow('Signature verification failed');
  });

  it('should handle URL-safe Base64 in signatures (- and _ instead of + and /)', () => {
    const envelope = Buffer.from('test-data').toString('base64');
    const standardSig = createHmacSignature(secret, envelope);
    // Convert to URL-safe Base64
    const urlSafeSig = standardSig.replace(/\+/g, '-').replace(/\//g, '_');
    expect(() => verifySignature(secret, 'HMACSHA256', envelope, urlSafeSig)).not.toThrow();
  });
});

describe('verifyAndDecodeAsJson', () => {
  const secret = 'test-secret';

  function createSignedRequest(payload: Record<string, unknown>, secret: string): string {
    const encodedEnvelope = Buffer.from(JSON.stringify(payload)).toString('base64');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(encodedEnvelope);
    const signature = hmac.digest('base64');
    return `${signature}.${encodedEnvelope}`;
  }

  it('should verify and decode a valid signed request', () => {
    const payload = { algorithm: 'HMACSHA256', context: { user: { name: 'Test User' } } };
    const signedRequest = createSignedRequest(payload, secret);
    const result = verifyAndDecodeAsJson(signedRequest, secret);
    expect(result).toEqual(payload);
  });

  it('should return the full envelope including nested data', () => {
    const payload = {
      algorithm: 'HMACSHA256',
      client: { instanceUrl: 'https://example.salesforce.com', oauthToken: 'token123' },
      context: { user: { userId: '005xxx', userName: 'admin@example.com' } },
    };
    const signedRequest = createSignedRequest(payload, secret);
    const result = verifyAndDecodeAsJson(signedRequest, secret);
    expect(result).toEqual(payload);
  });

  it('should throw for a tampered envelope', () => {
    const payload = { algorithm: 'HMACSHA256', context: { user: 'original' } };
    const signedRequest = createSignedRequest(payload, secret);

    // Tamper with the envelope
    const [sig] = signedRequest.split('.', 2);
    const tamperedPayload = { algorithm: 'HMACSHA256', context: { user: 'tampered' } };
    const tamperedEnvelope = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64');

    expect(() => verifyAndDecodeAsJson(`${sig}.${tamperedEnvelope}`, secret)).toThrow('Signature verification failed');
  });

  it('should throw for a wrong secret', () => {
    const payload = { algorithm: 'HMACSHA256', context: {} };
    const signedRequest = createSignedRequest(payload, secret);
    expect(() => verifyAndDecodeAsJson(signedRequest, 'wrong-secret')).toThrow('Signature verification failed');
  });

  it('should throw if algorithm is missing from envelope', () => {
    const payload = { context: {} };
    const signedRequest = createSignedRequest(payload as any, secret);
    expect(() => verifyAndDecodeAsJson(signedRequest, secret)).toThrow('Error deserializing JSON');
  });

  it('should throw for invalid base64 envelope', () => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update('not-base64');
    const sig = hmac.digest('base64');
    expect(() => verifyAndDecodeAsJson(`${sig}.not-base64`, secret)).toThrow('Error deserializing JSON');
  });

  it('should throw for invalid signed request format', () => {
    expect(() => verifyAndDecodeAsJson('no-dot-separator', secret)).toThrow('Invalid signed request format');
  });
});
