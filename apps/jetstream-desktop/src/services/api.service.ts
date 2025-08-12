import { NotificationMessageV1Response, NotificationMessageV1ResponseSchema } from '@jetstream/desktop/types';
import { HTTP } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { app, net } from 'electron';
import logger from 'electron-log';
import { z } from 'zod';
import { ENV } from '../config/environment';

const SuccessOrErrorSchema = z.union([z.object({ success: z.literal(true) }), z.object({ success: z.literal(false), error: z.string() })]);

export async function verifyAuthToken(payload: { deviceId: string; accessToken: string }) {
  const response = await net.fetch(`${ENV.SERVER_URL}/desktop-app/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const results = SuccessOrErrorSchema.safeParse(
    await response
      .json()
      .then((value) => value?.data)
      .catch(() => ({ success: false, error: 'Unauthorized' }))
  );

  if (!results.success) {
    logger.warn('verifyAuthToken parse error', results.error);
    return { success: false, error: 'Unauthorized' };
  }

  return results.data;
}

export async function logout(payload: { deviceId: string; accessToken: string }) {
  const response = await net.fetch(`${ENV.SERVER_URL}/desktop-app/logout`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const results = SuccessOrErrorSchema.safeParse(
    await response
      .json()
      .then((value) => value?.data)
      .catch(() => ({ success: false, error: 'Invalid response' }))
  );

  if (!results.success) {
    logger.warn('logout parse error', results.error);
    return { success: false, error: 'Invalid response' };
  }

  return results.data;
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
      .catch(() => fallbackResponse)
  );

  return results.data || fallbackResponse;
}
