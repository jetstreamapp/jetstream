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
 * DATA FLOW (Desktop):
 * 1. Desktop app opens this page in browser with mode and nonce as query params
 * 2. Page reads Google config (appId, apiKey, clientId) from build-time environment variables
 * 3. Page loads Google API scripts and initializes OAuth + Picker using the config
 * 4. User clicks "Authorize" button to trigger Google OAuth (requires user gesture for popup)
 * 5. User authenticates with Google and selects a file/folder
 * 6. Page redirects to jetstream://googlePicker?... deep link to return results to desktop app
 */

/** Sensitive keys that must go in the hash fragment (never logged or stored in system URL caches). */
const SENSITIVE_DEEP_LINK_KEYS = new Set(['googleAccessToken', 'googleAccessTokenExpiresAt']);

function buildDeepLinkUrl(nonce: string, params: Record<string, string>): string {
  const queryParams = new URLSearchParams({ nonce });
  const hashParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_DEEP_LINK_KEYS.has(key)) {
      hashParams.set(key, value);
    } else {
      queryParams.set(key, value);
    }
  }

  const hashFragment = hashParams.toString() ? `#${hashParams.toString()}` : '';
  return `jetstream://googlePicker?${queryParams.toString()}${hashFragment}`;
}

export function useDesktopGooglePickerState() {
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') as 'file' | 'folder' | 'auth' | null;
  const nonce = searchParams?.get('nonce');

  // Google config is read from build-time env vars instead of URL params
  const googleConfig = getGoogleConfigFromEnv();

  // Token params are in the hash fragment so they are never sent to the server
  const hashParams = useHashParams('accessToken', 'accessTokenExpiresAt');
  const googleAccessToken = hashParams.accessToken;
  const googleAccessTokenExpiresAt = hashParams.accessTokenExpiresAt;

  const [{ status, errorMessage }, dispatch] = useReducer(reducer, { status: 'idle' });
  const hasStarted = useRef(false);
  const configRef = useRef<GoogleConfig | null>(null);

  const redirectToDesktop = useCallback(
    (params: Record<string, string>) => {
      if (!nonce) {
        return;
      }
      window.location.href = buildDeepLinkUrl(nonce, params);
    },
    [nonce],
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
        runPickerFlow(mode, configRef.current, googleAccessToken, googleAccessTokenExpiresAt, dispatch, redirectToDesktop, tryCloseWindow);
      } else {
        // Scripts loaded, show the authorize button
        dispatch({ type: 'SET_STATUS', status: 'awaiting_auth' });
      }
    });
  }, [mode, nonce, googleConfig, googleAccessToken, googleAccessTokenExpiresAt, redirectToDesktop, tryCloseWindow]);

  // Phase 2: User clicks button to authorize Google and open picker
  const handleAuthorize = useCallback(() => {
    if (!configRef.current || !mode) {
      return;
    }
    runAuthAndPickerFlow(mode, configRef.current, dispatch, redirectToDesktop, tryCloseWindow);
  }, [mode, redirectToDesktop, tryCloseWindow]);

  return { status, errorMessage, handleAuthorize };
}
