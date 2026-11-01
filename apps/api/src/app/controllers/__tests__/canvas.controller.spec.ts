/**
 * The Canvas credentials are read from the environment at module load, so each test resets the module registry and
 * imports a fresh controller after arranging `process.env`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyAndDecodeAsJson: vi.fn(),
  isCanvasOrgEntitled: vi.fn(),
  getCanvasIndexFile: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { SFDC_API_VERSION: '68.0' },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  prisma: {},
}));
vi.mock('@jetstream/auth/server', () => ({ getApiAddressFromReq: () => '127.0.0.1' }));
vi.mock('@jetstream/prisma', () => ({
  isPrismaError: () => false,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  toTypedPrismaError: () => ({ code: undefined }),
}));
vi.mock('@jetstream/salesforce-oauth', () => ({ salesforceCanvasOauthCallback: vi.fn(), SalesforceCanvasOauthInit: vi.fn() }));
vi.mock('../../db/salesforce-org.db', () => ({ findByUniqueId_UNSAFE: vi.fn() }));
vi.mock('../../db/canvas-entitlement.db', () => ({ isCanvasOrgEntitled: mocks.isCanvasOrgEntitled }));
vi.mock('../../utils/canvas.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/canvas.utils')>()),
  verifyAndDecodeAsJson: mocks.verifyAndDecodeAsJson,
  getCanvasIndexFile: mocks.getCanvasIndexFile,
  getCanvasAccessDeniedHtml: () => '<html>denied</html>',
}));

const CANVAS_ENV_VARS = ['SFDC_CANVAS_CALLBACK_URL', 'SFDC_CANVAS_CLIENT_ID', 'SFDC_CANVAS_CLIENT_SECRET'] as const;

async function postSignedRequest(signedRequest: string) {
  const { routeDefinition } = await import('../canvas.controller');
  const req = {
    get: () => undefined,
    body: { signed_request: signedRequest },
    query: {},
    params: {},
    session: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
  const res = {
    locals: {},
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  await routeDefinition.appHandler.controllerFn()(req as never, res as never, vi.fn());
  return res;
}

describe('canvas.controller appHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    CANVAS_ENV_VARS.forEach((name) => delete process.env[name]);
    mocks.isCanvasOrgEntitled.mockResolvedValue(true);
    mocks.getCanvasIndexFile.mockResolvedValue('<%=canvasImportScriptUrl%>|<%=signedRequestJson%>');
    mocks.verifyAndDecodeAsJson.mockReturnValue({
      context: { organization: { organizationId: '00D000000000001' } },
      client: { instanceUrl: 'https://example.my.salesforce.com' },
    });
  });

  it('refuses a signed request when the Canvas credentials are not configured, without attempting verification', async () => {
    process.env.SFDC_CANVAS_CALLBACK_URL = 'https://server.test/canvas/callback';
    process.env.SFDC_CANVAS_CLIENT_ID = 'client-id';

    const res = await postSignedRequest('signed.request');

    expect(mocks.verifyAndDecodeAsJson).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('not properly configured') }));
  });

  it('verifies a signed request with the configured client secret', async () => {
    process.env.SFDC_CANVAS_CALLBACK_URL = 'https://server.test/canvas/callback';
    process.env.SFDC_CANVAS_CLIENT_ID = 'client-id';
    process.env.SFDC_CANVAS_CLIENT_SECRET = 'client-secret';

    const res = await postSignedRequest('signed.request');

    expect(mocks.verifyAndDecodeAsJson).toHaveBeenCalledWith('signed.request', 'client-secret');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('https://example.my.salesforce.com/canvas/sdk/js/68.0/canvas-all.js'));
  });
});
