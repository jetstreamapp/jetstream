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

/**
 * Branded screen rendered (inside the Salesforce Canvas iframe) when the org is not entitled
 * to the Canvas app. Returned as static HTML so it has no build/asset dependencies.
 */
export function getCanvasAccessDeniedHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Jetstream</title>
    <style>
      html, body { height: 100%; margin: 0; }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f3f3;
        color: #16325c;
        font-family: 'Salesforce Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .card {
        max-width: 30rem;
        margin: 2rem;
        padding: 2rem;
        background: #fff;
        border: 1px solid #dddbda;
        border-radius: 0.25rem;
        box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.1);
        text-align: center;
      }
      .card h1 { font-size: 1.25rem; margin: 0 0 1rem; }
      .card p { font-size: 0.875rem; line-height: 1.5; margin: 0 0 1rem; color: #3e3e3c; }
      .btn {
        display: inline-block;
        margin-top: 0.5rem;
        padding: 0.5rem 1.25rem;
        background: #0176d3;
        color: #fff;
        text-decoration: none;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }
      .btn:hover { background: #014486; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>This org isn't authorized for Canvas</h1>
      <p>
        The Jetstream Canvas app requires an active Jetstream subscription with Canvas access, and this Salesforce org
        must be authorized for Canvas in Jetstream.
      </p>
      <p>
        An admin on your team can authorize this org from Jetstream settings. If your team doesn't have Canvas yet,
        start a plan to get going.
      </p>
      <a class="btn" href="https://getjetstream.app" target="_blank" rel="noopener">Open Jetstream</a>
    </main>
  </body>
</html>`;
}
