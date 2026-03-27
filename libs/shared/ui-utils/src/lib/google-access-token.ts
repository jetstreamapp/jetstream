/**
 * Simple module-level store for the Google access token obtained via an external picker/auth flow.
 * Used by Jobs.tsx to upload files to Google Drive on desktop and browser extension (where gapi is not available).
 *
 * The token is set whenever a picker or auth-only result comes back from the external flow
 * (Electron IPC for desktop, postMessage for browser extension).
 * The expiration is checked with a 10-minute buffer so uploads have time to complete.
 */

import { GoogleUserInfo, Maybe } from '@jetstream/types';

const EXPIRY_BUFFER_MS = 10 * 60 * 1000; // 10 minutes

let externalGoogleAccessToken: Maybe<string> = null;
let externalGoogleAccessTokenExpiresAt: Maybe<number> = null;
let externalGoogleAccessUserInfo: Maybe<GoogleUserInfo> = null;

// Listener registry for immediate cross-instance notification on token changes
type TokenChangeListener = () => void;
const tokenChangeListeners = new Set<TokenChangeListener>();

export function subscribeToTokenChanges(listener: TokenChangeListener): () => void {
  tokenChangeListeners.add(listener);
  return () => {
    tokenChangeListeners.delete(listener);
  };
}

function notifyTokenChangeListeners() {
  tokenChangeListeners.forEach((listener) => listener());
}

export function setExternalGoogleAccessToken(
  token: Maybe<string>,
  expiresAt: Maybe<number>,
  userInfoResponse?: Maybe<GoogleUserInfo>,
): void {
  externalGoogleAccessToken = token;
  externalGoogleAccessTokenExpiresAt = expiresAt ?? null;
  externalGoogleAccessUserInfo = userInfoResponse;
  notifyTokenChangeListeners();
}

/**
 * Returns the stored Google access token, or null if no token or if the token has expired.
 * Expiration is checked with a 10-minute buffer to give uploads time to complete.
 *
 * This is a pure reader — it does not mutate state. Expired tokens are cleaned up
 * via clearExpiredToken(), which also notifies subscribers.
 */
export function getExternalGoogleAccessToken(): Maybe<{ accessToken: string; userInfo: Maybe<GoogleUserInfo>; expiresAt: Maybe<number> }> {
  if (!externalGoogleAccessToken) {
    return null;
  }
  if (externalGoogleAccessTokenExpiresAt && Date.now() >= externalGoogleAccessTokenExpiresAt - EXPIRY_BUFFER_MS) {
    return null;
  }
  return { accessToken: externalGoogleAccessToken, userInfo: externalGoogleAccessUserInfo, expiresAt: externalGoogleAccessTokenExpiresAt };
}

/**
 * Clears the token if it has expired (with 10-minute buffer) and notifies subscribers.
 * Call this from polling intervals to ensure UI updates when a token expires.
 */
export function clearExpiredToken(): void {
  if (
    externalGoogleAccessToken &&
    externalGoogleAccessTokenExpiresAt &&
    Date.now() >= externalGoogleAccessTokenExpiresAt - EXPIRY_BUFFER_MS
  ) {
    externalGoogleAccessToken = null;
    externalGoogleAccessTokenExpiresAt = null;
    externalGoogleAccessUserInfo = null;
    notifyTokenChangeListeners();
  }
}

/**
 * Returns true if a token exists and has not expired (with 10-minute buffer).
 */
export function isExternalGoogleAccessTokenValid(): boolean {
  return getExternalGoogleAccessToken() !== null;
}
