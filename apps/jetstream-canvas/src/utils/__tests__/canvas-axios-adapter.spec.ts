import { HTTP } from '@jetstream/shared/constants';
import { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { extensionRoutes } from '../../controllers/canvas.routes';
import { initApiClient } from '../api-client';
import { canvasAppAxiosAdapter } from '../canvas-axios-adapter';
import { getCanvasOrg } from '../canvas.utils';

vi.mock('../../controllers/canvas.routes', () => ({ extensionRoutes: { match: vi.fn() } }));
vi.mock('../api-client', () => ({ initApiClient: vi.fn() }));
vi.mock('../canvas.utils', () => ({ getCanvasOrg: vi.fn() }));

const CURRENT_ORG = { uniqueId: '00D000000000001-005000000000001' };
const OTHER_ORG_UNIQUE_ID = '00D000000000002-005000000000002';
const API_CONNECTION = { sessionInfo: 'current-org-connection' };
const TARGET_ORG_NOT_SUPPORTED_MESSAGE = 'Deploying to a different org is not supported here.';

const routeHandler = vi.fn();

function getRequestConfig(headers: Record<string, string>): InternalAxiosRequestConfig {
  return {
    url: '/api/metadata/retrieve/check-and-redeploy',
    method: 'post',
    headers: new AxiosHeaders(headers),
  } as InternalAxiosRequestConfig;
}

describe('canvasAppAxiosAdapter target org handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeHandler.mockResolvedValue(
      new Response(JSON.stringify({ data: { success: true } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.mocked(extensionRoutes.match).mockReturnValue({ handler: routeHandler, params: {} } as unknown as ReturnType<
      typeof extensionRoutes.match
    >);
    vi.mocked(initApiClient).mockReturnValue(API_CONNECTION as unknown as ReturnType<typeof initApiClient>);
    vi.mocked(getCanvasOrg).mockReturnValue(CURRENT_ORG as ReturnType<typeof getCanvasOrg>);
  });

  test('passes the current connection as the target when the target header is the current org', async () => {
    const response = await canvasAppAxiosAdapter(
      getRequestConfig({
        [HTTP.HEADERS.X_SFDC_ID]: CURRENT_ORG.uniqueId,
        [HTTP.HEADERS.X_SFDC_ID_TARGET]: CURRENT_ORG.uniqueId,
      }),
    );

    expect(response.data).toEqual({ data: { success: true } });
    expect(routeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        jetstreamConn: API_CONNECTION,
        org: CURRENT_ORG,
        targetJetstreamConn: API_CONNECTION,
        targetOrg: CURRENT_ORG,
      }),
    );
  });

  test('rejects when the target header is a different org', async () => {
    await expect(
      canvasAppAxiosAdapter(
        getRequestConfig({
          [HTTP.HEADERS.X_SFDC_ID]: CURRENT_ORG.uniqueId,
          [HTTP.HEADERS.X_SFDC_ID_TARGET]: OTHER_ORG_UNIQUE_ID,
        }),
      ),
    ).rejects.toMatchObject({
      message: TARGET_ORG_NOT_SUPPORTED_MESSAGE,
      response: { status: 400, data: { error: true, message: TARGET_ORG_NOT_SUPPORTED_MESSAGE } },
    });
    expect(routeHandler).not.toHaveBeenCalled();
  });

  test('does not pass a target when the target header is absent', async () => {
    await canvasAppAxiosAdapter(getRequestConfig({ [HTTP.HEADERS.X_SFDC_ID]: CURRENT_ORG.uniqueId }));

    expect(routeHandler).toHaveBeenCalledTimes(1);
    const [handlerArgs] = routeHandler.mock.calls[0];
    expect(handlerArgs).toMatchObject({ jetstreamConn: API_CONNECTION, org: CURRENT_ORG });
    expect(handlerArgs).not.toHaveProperty('targetJetstreamConn');
    expect(handlerArgs).not.toHaveProperty('targetOrg');
  });
});
