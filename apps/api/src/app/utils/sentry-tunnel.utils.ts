import { scrubSensitiveEventData } from '@jetstream/api-config';
import { gunzipSync } from 'zlib';

// Cap gzip decompression of unauthenticated request bodies to bound a gzip-bomb DoS (a small body can
// otherwise inflate to gigabytes and block/OOM the worker). Generous enough for legitimate large
// minidump envelopes; overflow throws RangeError, which callers treat as "couldn't read" (→ rejected).
const MAX_GUNZIP_OUTPUT_BYTES = 64 * 1024 * 1024;

export interface ParsedSentryDsn {
  dsn: string;
  publicKey: string;
  host: string;
  projectId: string;
  /** Where envelope payloads (events, and minidump attachments) are forwarded. */
  envelopeUrl: string;
}

/**
 * Parse a Sentry DSN (`https://<publicKey>@<host>[/<path>]/<projectId>`) into the ingest URL we
 * forward to. Returns null for anything malformed or non-https so a bad/hostile DSN can never become
 * a forward target. Supports an optional path prefix (self-hosted) but we only ship SaaS DSNs.
 */
export function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
  try {
    const url = new URL(dsn.trim());
    if (url.protocol !== 'https:') {
      return null;
    }
    const publicKey = url.username;
    const segments = url.pathname.split('/').filter(Boolean);
    const projectId = segments.pop();
    const pathPrefix = segments.length > 0 ? `/${segments.join('/')}` : '';
    if (!publicKey || !projectId || !url.host) {
      return null;
    }
    const base = `https://${url.host}${pathPrefix}/api/${projectId}`;
    return {
      dsn: dsn.trim(),
      publicKey,
      host: url.host,
      projectId,
      envelopeUrl: `${base}/envelope/`,
    };
  } catch {
    return null;
  }
}

/**
 * A Sentry envelope is newline-delimited: the first line is a JSON header that (when the SDK is
 * configured with `tunnel`) carries the `dsn` so we know where to route it. Read just that header.
 * Transparently gunzips so we can read the DSN even when the SDK compressed the body.
 */
export function extractDsnFromEnvelope(body: Buffer, contentEncoding?: string | null): string | null {
  try {
    const text =
      contentEncoding === 'gzip' ? gunzipSync(body, { maxOutputLength: MAX_GUNZIP_OUTPUT_BYTES }).toString('utf8') : body.toString('utf8');
    const firstLine = text.split('\n', 1)[0];
    const header = JSON.parse(firstLine) as { dsn?: unknown };
    return typeof header?.dsn === 'string' ? header.dsn : null;
  } catch {
    return null;
  }
}

/** Exact-match a DSN against the configured allowlist. Empty allowlist ⇒ nothing is allowed. */
export function isDsnAllowed(dsn: string, allowedDsns: string[]): boolean {
  if (allowedDsns.length === 0) {
    return false;
  }
  const normalized = dsn.trim();
  return allowedDsns.some((allowed) => allowed.trim() === normalized);
}

/**
 * Best-effort, fail-open server-side PII scrub of `event`/`transaction` items in an uncompressed
 * envelope. Returns the scrubbed UTF-8 buffer, or `null` to signal "forward the original bytes
 * unchanged" — we never risk dropping a crash by corrupting the envelope, so client-side scrubbing
 * (errorTracker `beforeSend`) is the primary control and this is defense-in-depth only.
 *
 * Conservative on purpose: bails (returns null) on gzip or on any length-prefixed item (whose binary
 * payload may legitimately contain newlines), since our line-based parse can't safely rewrite those.
 */
export function scrubEnvelope(body: Buffer, contentEncoding?: string | null): Buffer | null {
  if (contentEncoding === 'gzip') {
    return null;
  }
  try {
    const lines = body.toString('utf8').split('\n');
    const out: string[] = [lines[0]]; // envelope header (line 0) is forwarded verbatim
    let index = 1;
    while (index < lines.length) {
      const itemHeaderLine = lines[index];
      // A trailing empty segment is just the final newline — preserve and stop.
      if (itemHeaderLine === '' && index === lines.length - 1) {
        out.push(itemHeaderLine);
        break;
      }
      const itemHeader = JSON.parse(itemHeaderLine) as { type?: string; length?: number };
      // Length-prefixed payloads can contain newlines (binary/attachments) — too risky to rewrite.
      if (typeof itemHeader.length === 'number') {
        return null;
      }
      out.push(itemHeaderLine);
      const payloadLine = lines[index + 1] ?? '';
      if (itemHeader.type === 'event' || itemHeader.type === 'transaction') {
        try {
          const scrubbed = scrubSensitiveEventData(JSON.parse(payloadLine));
          out.push(JSON.stringify(scrubbed));
        } catch {
          out.push(payloadLine);
        }
      } else {
        out.push(payloadLine);
      }
      index += 2;
    }
    return Buffer.from(out.join('\n'), 'utf8');
  } catch {
    return null;
  }
}
