import { HTTP } from '@jetstream/shared/constants';
import express from 'express';

function createBodyError(status: number, type: string, message: string) {
  return Object.assign(new Error(message), { status, type, expose: true });
}

/**
 * Reads a gzip-encoded CSV body into a Buffer WITHOUT decompressing it, so it can be forwarded to Salesforce
 * as-is (Bulk API decodes gzip request bodies itself).
 *
 * The global body parsers reject every Content-Encoding (inflate: false) to keep untrusted input away from the
 * zlib/brotli decoders, so this must be mounted before them - they skip any request whose body was already read.
 * An over-limit body is drained before responding (as body-parser does) so the client receives the 413.
 */
export function gzipBodyPassthrough({ limitBytes }: { limitBytes: number }) {
  return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (req.get(HTTP.HEADERS.CONTENT_ENCODING)?.toLowerCase() !== 'gzip' || !req.is('text/csv')) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let receivedBytes = 0;

    req.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes <= limitBytes) {
        chunks.push(chunk);
      }
    });
    req.on('error', next);
    req.on('end', () => {
      if (receivedBytes > limitBytes) {
        next(createBodyError(413, 'entity.too.large', 'request entity too large'));
        return;
      }
      const body = Buffer.concat(chunks);
      // gzip magic bytes - reject anything else here rather than forwarding garbage to Salesforce
      if (body[0] !== 0x1f || body[1] !== 0x8b) {
        next(createBodyError(400, 'encoding.invalid', 'request body is not valid gzip'));
        return;
      }
      req.body = body;
      next();
    });
  };
}
