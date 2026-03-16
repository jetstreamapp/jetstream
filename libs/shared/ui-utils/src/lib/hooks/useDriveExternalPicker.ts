import { GooglePickerResult, GooglePickerResultSuccess } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { googleGetUserinfo } from '@jetstream/shared/data';
import { GoogleUserInfo, Maybe } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getExternalGoogleAccessToken, isExternalGoogleAccessTokenValid, setExternalGoogleAccessToken } from '../google-access-token';
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

  const isExtension = isBrowserExtension();

  function clearLoadingTimeout() {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }

  /** Shared handler for picker results from either IPC or postMessage */
  function handlePickerResult(pickerResult: GooglePickerResult) {
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
  }

  // Periodically re-check token validity so UI flips back to "Authorize" when it expires
  useEffect(() => {
    if (!isAuthorized) {
      return;
    }
    const interval = setInterval(() => {
      if (!isExternalGoogleAccessTokenValid()) {
        setIsAuthorized(false);
        setResult(null);
        setUserInfo(null);
        setError(null);
        setLoading(false);
        clearInterval(interval);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  // Desktop: listen for IPC result
  useEffect(() => {
    if (isExtension) {
      return;
    }
    isMounted.current = true;
    if (!window.electronAPI) {
      return;
    }

    const cleanup = window.electronAPI.onGooglePickerResult((pickerResult) => {
      if (!isMounted.current) {
        return;
      }
      handlePickerResult(pickerResult);
    });

    return () => {
      isMounted.current = false;
      clearLoadingTimeout();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtension]);

  // Browser extension: listen for postMessage result
  useEffect(() => {
    if (!isExtension) {
      return;
    }
    isMounted.current = true;

    function handleMessage(event: MessageEvent) {
      if (!isMounted.current) {
        return;
      }

      // Validate the message is from our picker page
      if (event.data?.type !== 'GOOGLE_PICKER_RESULT') {
        return;
      }

      // Validate nonce to prevent replay attacks
      if (!nonceRef.current || event.data.nonce !== nonceRef.current) {
        return;
      }

      // Validate origin matches expected server
      if (serverUrl && event.origin !== new URL(serverUrl).origin) {
        logger.warn('[GOOGLE] Received postMessage from unexpected origin', event.origin);
        return;
      }

      nonceRef.current = null;

      // Parse the result into a GooglePickerResult
      const {
        status,
        mode,
        googleAccessToken,
        googleAccessTokenExpiresAt,
        fileId,
        fileName,
        mimeType,
        folderId,
        folderName,
        errorMessage,
      } = event.data;

      let pickerResult: GooglePickerResult;
      if (status === 'success') {
        pickerResult = {
          status: 'success',
          mode: mode || 'file',
          googleAccessToken,
          googleAccessTokenExpiresAt: googleAccessTokenExpiresAt ? Number(googleAccessTokenExpiresAt) : undefined,
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
    }

    window.addEventListener('message', handleMessage);

    return () => {
      isMounted.current = false;
      clearLoadingTimeout();
      window.removeEventListener('message', handleMessage);
      if (popupPollRef.current) {
        clearInterval(popupPollRef.current);
        popupPollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtension, serverUrl]);

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
        }, LOADING_TIMEOUT_MS);

        window.electronAPI.openGooglePicker({ mode, accessToken, accessTokenExpiresAt: expiresAt }).catch((ex) => {
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
      }, LOADING_TIMEOUT_MS);

      const { accessToken, expiresAt } = getExternalGoogleAccessToken() || {};

      if (!accessToken) {
        setResult(null);
        setUserInfo(null);
      }

      // Fetch Google config from service worker, then open popup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extensionRuntime = ((globalThis as any).browser || (globalThis as any).chrome)?.runtime;
      if (!extensionRuntime?.sendMessage) {
        setError('Browser extension APIs are not available');
        setLoading(false);
        clearLoadingTimeout();
        return;
      }

      extensionRuntime
        .sendMessage({ message: 'GET_GOOGLE_CONFIG' })
        .then((response) => {
          if (!isMounted.current) {
            return;
          }

          if (response?.error) {
            throw new Error(response.error.message || 'Failed to get Google configuration');
          }

          const config = response?.data;
          if (!config?.appId || !config?.apiKey || !config?.clientId) {
            throw new Error('Invalid Google configuration received');
          }

          const nonce = crypto.randomUUID();
          nonceRef.current = nonce;

          const params = new URLSearchParams({
            mode,
            nonce,
            appId: config.appId,
            apiKey: config.apiKey,
            clientId: config.clientId,
            openerOrigin: window.location.origin,
          });

          if (accessToken && expiresAt) {
            params.set('accessToken', accessToken);
            params.set('accessTokenExpiresAt', String(expiresAt));
          }

          const pickerUrl = `${serverUrl}/web-extension/google-picker?${params.toString()}`;
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
        })
        .catch((ex) => {
          logger.error('Error opening Google picker', ex);
          clearLoadingTimeout();
          if (isMounted.current) {
            setError(ex instanceof Error ? ex.message : 'Failed to open Google Drive picker');
            setLoading(false);
          }
        });
    },
    [isExtension, serverUrl],
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
