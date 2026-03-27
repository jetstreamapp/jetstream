import type { Maybe } from '@jetstream/types';
import { useEffect, useState } from 'react';

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'].join(' ');

export const ERROR_MESSAGES = {
  MISSING_PARAMS: 'Missing required parameters. Please try again from the application.',
  GOOGLE_LOAD_FAILED: 'There was an error loading Google. Please try again.',
  GOOGLE_AUTH_FAILED: 'There was an error authenticating with Google.',
  PICKER_FAILED: 'There was an error opening the file picker.',
  UNKNOWN_ERROR: 'There was an unexpected error. Please try again.',
};

export const STORAGE_KEY = 'google-picker-success';

export interface GoogleConfig {
  appId: string;
  apiKey: string;
  clientId: string;
}

export type PickerStatus =
  | 'idle'
  | 'loading_google'
  | 'awaiting_auth'
  | 'authenticating'
  | 'picker_open'
  | 'success'
  | 'cancelled'
  | 'error';

export type Action = { type: 'SET_STATUS'; status: PickerStatus } | { type: 'ERROR'; message: string };

export interface State {
  status: PickerStatus;
  errorMessage?: Maybe<string>;
}

export type SendResult = (params: Record<string, string>) => void;

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_STATUS': {
      return { ...state, status: action.status, errorMessage: null };
    }
    case 'ERROR': {
      return { ...state, status: 'error', errorMessage: action.message };
    }
    default:
      throw new Error('Invalid action');
  }
}

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

/**
 * https://stackoverflow.com/questions/48459402/change-google-picker-docsview-title
 * setLabel is not documented and not included in typescript definition, but it works
 */
export function setViewLabel(view: google.picker.DocsView | google.picker.DocsUploadView | google.picker.ViewId, label: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _view: any = view;
    if (_view && typeof _view.setLabel === 'function') {
      _view.setLabel(label);
    }
  } catch {
    console.warn('Unable to set view label');
  }
  return view;
}

/**
 * Read sensitive params from the URL hash fragment (never sent to the server).
 * Clears the hash from the URL bar after reading to minimize browser history exposure.
 *
 * The hash is read eagerly in the useState initializer so values are available on
 * the very first render, and cleared via replaceState in a useEffect so it runs
 * after hydration (avoids SSR/client mismatch in dev).
 */
export function useHashParams<T extends string>(...keys: T[]): Record<T, string | null> {
  const [params] = useState<Record<T, string | null>>(() => {
    const result = {} as Record<T, string | null>;
    if (typeof window === 'undefined') {
      for (const key of keys) {
        result[key] = null;
      }
      return result;
    }
    const hash = window.location.hash;
    const hashParams = hash && hash.length > 1 ? new URLSearchParams(hash.slice(1)) : null;
    for (const key of keys) {
      result[key] = hashParams?.get(key) ?? null;
    }
    return result;
  });

  useEffect(() => {
    if (window.location.hash && window.location.hash.length > 1) {
      // Delay clearing so it runs after Next.js client-side hydration settles
      const timer = setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return params;
}

/**
 * Read Google config from build-time environment variables.
 * These are baked into the static export via next.config.js.
 */
export function getGoogleConfigFromEnv(): GoogleConfig | null {
  const appId = process.env.GOOGLE_APP_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!appId || !apiKey || !clientId) {
    return null;
  }
  return { appId, apiKey, clientId };
}

export class PickerCancelledError extends Error {
  constructor() {
    super('Picker cancelled');
    this.name = 'PickerCancelledError';
  }
}

/**
 * Load Google scripts and initialize gapi client + picker.
 * This runs automatically on page load (no user gesture required).
 */
export async function initializeGoogleApis(dispatch: React.Dispatch<Action>, authOnly = false, onSuccess: () => void) {
  try {
    dispatch({ type: 'SET_STATUS', status: 'loading_google' });
    await Promise.all([loadScript('https://apis.google.com/js/api.js'), loadScript('https://accounts.google.com/gsi/client')]);

    await new Promise<void>((resolve, reject) => {
      gapi.load('client', { callback: () => resolve(), onerror: () => reject(new Error('Failed to load gapi client')) });
    });

    await gapi.client.init({});

    // Picker library is only needed for file/folder selection, not auth-only
    if (!authOnly) {
      await new Promise<void>((resolve, reject) => {
        gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('Failed to load picker')) });
      });
    }

    onSuccess();
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.GOOGLE_LOAD_FAILED;
    const displayMessage = Object.values(ERROR_MESSAGES).includes(message) ? message : ERROR_MESSAGES.GOOGLE_LOAD_FAILED;
    dispatch({ type: 'ERROR', message: displayMessage });
  }
}

/**
 * Request Google OAuth token and open the picker.
 * Must be called from a user gesture (button click) so the browser allows the popup.
 */
export async function runAuthAndPickerFlow(
  mode: 'file' | 'folder' | 'auth',
  config: GoogleConfig,
  dispatch: React.Dispatch<Action>,
  sendResult: SendResult,
  tryCloseWindow: () => void,
) {
  try {
    dispatch({ type: 'SET_STATUS', status: 'authenticating' });
    const tokenResponse = await new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else {
            resolve(response);
          }
        },
        error_callback: (error) => {
          reject(new Error(error.message || ERROR_MESSAGES.GOOGLE_AUTH_FAILED));
        },
      });
      tokenClient.requestAccessToken();
    });

    const googleAccessToken = tokenResponse.access_token;
    const googleAccessTokenExpiresAt = tokenResponse.expires_in ? String(Date.now() + Number(tokenResponse.expires_in) * 1000) : undefined;

    // Auth-only mode: skip the picker and return the token immediately
    if (mode === 'auth') {
      sendResult({
        status: 'success',
        mode: 'auth',
        googleAccessToken,
        ...(googleAccessTokenExpiresAt && { googleAccessTokenExpiresAt }),
      });
      dispatch({ type: 'SET_STATUS', status: 'success' });
      sessionStorage.setItem(STORAGE_KEY, 'true');
      tryCloseWindow();
      return;
    }

    // runPickerFlow handles its own errors internally (including cancellation),
    // so no picker errors will bubble up to this catch block.
    runPickerFlow(mode, config, googleAccessToken, googleAccessTokenExpiresAt, dispatch, sendResult, tryCloseWindow);
  } catch (error) {
    // This catch block only handles errors from the OAuth token flow above.
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR;
    const displayMessage = Object.values(ERROR_MESSAGES).includes(message) ? message : ERROR_MESSAGES.UNKNOWN_ERROR;

    dispatch({ type: 'ERROR', message: displayMessage });
    sendResult({
      status: 'error',
      errorMessage: displayMessage,
    });
  }
}

export async function runPickerFlow(
  mode: 'file' | 'folder',
  config: GoogleConfig,
  googleAccessToken: string,
  googleAccessTokenExpiresAt: string | undefined,
  dispatch: React.Dispatch<Action>,
  sendResult: SendResult,
  tryCloseWindow: () => void,
) {
  try {
    dispatch({ type: 'SET_STATUS', status: 'picker_open' });
    const pickerResult = await new Promise<google.picker.ResponseObject>((resolve, reject) => {
      const pickerCallback = (data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve(data);
        } else if (data.action === google.picker.Action.CANCEL) {
          reject(new PickerCancelledError());
        }
      };

      const pickerBuilder = new google.picker.PickerBuilder()
        .setAppId(config.appId)
        .setDeveloperKey(config.apiKey)
        .setOAuthToken(googleAccessToken)
        .setLocale('en')
        .setSize(window.innerWidth * 0.9, window.innerHeight * 0.9)
        .setCallback(pickerCallback);

      if (mode === 'file') {
        [
          { view: new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setIncludeFolders(true) },
          { view: new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS), label: 'All spreadsheets' },
          { view: new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setEnableDrives(true).setIncludeFolders(true) },
        ].forEach(({ view, label }) => {
          if (label) {
            setViewLabel(view, label);
          }
          pickerBuilder.addView(view);
        });
      } else {
        pickerBuilder.setTitle('Select a folder');
        [
          {
            view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
              .setSelectFolderEnabled(true)
              .setMode(window.google.picker.DocsViewMode.LIST)
              .setOwnedByMe(true),
            label: 'My folders',
          },
          {
            view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
              .setSelectFolderEnabled(true)
              .setMode(window.google.picker.DocsViewMode.LIST)
              .setStarred(true),
            label: 'Starred folders',
          },
          {
            view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
              .setSelectFolderEnabled(true)
              .setMode(window.google.picker.DocsViewMode.LIST)
              .setOwnedByMe(false),
            label: 'Shared with me',
          },
          {
            view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
              .setSelectFolderEnabled(true)
              .setMode(window.google.picker.DocsViewMode.LIST)
              .setEnableDrives(true),
          },
        ].forEach(({ view, label }) => {
          if (label) {
            setViewLabel(view, label);
          }
          pickerBuilder.addView(view);
        });
      }

      const picker = pickerBuilder.build();
      picker.setVisible(true);
    });

    if (pickerResult.docs && pickerResult.docs.length > 0) {
      const doc = pickerResult.docs[0];

      if (mode === 'file') {
        sendResult({
          status: 'success',
          mode: 'file',
          googleAccessToken,
          ...(googleAccessTokenExpiresAt && { googleAccessTokenExpiresAt }),
          fileId: doc.id,
          fileName: doc.name || '',
          mimeType: doc.mimeType || '',
        });
      } else {
        sendResult({
          status: 'success',
          mode: 'folder',
          googleAccessToken,
          ...(googleAccessTokenExpiresAt && { googleAccessTokenExpiresAt }),
          folderId: doc.id,
          folderName: doc.name || '',
        });
      }

      dispatch({ type: 'SET_STATUS', status: 'success' });
      sessionStorage.setItem(STORAGE_KEY, 'true');
      tryCloseWindow();
    } else {
      // Picker resolved with PICKED action but no documents selected
      dispatch({ type: 'SET_STATUS', status: 'cancelled' });
      sendResult({ status: 'cancelled' });
      tryCloseWindow();
    }
  } catch (error) {
    if (error instanceof PickerCancelledError) {
      dispatch({ type: 'SET_STATUS', status: 'cancelled' });
      sendResult({ status: 'cancelled' });
      tryCloseWindow();
      return;
    }

    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR;
    const displayMessage = Object.values(ERROR_MESSAGES).includes(message) ? message : ERROR_MESSAGES.UNKNOWN_ERROR;

    dispatch({ type: 'ERROR', message: displayMessage });
    sendResult({
      status: 'error',
      errorMessage: displayMessage,
    });
  }
}
