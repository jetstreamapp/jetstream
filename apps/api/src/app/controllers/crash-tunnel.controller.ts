import { ENV, logger } from '@jetstream/api-config';
import type { Request, Response } from 'express';
import { extractDsnFromEnvelope, isDsnAllowed, parseSentryDsn, scrubEnvelope } from '../utils/sentry-tunnel.utils';

const FORWARD_TIMEOUT_MS = 5_000;

/** Forward a body to a Sentry ingest URL, swallowing/logging failures (client delivery is best-effort). */
async function forwardToSentry(url: string, body: Buffer, headers: Record<string, string>, label: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
  try {
    // undici's fetch accepts a Buffer body at runtime, but the lib's BodyInit type omits it.
    const upstream = await fetch(url, { method: 'POST', headers, body: body as unknown as BodyInit, signal: controller.signal });
    if (!upstream.ok) {
      logger.warn({ status: upstream.status }, `[CRASH TUNNEL] Upstream Sentry rejected ${label}`);
    }
  } catch (ex) {
    logger.warn({ err: ex }, `[CRASH TUNNEL] Failed forwarding ${label} to Sentry`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function crashTunnelHandler(req: Request, res: Response): Promise<void> {
  // Total kill switch — disabling error reporting also stops the tunnel forwarder.
  if (ENV.DISABLE_ERROR_REPORTING) {
    res.status(204).end();
    return;
  }
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).end();
    return;
  }
  const contentEncoding = req.get('content-encoding');
  const dsn = extractDsnFromEnvelope(body, contentEncoding);
  if (!dsn || !isDsnAllowed(dsn, ENV.SENTRY_TUNNEL_ALLOWED_DSNS)) {
    logger.warn({ hasDsn: !!dsn }, '[CRASH TUNNEL] Rejected envelope with disallowed/missing DSN');
    res.status(403).end();
    return;
  }
  const parsed = parseSentryDsn(dsn);
  if (!parsed) {
    res.status(403).end();
    return;
  }

  // Best-effort scrub; `null` means "forward original bytes unchanged" so we never drop a crash.
  const scrubbedBody = scrubEnvelope(body, contentEncoding);
  const forwardBody = scrubbedBody ?? body;
  const headers: Record<string, string> = {
    'content-type': req.get('content-type') || 'application/x-sentry-envelope',
  };
  // Only pass through the original encoding when we forward the original (compressed) bytes.
  if (contentEncoding && !scrubbedBody) {
    headers['content-encoding'] = contentEncoding;
  }

  await forwardToSentry(parsed.envelopeUrl, forwardBody, headers, 'envelope');
  // Always 200 — the client shouldn't retry on our forwarding errors.
  res.status(200).end();
}
