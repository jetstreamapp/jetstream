import { net } from 'electron';
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
