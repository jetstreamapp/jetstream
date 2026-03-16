import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  ERROR_MESSAGES,
  getGoogleConfigFromEnv,
  GoogleConfig,
  initializeGoogleApis,
  reducer,
  runAuthAndPickerFlow,
  runPickerFlow,
  STORAGE_KEY,
  useHashParams,
} from './google-picker-shared';

/**
 * DATA FLOW (Web Extension):
 * 1. Extension opens this page in a popup window with mode and nonce as query params
 * 2. Page reads Google config (appId, apiKey, clientId) from build-time environment variables
 * 3. Page loads Google API scripts and initializes OAuth + Picker using the config
 * 4. User clicks "Authorize" button to trigger Google OAuth (requires user gesture for popup)
 * 5. User authenticates with Google and selects a file/folder
 * 6. Page sends results back to the extension via window.opener.postMessage()
 */

export function useWebExtensionGooglePickerState() {
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') as 'file' | 'folder' | 'auth' | null;
  const nonce = searchParams?.get('nonce');
  const openerOrigin = searchParams?.get('openerOrigin') || searchParams?.get('targetOrigin');

  // Google config is read from build-time env vars instead of URL params
  const googleConfig = getGoogleConfigFromEnv();

  // Token params are in the hash fragment so they are never sent to the server
  const hashParams = useHashParams('accessToken', 'accessTokenExpiresAt');
  const googleAccessToken = hashParams.accessToken;
  const googleAccessTokenExpiresAt = hashParams.accessTokenExpiresAt;

  const [{ status, errorMessage }, dispatch] = useReducer(reducer, { status: 'idle' });
  const hasStarted = useRef(false);
  const configRef = useRef<GoogleConfig | null>(null);

  const isTrustedOrigin = (origin: string | undefined) => {
    // Only allow extension origins or other trusted origins
    // Example: chrome-extension://<id>
    return !!origin && (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'));
  };

  const sendResultToOpener = useCallback(
    (params: Record<string, string>) => {
      if (!nonce || !openerOrigin || !isTrustedOrigin(openerOrigin)) {
        return;
      }
      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_PICKER_RESULT', nonce, ...params }, openerOrigin);
      }
    },
    [nonce, openerOrigin],
  );

  const tryCloseWindow = useCallback(() => {
    setTimeout(() => {
      try {
        window.close();
      } catch {
        // Browser may block window.close() for tabs not opened by script
      }
    }, 1500);
  }, []);

  // Phase 1: Auto-load Google scripts and initialize gapi (no user gesture needed)
  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    // Prevent re-execution on page refresh
    const didCompleteAlready = sessionStorage.getItem(STORAGE_KEY) === 'true';
    if (didCompleteAlready) {
      dispatch({ type: 'SET_STATUS', status: 'success' });
      return;
    }

    if (!mode || !nonce || !googleConfig) {
      // Wait for params to become available (Next.js initial render quirk)
      if (window.location.href.includes('nonce') && !nonce) {
        return;
      }
      dispatch({ type: 'ERROR', message: ERROR_MESSAGES.MISSING_PARAMS });
      return;
    }

    if (mode !== 'file' && mode !== 'folder' && mode !== 'auth') {
      dispatch({ type: 'ERROR', message: ERROR_MESSAGES.MISSING_PARAMS });
      return;
    }

    hasStarted.current = true;
    configRef.current = googleConfig;
    initializeGoogleApis(dispatch, mode === 'auth', () => {
      if (mode !== 'auth' && configRef.current && googleAccessToken && googleAccessTokenExpiresAt) {
        // User is already authorized - show picker immediately
        runPickerFlow(mode, configRef.current, googleAccessToken, googleAccessTokenExpiresAt, dispatch, sendResultToOpener, tryCloseWindow);
      } else {
        // Scripts loaded, show the authorize button
        dispatch({ type: 'SET_STATUS', status: 'awaiting_auth' });
      }
    });
  }, [mode, nonce, googleConfig, googleAccessToken, googleAccessTokenExpiresAt, sendResultToOpener, tryCloseWindow]);

  // Phase 2: User clicks button to authorize Google and open picker
  const handleAuthorize = useCallback(() => {
    if (!configRef.current || !mode) {
      return;
    }
    runAuthAndPickerFlow(mode, configRef.current, dispatch, sendResultToOpener, tryCloseWindow);
  }, [mode, sendResultToOpener, tryCloseWindow]);

  return { status, errorMessage, handleAuthorize };
}
