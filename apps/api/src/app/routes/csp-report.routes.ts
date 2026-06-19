import { createRateLimit, ENV, logger } from '@jetstream/api-config';
import { json } from 'body-parser';
import * as express from 'express';

export const routes = express.Router();

// Lenient, dedicated limiter so report spam (browser extensions, third-party scripts) cannot
// flood logs or the request pipeline. Reports are best-effort telemetry.
const cspReportRateLimit = createRateLimit('csp_report', {
  windowMs: 1000 * 60 * 1, // 1 minute
  limit: ENV.CI || ENV.ENVIRONMENT === 'development' ? 10000 : 60,
});

// Report fields are attacker-controlled, so bound their length to keep a hostile reporter from
// inflating log events. URL fields are additionally reduced to origin + path since page URLs can
// carry sensitive query params (e.g. OAuth callback codes).
const MAX_REPORT_FIELD_LENGTH = 250;

// A single request body can batch an array of reports (up to the 100kb parser limit). Cap how many we
// log per request so a hostile/misbehaving client cannot amplify one request into many log lines.
const MAX_REPORTS_PER_REQUEST = 10;

function truncateField(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value.slice(0, MAX_REPORT_FIELD_LENGTH) : undefined;
}

function toOriginAndPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  try {
    const { origin, pathname } = new URL(value);
    return truncateField(`${origin}${pathname}`);
  } catch {
    return truncateField(value);
  }
}

// Accept CSP violation reports in both the legacy `report-uri` format (application/csp-report)
// and the modern Reporting API format (application/reports+json). A scoped 100kb parser keeps
// these off the global 20mb JSON body parser. Always responds 204 — reporting must never error.
routes.post(
  '/',
  cspReportRateLimit,
  json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '100kb' }),
  (req: express.Request, res: express.Response) => {
    try {
      const body = req.body;
      const reports = Array.isArray(body) ? body : [body];
      for (const report of reports.slice(0, MAX_REPORTS_PER_REQUEST)) {
        const cspReport = report?.['csp-report'] || report?.body || report;
        if (!cspReport || typeof cspReport !== 'object') {
          continue;
        }
        const lineNumber = cspReport.lineNumber ?? cspReport['line-number'];
        logger.warn(
          {
            effectiveDirective: truncateField(cspReport.effectiveDirective || cspReport['effective-directive']),
            blockedUri: truncateField(cspReport.blockedURL || cspReport['blocked-uri']),
            documentUri: toOriginAndPath(cspReport.documentURL || cspReport['document-uri']),
            violatedDirective: truncateField(cspReport.violatedDirective || cspReport['violated-directive']),
            sourceFile: toOriginAndPath(cspReport.sourceFile || cspReport['source-file']),
            lineNumber: typeof lineNumber === 'number' ? lineNumber : undefined,
          },
          '[CSP][VIOLATION]',
        );
      }
    } catch {
      // Never fail a report submission.
    }
    res.status(204).end();
  },
);

export default routes;
