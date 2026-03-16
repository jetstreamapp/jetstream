import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  ERROR_MESSAGES,
  GoogleConfig,
  initializeGoogleApis,
  reducer,
  runAuthAndPickerFlow,
  runPickerFlow,
  STORAGE_KEY,
} from './google-picker-shared';

/**
 * DATA FLOW (Desktop):
 * 1. Desktop app fetches Google config from API using the desktop JWT (server-side, no token in URL)
 * 2. Desktop app opens this page in browser with mode, nonce, and Google config (appId, apiKey, clientId) as query params
 * 3. Page loads Google API scripts and initializes OAuth + Picker using the provided config
 * 4. User clicks "Authorize" button to trigger Google OAuth (requires user gesture for popup)
 * 5. User authenticates with Google and selects a file/folder
 * 6. Page redirects to jetstream://googlePicker?... deep link to return results to desktop app
 */

function buildDeepLinkUrl(nonce: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams({ nonce, ...params });
  return `jetstream://googlePicker?${searchParams.toString()}`;
}

export function useDesktopGooglePickerState() {
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') as 'file' | 'folder' | 'auth' | null;
  const nonce = searchParams?.get('nonce');
  const appId = searchParams?.get('appId');
  const apiKey = searchParams?.get('apiKey');
  const clientId = searchParams?.get('clientId');
  const googleAccessToken = searchParams?.get('accessToken');
  const googleAccessTokenExpiresAt = searchParams?.get('accessTokenExpiresAt');

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

    if (!mode || !nonce || !appId || !apiKey || !clientId) {
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
    const config: GoogleConfig = { appId, apiKey, clientId };
    configRef.current = config;
    initializeGoogleApis(dispatch, mode === 'auth', () => {
      if (mode !== 'auth' && configRef.current && googleAccessToken && googleAccessTokenExpiresAt) {
        // User is already authorized - show picker immediately
        runPickerFlow(mode, configRef.current, googleAccessToken, googleAccessTokenExpiresAt, dispatch, redirectToDesktop, tryCloseWindow);
      } else {
        // Scripts loaded, show the authorize button
        dispatch({ type: 'SET_STATUS', status: 'awaiting_auth' });
      }
    });
  }, [mode, nonce, appId, apiKey, clientId, googleAccessToken, googleAccessTokenExpiresAt, redirectToDesktop, tryCloseWindow]);

  // Phase 2: User clicks button to authorize Google and open picker
  const handleAuthorize = useCallback(() => {
    if (!configRef.current || !mode) {
      return;
    }
    runAuthAndPickerFlow(mode, configRef.current, dispatch, redirectToDesktop, tryCloseWindow);
  }, [mode, redirectToDesktop, tryCloseWindow]);

  return { status, errorMessage, handleAuthorize };
}
