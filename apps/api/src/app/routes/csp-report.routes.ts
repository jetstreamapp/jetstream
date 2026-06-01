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
      for (const report of reports) {
        const cspReport = report?.['csp-report'] || report?.body || report;
        if (!cspReport || typeof cspReport !== 'object') {
          continue;
        }
        logger.warn(
          {
            effectiveDirective: cspReport.effectiveDirective || cspReport['effective-directive'],
            blockedUri: cspReport.blockedURL || cspReport['blocked-uri'],
            documentUri: cspReport.documentURL || cspReport['document-uri'],
            violatedDirective: cspReport.violatedDirective || cspReport['violated-directive'],
            sourceFile: cspReport.sourceFile || cspReport['source-file'],
            lineNumber: cspReport.lineNumber || cspReport['line-number'],
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
