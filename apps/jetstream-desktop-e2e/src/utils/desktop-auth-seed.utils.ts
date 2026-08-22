import { AppData, AppDataSchema } from '@jetstream/desktop/types';
import { HTTP } from '@jetstream/shared/constants';
import { APIRequestContext, APIResponse } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface SeededAuthSession {
  deviceId: string;
  accessToken: string;
  userProfile: unknown;
  /** Jetstream user id — selects the per-user org file name in `desktop-org-seed.utils.ts`. */
  userId: string;
  /** Hex-encoded AES-256-GCM key for the per-user org file. */
  encryptionKey: string;
}

/**
 * These endpoints answer an unauthorized caller with a 302 to the login page rather than a JSON
 * error (e.g. `?error=MissingEntitlement` when the account lacks the `desktop` entitlement that
 * `global.setup.ts` grants). Requests are sent with `maxRedirects: 0` so that surfaces here, with
 * the redirect target named — following it would instead return the login page's HTML and fail
 * later as an opaque "Unexpected token '<'" JSON parse error.
 */
async function describeFailure(action: string, response: APIResponse): Promise<string> {
  const location = response.headers()['location'];
  const redirectedTo = location ? ` — redirected to ${location}` : '';
  return `Failed to ${action}: ${response.status()} ${response.statusText()}${redirectedTo}\n${await response.text()}`;
}

/**
 * Obtains a real, valid desktop session via the same HTTP endpoints the desktop app itself uses
 * (`/desktop-app/auth/session` + `/desktop-app/auth/verify`), without driving any browser/OS login
 * UI. `request` must carry the storageState-backed cookie session from `global.setup.ts` — these
 * endpoints require `req.session.user` to already be authenticated.
 *
 * A fresh deviceId is minted on every call rather than reused across tests: the real app always
 * sends `X-Supports-Token-Rotation: 1` on its own boot-time `checkAuth()`, which rotates the
 * desktop JWT server-side on every verify. Sharing one deviceId/token across parallel test workers
 * would let one worker's boot invalidate the token another worker just seeded.
 */
export async function seedDesktopAuthSession(request: APIRequestContext, baseURL: string): Promise<SeededAuthSession> {
  const deviceId = randomUUID();

  const sessionResponse = await request.post(`${baseURL}/desktop-app/auth/session`, {
    headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId },
    maxRedirects: 0,
  });
  if (!sessionResponse.ok()) {
    throw new Error(await describeFailure('create desktop auth session', sessionResponse));
  }
  const { accessToken } = await sessionResponse.json().then(({ data }) => data);

  // Deliberately omit X-Supports-Token-Rotation here — that header is what makes the app's own
  // boot-time verify call rotate the token; this seeding call should hand back an unrotated token
  // for the real app to verify (and rotate) itself on first launch.
  const verifyResponse = await request.post(`${baseURL}/desktop-app/auth/verify`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
    },
    maxRedirects: 0,
  });
  if (!verifyResponse.ok()) {
    throw new Error(await describeFailure('verify desktop auth session', verifyResponse));
  }
  const { userProfile, encryptionKey } = await verifyResponse.json().then(({ data }) => data);

  const userId = (userProfile as { id?: unknown } | null)?.id;
  if (typeof userId !== 'string') {
    throw new Error(`Expected a userProfile.id from /desktop-app/auth/verify, got: ${JSON.stringify(userProfile)}`);
  }

  return { deviceId, accessToken, userProfile, userId, encryptionKey };
}

/**
 * Writes `app-data.json` into an isolated `--user-data-dir` in the plain-JSON format
 * `persistence.service.ts`'s `getAppData()` reads directly (no encryption — that's only used for
 * the per-user Salesforce org files). Must happen BEFORE `_electron.launch()`: the renderer's
 * `checkAuth()` fires in an unguarded `useEffect` on first render, with no seam to inject state
 * after the process starts but before that runs.
 *
 * `handleCheckAuthEvent` only attempts verification when BOTH `accessToken` and `userProfile` are
 * present in app-data.json — seeding only the token is not enough to reach an authenticated boot.
 * `lastChecked` is left unset so the app's own boot-time check always runs (one of
 * `handleCheckAuthEvent`'s OR-conditions is `!lastChecked`).
 *
 * Written with default permissions on purpose: the app tightening this file to 0600 on its next
 * write is exactly what `tests/security/token-at-rest.spec.ts` asserts, so pre-tightening it here
 * would make that assertion pass vacuously.
 */
export async function seedAppData(userDataDir: string, session: SeededAuthSession): Promise<void> {
  const appData: AppData = AppDataSchema.parse({
    deviceId: session.deviceId,
    accessToken: session.accessToken,
    userProfile: session.userProfile,
  });
  await fs.writeFile(path.join(userDataDir, 'app-data.json'), JSON.stringify(appData));
}
