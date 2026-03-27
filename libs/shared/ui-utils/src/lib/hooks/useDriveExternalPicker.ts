import { GooglePickerResult, GooglePickerResultSuccess } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { googleGetUserinfo } from '@jetstream/shared/data';
import { GoogleUserInfo, Maybe } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearExpiredToken,
  getExternalGoogleAccessToken,
  isExternalGoogleAccessTokenValid,
  setExternalGoogleAccessToken,
  subscribeToTokenChanges,
} from '../google-access-token';
import { isBrowserExtension } from '../shared-browser-extension-helpers';

export interface UseDriveExternalPickerReturn {
  openPicker: (mode?: 'file' | 'folder' | 'auth') => void;
  signOut: () => void;
  result: Maybe<GooglePickerResultSuccess>;
  isAuthorized: boolean;
  userInfo: Maybe<GoogleUserInfo>;
  loading: boolean;
  error: string | null;
}

// Loading timeout: if no result comes back within this time, stop showing loading state
const LOADING_TIMEOUT_MS = 15_000;

// ─── Module-level listener registry ───
// A single IPC/message listener is set up per channel. Results are dispatched
// to the correct hook instance via nonce lookup, avoiding duplicate listeners
// when multiple components use this hook simultaneously.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PickerResultCallback = (result: any) => void;
const pendingNonces = new Map<string, PickerResultCallback>();

let ipcListenerCleanup: (() => void) | null = null;
let messageListenerRef: ((event: MessageEvent) => void) | null = null;
let expectedMessageOrigin: string | null = null;

function ensureDesktopListener() {
  if (ipcListenerCleanup || !window.electronAPI) {
    return;
  }
  ipcListenerCleanup = window.electronAPI.onGooglePickerResult((pickerResult) => {
    if (!pickerResult.nonce) {
      return;
    }
    const callback = pendingNonces.get(pickerResult.nonce);
    if (callback) {
      pendingNonces.delete(pickerResult.nonce);
      callback(pickerResult);
    }
  });
}

function handleExtensionMessage(event: MessageEvent) {
  if (expectedMessageOrigin && event.origin !== expectedMessageOrigin) {
    return;
  }
  if (event.data?.type !== 'GOOGLE_PICKER_RESULT') {
    return;
  }
  const nonce = event.data.nonce as string | undefined;
  if (!nonce) {
    return;
  }
  const callback = pendingNonces.get(nonce);
  if (!callback) {
    return;
  }
  pendingNonces.delete(nonce);
  // Pass the full event so the callback can validate origin
  callback({ ...event.data, _origin: event.origin });
}

function ensureExtensionListener(serverUrl?: string) {
  // Update the expected origin if a serverUrl is provided (defense-in-depth for postMessage)
  if (serverUrl) {
    try {
      expectedMessageOrigin = new URL(serverUrl).origin;
    } catch {
      // If the URL is invalid, leave expectedMessageOrigin as-is
    }
  }

  if (messageListenerRef) {
    return;
  }

  messageListenerRef = handleExtensionMessage;
  window.addEventListener('message', messageListenerRef);
}

function registerNonce(nonce: string, callback: PickerResultCallback) {
  pendingNonces.set(nonce, callback);
}

function unregisterNonce(nonce: string) {
  pendingNonces.delete(nonce);
}

/**
 * Hook that bridges an external Google Drive picker flow into React state.
 *
 * On desktop: opens the Google Picker via Electron IPC (which launches the user's browser to a landing page),
 * then listens for the result callback via IPC.
 *
 * On browser extension: opens a popup window to a landing page, then listens for the result via postMessage.
 *
 * The Google access token from any successful result is stored globally via setExternalGoogleAccessToken
 * so that background jobs (e.g., Google Drive uploads in Jobs.tsx) can use it.
 *
 * @param serverUrl - Required for browser extension to build the picker page URL. Not needed for desktop.
 */
export function useDriveExternalPicker(serverUrl?: string): UseDriveExternalPickerReturn {
  const [result, setResult] = useState<Maybe<GooglePickerResultSuccess>>(null);
  const [userInfo, setUserInfo] = useState<Maybe<GoogleUserInfo>>(() => getExternalGoogleAccessToken()?.userInfo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(() => isExternalGoogleAccessTokenValid());
  const nonceRef = useRef<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const popupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isExtension] = useState(() => isBrowserExtension());

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  /** Shared handler for picker results from either IPC or postMessage */
  const handlePickerResult = useCallback(
    (pickerResult: GooglePickerResult) => {
      const setStateIfMounted = (update: () => void) => {
        if (isMounted.current) {
          update();
        }
      };

      clearLoadingTimeout();

      if (pickerResult.status === 'success') {
        // Store the token (and expiration) globally for use by background jobs (e.g., Google Drive uploads)
        googleGetUserinfo(pickerResult.googleAccessToken)
          .then((userInfoResponse) => {
            setExternalGoogleAccessToken(pickerResult.googleAccessToken, pickerResult.googleAccessTokenExpiresAt, userInfoResponse);
            setStateIfMounted(() => {
              setUserInfo(userInfoResponse);
            });
          })
          .catch((ex) => {
            logger.error('[GOOGLE] Error fetching user info', ex);
            setExternalGoogleAccessToken(pickerResult.googleAccessToken, pickerResult.googleAccessTokenExpiresAt);
            setStateIfMounted(() => {
              setUserInfo(null);
            });
          })
          .finally(() => {
            setStateIfMounted(() => {
              setResult(pickerResult);
              setIsAuthorized(true);
              setError(null);
              setLoading(false);
            });
          });
      } else if (pickerResult.status === 'cancelled') {
        setStateIfMounted(() => {
          setLoading(false);
        });
        if (!isExternalGoogleAccessTokenValid()) {
          setStateIfMounted(() => {
            setIsAuthorized(false);
          });
        }
      } else if (pickerResult.status === 'error') {
        setStateIfMounted(() => {
          setError(pickerResult.error);
          setLoading(false);
        });
        if (!isExternalGoogleAccessTokenValid()) {
          setExternalGoogleAccessToken(null, null, null);
          setStateIfMounted(() => {
            setIsAuthorized(false);
          });
        }
      }
    },
    [clearLoadingTimeout],
  );

  // Sync state immediately when the global token changes (e.g. another hook instance refreshed it)
  // and periodically re-check so UI flips back to "Authorize" when the token expires.
  useEffect(() => {
    const syncFromGlobalToken = () => {
      const tokenData = getExternalGoogleAccessToken();
      if (tokenData) {
        setIsAuthorized(true);
        if (tokenData.userInfo) {
          setUserInfo(tokenData.userInfo);
        }
      } else {
        setIsAuthorized(false);
        setResult(null);
        setUserInfo(null);
        setError(null);
        setLoading(false);
      }
    };

    const unsubscribe = subscribeToTokenChanges(syncFromGlobalToken);

    // Poll for expiration — clearExpiredToken will notify subscribers (triggering syncFromGlobalToken)
    // if the token has expired, so we don't need to call syncFromGlobalToken here directly.
    const interval = setInterval(() => {
      clearExpiredToken();
    }, 30_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Desktop: ensure the single module-level IPC listener is set up
  useEffect(() => {
    if (isExtension) {
      return;
    }
    isMounted.current = true;
    ensureDesktopListener();

    return () => {
      isMounted.current = false;
      clearLoadingTimeout();
      // Unregister this instance's nonce if it's still pending
      if (nonceRef.current) {
        unregisterNonce(nonceRef.current);
        nonceRef.current = null;
      }
    };
  }, [isExtension, clearLoadingTimeout]);

  // Browser extension: ensure the single module-level message listener is set up
  useEffect(() => {
    if (!isExtension) {
      return;
    }
    isMounted.current = true;
    ensureExtensionListener(serverUrl);

    return () => {
      isMounted.current = false;
      clearLoadingTimeout();
      if (nonceRef.current) {
        unregisterNonce(nonceRef.current);
        nonceRef.current = null;
      }
      if (popupPollRef.current) {
        clearInterval(popupPollRef.current);
        popupPollRef.current = null;
      }
    };
  }, [isExtension, serverUrl, clearLoadingTimeout]);

  const openPicker = useCallback(
    (mode: 'file' | 'folder' | 'auth' = 'file') => {
      // Desktop: delegate to Electron IPC
      if (!isExtension) {
        if (!window.electronAPI) {
          setError('Google Drive picker is not available in this environment');
          return;
        }

        const { accessToken, expiresAt } = getExternalGoogleAccessToken() || {};

        if (!accessToken) {
          setResult(null);
          setUserInfo(null);
        }

        setError(null);
        setLoading(true);

        clearLoadingTimeout();
        loadingTimeoutRef.current = setTimeout(() => {
          if (isMounted.current) {
            setLoading(false);
          }
          if (nonceRef.current) {
            unregisterNonce(nonceRef.current);
            nonceRef.current = null;
          }
        }, LOADING_TIMEOUT_MS);

        const nonce = crypto.randomUUID();
        nonceRef.current = nonce;
        registerNonce(nonce, (pickerResult) => {
          if (isMounted.current) {
            nonceRef.current = null;
            handlePickerResult(pickerResult);
          }
        });

        window.electronAPI.openGooglePicker({ mode, accessToken, accessTokenExpiresAt: expiresAt, nonce }).catch((ex) => {
          logger.error('Error opening Google picker', ex);
          clearLoadingTimeout();
          if (isMounted.current) {
            setError('Failed to open Google Drive picker');
            setLoading(false);
          }
        });
        return;
      }

      // Browser extension: open popup window to landing page
      if (!serverUrl) {
        setError('Server URL is not configured');
        return;
      }

      setError(null);
      setLoading(true);

      clearLoadingTimeout();
      loadingTimeoutRef.current = setTimeout(() => {
        if (isMounted.current) {
          setLoading(false);
        }
        if (nonceRef.current) {
          unregisterNonce(nonceRef.current);
          nonceRef.current = null;
        }
      }, LOADING_TIMEOUT_MS);

      const { accessToken, expiresAt } = getExternalGoogleAccessToken() || {};

      if (!accessToken) {
        setResult(null);
        setUserInfo(null);
      }

      const nonce = crypto.randomUUID();
      nonceRef.current = nonce;
      registerNonce(nonce, (eventData) => {
        if (!isMounted.current) {
          return;
        }

        // Validate origin matches expected server
        if (serverUrl && eventData._origin !== new URL(serverUrl).origin) {
          logger.warn('[GOOGLE] Received postMessage from unexpected origin', eventData._origin);
          return;
        }

        nonceRef.current = null;

        // Parse the raw postMessage data into a GooglePickerResult
        const {
          status,
          mode: resultMode,
          googleAccessToken: token,
          googleAccessTokenExpiresAt: tokenExpiry,
          fileId,
          fileName,
          mimeType,
          folderId,
          folderName,
          errorMessage,
        } = eventData;

        let pickerResult: GooglePickerResult;
        if (status === 'success') {
          pickerResult = {
            status: 'success',
            mode: resultMode || 'file',
            googleAccessToken: token,
            googleAccessTokenExpiresAt: tokenExpiry ? Number(tokenExpiry) : undefined,
            fileId,
            fileName,
            mimeType,
            folderId,
            folderName,
          };
        } else if (status === 'cancelled') {
          pickerResult = { status: 'cancelled' };
        } else {
          pickerResult = { status: 'error', error: errorMessage || 'Unknown error' };
        }

        handlePickerResult(pickerResult);
      });

      const params = new URLSearchParams({
        mode,
        nonce,
        openerOrigin: window.location.origin,
      });

      // Sensitive token params go in the hash fragment so they are never sent to the server
      const hashParams = new URLSearchParams();
      if (accessToken && expiresAt) {
        hashParams.set('accessToken', accessToken);
        hashParams.set('accessTokenExpiresAt', String(expiresAt));
      }
      const hashFragment = hashParams.toString() ? `#${hashParams.toString()}` : '';

      const pickerUrl = `${serverUrl}/web-extension/google-picker?${params.toString()}${hashFragment}`;
      popupRef.current = window.open(pickerUrl, 'jetstream-google-picker', 'popup,width=900,height=700');

      // Monitor if the popup is closed without sending a result
      if (popupRef.current) {
        if (popupPollRef.current) {
          clearInterval(popupPollRef.current);
        }
        popupPollRef.current = setInterval(() => {
          if (popupRef.current?.closed) {
            if (popupPollRef.current) {
              clearInterval(popupPollRef.current);
              popupPollRef.current = null;
            }
            // If we still have a nonce, the popup was closed without sending a result
            if (nonceRef.current && isMounted.current) {
              nonceRef.current = null;
              clearLoadingTimeout();
              setLoading(false);
            }
          }
        }, 1000);
      }
    },
    [isExtension, serverUrl, clearLoadingTimeout, handlePickerResult],
  );

  const signOut = useCallback(() => {
    setExternalGoogleAccessToken(null, null, null);
    setIsAuthorized(false);
    setResult(null);
    setUserInfo(null);
    setError(null);
    setLoading(false);
  }, []);

  return { openPicker, signOut, result, userInfo, loading, error, isAuthorized };
}
