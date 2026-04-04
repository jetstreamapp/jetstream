import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute, type RouteValidator } from '../utils/route.utils';

export const routeDefinition = {
  /**
   * Test endpoint for verifying deferred response (Cloudflare timeout prevention) behavior.
   * Uses the same deferredResponseMiddleware, sendJson, and error handler code paths as real SF controllers.
   *
   * Query params:
   *   delay         - Response delay in ms (default: 5000, max: 300000).
   *                   Use >45000 to trigger deferred mode (space-padding keepalive).
   *   status        - "success" (default) or "error". Error uses UserFacingError through next().
   *   errorMessage  - Custom error message when status=error (default: "Simulated error").
   *   responseSize  - "small" (default), "medium" (~100KB), or "large" (~1MB).
   *                   Useful for testing chunked encoding with varying payload sizes.
   *
   * Examples:
   *   Fast success:       GET /api/test/deferred-response?delay=1000
   *   Deferred success:   GET /api/test/deferred-response?delay=60000
   *   Deferred error:     GET /api/test/deferred-response?delay=60000&status=error&errorMessage=Token+expired
   *   Large payload:      GET /api/test/deferred-response?delay=60000&responseSize=large
   */
  deferredResponse: {
    controllerFn: () => deferredResponse,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        delay: z.coerce.number().min(0).max(300_000).default(5_000),
        status: z.enum(['success', 'error']).default('success'),
        errorMessage: z.string().default('Simulated error'),
        responseSize: z.enum(['small', 'medium', 'large']).default('small'),
      }),
    } satisfies RouteValidator,
  },
};

const deferredResponse = createRoute(routeDefinition.deferredResponse.validators, async ({ query }, _req, res, next) => {
  const { delay, status, errorMessage, responseSize } = query;

  res.log.info({ delay, status, errorMessage, responseSize }, '[TEST][DEFERRED] Test endpoint invoked');

  await new Promise((resolve) => setTimeout(resolve, delay));

  if (status === 'error') {
    return next(new UserFacingError(errorMessage));
  }

  const payload: Record<string, unknown> = { message: 'Test response', delay, responseSize };
  if (responseSize === 'medium') {
    payload.padding = 'x'.repeat(100_000);
  } else if (responseSize === 'large') {
    payload.padding = 'x'.repeat(1_000_000);
  }

  sendJson(res, payload);
});
