import { timingSafeStringCompare } from '@jetstream/auth/server';
import { Canvas } from '@jetstream/types';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Escapes a JSON string for safe embedding inside a single-quoted JS string within an HTML <script> tag.
 * Prevents script breakout via </script> and <!-- sequences, and escapes single quotes
 * that would break the enclosing JS string literal.
 */
export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\u002f')
    .replace(/'/g, '\\u0027')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Splits the signed request into signature and envelope parts
 */
export function getParts(signedRequest: string): [string, string] {
  const parts = signedRequest.split('.', 2);
  if (parts.length !== 2) {
    throw new Error('Invalid signed request format. Expected format: signature.envelope');
  }
  return [parts[0], parts[1]];
}

/**
 * Verifies the signature using HMAC-SHA256
 */
export function verifySignature(secret: string, algorithm: string, encodedEnvelope: string, encodedSig: string): void {
  // Only support HMAC-SHA256
  if (algorithm !== 'HMACSHA256') {
    throw new Error(`Unsupported algorithm: ${algorithm}. Only HMACSHA256 is supported.`);
  }

  // Create HMAC signature of the encoded envelope
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(encodedEnvelope);
  const expectedSig = hmac.digest('base64');

  // Normalize both to standard Base64 for comparison, since Salesforce Canvas
  // may use URL-safe Base64 (- and _ instead of + and /) in the signed request
  const normalizeBase64 = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');
  if (!timingSafeStringCompare(normalizeBase64(expectedSig), normalizeBase64(encodedSig))) {
    throw new Error('Signature verification failed. The signed request was not signed with the correct consumer secret.');
  }
}

/**
 * Verifies and decodes a Salesforce Canvas signed request
 * Returns the decoded JSON context if verification succeeds
 */
export function verifyAndDecodeAsJson(signedRequest: string, secret: string): Canvas.SfdcCanvasSignedRequest {
  // Split into signature and envelope
  const [encodedSig, encodedEnvelope] = getParts(signedRequest);

  // Base64 decode the envelope to get JSON
  // Note: Canvas uses URL-safe Base64, so we need to handle that
  const jsonEnvelope = Buffer.from(encodedEnvelope, 'base64').toString('utf-8');

  // Parse the JSON to extract algorithm and context
  let envelope: Canvas.SfdcCanvasSignedRequest;
  let algorithm: string;

  try {
    envelope = JSON.parse(jsonEnvelope);
    algorithm = envelope.algorithm as string;

    if (!algorithm) {
      throw new Error('Algorithm not found in envelope');
    }
  } catch (error) {
    throw new Error(`Error deserializing JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Verify the signature
  verifySignature(secret, algorithm, encodedEnvelope, encodedSig);

  // If we got this far, the request was not tampered with
  return envelope;
}

export async function getCanvasIndexFile(): Promise<string> {
  const filePath = join(__dirname, '../jetstream-canvas/index.html');
  return await readFile(filePath, 'utf-8');
}
