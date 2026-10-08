import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ENVIRONMENT } from '../utils/environment';
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
 * DATA FLOW (Web Extension / Canvas App):
 * 1. Extension or canvas app opens this page in a popup window with mode and nonce as query params
 * 2. Page reads Google config (appId, apiKey, clientId) from build-time environment variables
 * 3. Page loads Google API scripts and initializes OAuth + Picker using the config
 * 4. User clicks "Authorize" button to trigger Google OAuth (requires user gesture for popup)
 * 5. User authenticates with Google and selects a file/folder
 * 6. Page sends results back to the opener via window.opener.postMessage()
 *    with BroadcastChannel as a fallback for iframe contexts (e.g., canvas app)
 *    where window.opener may not be available
 */

const BROADCAST_CHANNEL_NAME = 'jetstream-google-picker';

function toOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * The exact origins that may receive the picker result, which carries the Google access token.
 * The opener names itself in the query string and also chooses the nonce, so neither proves anything
 * about who opened the popup - this list is the only thing that stops a page on another site from
 * opening the picker and collecting the token once the user authorizes.
 */
const TRUSTED_OPENER_ORIGINS = new Set(
  [toOrigin(ENVIRONMENT.SERVER_URL), toOrigin(ENVIRONMENT.CLIENT_URL)].filter((origin): origin is string => !!origin),
);

const CHROME_EXTENSION_ORIGIN = ENVIRONMENT.WEB_EXTENSION_ID_CHROME ? `chrome-extension://${ENVIRONMENT.WEB_EXTENSION_ID_CHROME}` : null;

function isTrustedOpenerOrigin(origin: string | null | undefined): boolean {
  if (!origin) {
    return false;
  }
  if (TRUSTED_OPENER_ORIGINS.has(origin)) {
    return true;
  }
  if (origin.startsWith('chrome-extension://')) {
    // Production builds set NX_PUBLIC_WEB_EXTENSION_ID_CHROME so only the published extension qualifies.
    // Without it (local builds, where an unpacked extension has its own id) any extension is accepted.
    return CHROME_EXTENSION_ORIGIN ? origin === CHROME_EXTENSION_ORIGIN : true;
  }
  // Firefox gives every install its own moz-extension:// UUID, so there is no stable id to allow-list
  if (origin.startsWith('moz-extension://')) {
    return true;
  }
  return false;
}

export function useExternalGooglePickerState() {
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

  const sendResultToOpener = useCallback(
    (params: Record<string, string>) => {
      console.log('[GOOGLE_PICKER] sendResultToOpener called', {
        nonce,
        openerOrigin,
        isTrusted: isTrustedOpenerOrigin(openerOrigin),
        hasOpener: !!window.opener,
        params,
      });

      if (!nonce || !openerOrigin || !isTrustedOpenerOrigin(openerOrigin)) {
        console.warn('[GOOGLE_PICKER] Bailing: missing nonce/origin or untrusted', { nonce, openerOrigin });
        return;
      }

      const payload = { type: 'GOOGLE_PICKER_RESULT', nonce, ...params };

      // Primary: postMessage to opener window
      if (window.opener) {
        console.log('[GOOGLE_PICKER] Sending via postMessage to', openerOrigin);
        window.opener.postMessage(payload, openerOrigin);
      } else {
        console.warn('[GOOGLE_PICKER] window.opener is null, skipping postMessage');
      }

      // Fallback: BroadcastChannel for iframe contexts (e.g., canvas app)
      // where window.opener may not be available
      try {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        console.log('[GOOGLE_PICKER] Sending via BroadcastChannel');
        channel.postMessage(payload);
        channel.close();
      } catch (ex) {
        console.warn('[GOOGLE_PICKER] BroadcastChannel failed', ex);
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
