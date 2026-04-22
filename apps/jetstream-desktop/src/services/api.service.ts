import { NotificationMessageV1Response, NotificationMessageV1ResponseSchema } from '@jetstream/desktop/types';
import { HTTP } from '@jetstream/shared/constants';
import { Maybe, UserProfileUiSchema } from '@jetstream/types';
import { app, net } from 'electron';
import logger from 'electron-log';
import { z } from 'zod';
import { ENV } from '../config/environment';

const AuthResponseSuccessSchema = z.object({
  success: z.literal(true),
  userProfile: UserProfileUiSchema,
  encryptionKey: z.string().length(64),
  accessToken: z.string().optional(),
});
const AuthResponseErrorSchema = z.object({ success: z.literal(false), error: z.string() });
const SuccessOrErrorSchema = z.union([AuthResponseSuccessSchema, AuthResponseErrorSchema]);
const LogoutResponseSchema = z.union([z.object({ success: z.literal(true) }), AuthResponseErrorSchema]);

export type AuthResponseSuccess = z.infer<typeof AuthResponseSuccessSchema>;
export type AuthResponseError = z.infer<typeof AuthResponseErrorSchema>;

export async function verifyAuthToken({ accessToken, deviceId }: { deviceId: string; accessToken: string }) {
  let response: Response;
  try {
    response = await net.fetch(`${ENV.SERVER_URL}/desktop-app/auth/verify`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        [HTTP.HEADERS.X_APP_VERSION]: app.getVersion(),
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
  } catch (ex) {
    logger.error('verifyAuthToken network error', ex);
    return { success: false, networkError: true, error: 'Could not reach the server. Please check your connection and try again.' };
  }

  return parseAuthResponse(response, SuccessOrErrorSchema, 'verifyAuthToken');
}

/**
 * Shared JSON-response handler for desktop auth endpoints.
 * Differentiates between transport-level failures (non-2xx, non-JSON, malformed JSON,
 * schema mismatch) and deliberate `{success:false}` responses from the server so callers
 * — and our logs — see the real failure cause instead of a generic "Unauthorized".
 * This also surfaces cases where an upstream proxy (Cloudflare Access, etc.) returns
 * HTML for an API request.
 */
async function parseAuthResponse<T extends z.ZodTypeAny>(
  response: Response,
  schema: T,
  label: string,
): Promise<z.infer<T> | { success: false; error: string; networkError?: true }> {
  const status = response.status;
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    const bodyPreview = await response
      .text()
      .then((text) => text.slice(0, 500))
      .catch(() => '<unreadable body>');
    logger.error(`${label}: non-JSON response`, { status, contentType, url: response.url, bodyPreview });
    // Treat as transport-level failure so callers (e.g. handleCheckAuthEvent) can keep the
    // cached session instead of forcing a logout when an upstream proxy / auth wall returns HTML.
    return {
      success: false,
      networkError: true,
      error: `Unexpected non-JSON response from server (status ${status}). An upstream proxy or auth wall may be blocking the request.`,
    };
  }

  let payload: unknown;
  try {
    payload = (await response.json())?.data;
  } catch (ex) {
    logger.error(`${label}: JSON parse error`, { status, url: response.url, ex });
    // Server claimed JSON but body didn't parse — same situation as above, don't kick the user out.
    return { success: false, networkError: true, error: `Could not parse server response (status ${status}).` };
  }

  if (!response.ok) {
    logger.warn(`${label}: non-2xx response`, { status, url: response.url, payload });
  }

  const results = schema.safeParse(payload);
  if (!results.success) {
    logger.warn(`${label}: schema mismatch`, { status, payload, zodError: results.error });
    return {
      success: false,
      error:
        typeof (payload as { error?: unknown })?.error === 'string'
          ? ((payload as { error: string }).error as string)
          : `Unexpected response shape from server (status ${status}).`,
    };
  }

  return results.data;
}

export async function logout({ accessToken, deviceId }: { deviceId: string; accessToken: string }) {
  let response: Response;
  try {
    response = await net.fetch(`${ENV.SERVER_URL}/desktop-app/auth/logout`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        [HTTP.HEADERS.X_APP_VERSION]: app.getVersion(),
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
  } catch (ex) {
    logger.error('logout network error', ex);
    return { success: false, error: 'Could not reach the server.' };
  }

  return parseAuthResponse(response, LogoutResponseSchema, 'logout');
}

export async function checkNotifications({
  accessToken,
  deviceId,
}: {
  deviceId: string;
  accessToken: Maybe<string>;
}): Promise<NotificationMessageV1Response> {
  const version = app.getVersion();
  const os = process.platform;
  const isPackaged = app.isPackaged;

  const response = await fetch(`${ENV.SERVER_URL}/desktop-app/v1/notifications?version=${version}&os=${os}&isPackaged=${isPackaged}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      [HTTP.HEADERS.X_APP_VERSION]: app.getVersion(),
      [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
    },
  });

  const fallbackResponse: NotificationMessageV1Response = {
    success: false,
    severity: 'normal',
    action: null,
    actionUrl: null,
    title: null,
    message: null,
  };

  const results = NotificationMessageV1ResponseSchema.safeParse(
    await response
      .json()
      .then((value) => value?.data)
      .catch(() => fallbackResponse),
  );

  return results.data || fallbackResponse;
}
