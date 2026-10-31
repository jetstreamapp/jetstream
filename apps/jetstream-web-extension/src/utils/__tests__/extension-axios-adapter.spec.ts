import { HTTP } from '@jetstream/shared/constants';
import { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { extensionRoutes } from '../../controllers/extension.routes';
import { initApiClient } from '../api-client';
import { browserExtensionAxiosAdapter } from '../extension-axios-adapter';
import { sendMessage } from '../web-extension.utils';

vi.mock('../../controllers/extension.routes', () => ({ extensionRoutes: { match: vi.fn() } }));
vi.mock('../api-client', () => ({ initApiClient: vi.fn() }));
vi.mock('../web-extension.utils', () => ({ sendMessage: vi.fn() }));

const CURRENT_ORG = { uniqueId: '00D000000000001-005000000000001' };
const OTHER_ORG_UNIQUE_ID = '00D000000000002-005000000000002';
const SESSION_INFO = { key: 'session-id', hostname: 'test.my.salesforce.com' };
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

describe('browserExtensionAxiosAdapter target org handling', () => {
  beforeAll(() => {
    // The adapter requires the Salesforce host from the page URL
    window.history.replaceState({}, '', `/app.html?host=${SESSION_INFO.hostname}`);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    routeHandler.mockResolvedValue(
      new Response(JSON.stringify({ data: { success: true } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.mocked(extensionRoutes.match).mockReturnValue({ handler: routeHandler, params: {} } as unknown as ReturnType<
      typeof extensionRoutes.match
    >);
    vi.mocked(initApiClient).mockReturnValue(API_CONNECTION as unknown as ReturnType<typeof initApiClient>);
    vi.mocked(sendMessage).mockResolvedValue({ org: CURRENT_ORG, sessionInfo: SESSION_INFO } as unknown as Awaited<
      ReturnType<typeof sendMessage>
    >);
  });

  test('passes the current connection as the target when the target header is the current org', async () => {
    const response = await browserExtensionAxiosAdapter(
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
      browserExtensionAxiosAdapter(
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
    await browserExtensionAxiosAdapter(getRequestConfig({ [HTTP.HEADERS.X_SFDC_ID]: CURRENT_ORG.uniqueId }));

    expect(routeHandler).toHaveBeenCalledTimes(1);
    const [handlerArgs] = routeHandler.mock.calls[0];
    expect(handlerArgs).toMatchObject({ jetstreamConn: API_CONNECTION, org: CURRENT_ORG });
    expect(handlerArgs).not.toHaveProperty('targetJetstreamConn');
    expect(handlerArgs).not.toHaveProperty('targetOrg');
  });
});
