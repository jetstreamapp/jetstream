import type { Maybe } from '@jetstream/types';
import { useEffect, useReducer, useRef } from 'react';
import { ENVIRONMENT } from '../utils/environment';

// FIXME: delete this after some time when the prior extension versions are no longer in use
const webExtensionId = 'nhahnhcpbhlkmpkdgbbadffnhblhlomm';

/**
 * DATA FLOW:
 * Page --> Content Script: ACKNOWLEDGE (every 500ms until ACKNOWLEDGE_RESPONSE or timeout - used to know for sure that we have communication with the content script)
 * Page <-- Content Script: ACKNOWLEDGE_RESPONSE
 * Page --> Content Script: EXT_IDENTIFIER (Get a deviceId to limit authentication to this one user device)
 *    Content Script <--> service worker: EXT_IDENTIFIER (Get or generate a deviceId and store in browser extension storage)
 * Page --> Content Script: EXT_IDENTIFIER_RESPONSE
 * Page --> Content Script: TOKEN_EXCHANGE (Call server API to issue an access token for the user (JWT))
 *    Content Script <--> service worker: TOKEN_EXCHANGE (Save tokens in browser extension storage)
 * Page --> Content Script: TOKEN_EXCHANGE_RESPONSE (save access token in local storage)
 */

const ERROR_MESSAGES = {
  INVALID_SESSION: 'Sign in to Jetstream to use the browser extension',
  EXT_COMM_ERROR: 'Error communicating with web extension',
  RUNTIME_ERROR: 'Error communicating with web extension, do you have the extension installed?',
  UNKNOWN_ERROR: 'There was an unexpected error authenticating your account',
  INVALID_SUBSCRIPTION:
    'You do not have a valid subscription to use the browser extension, sign up for a plan that includes the browser extension.',
};

const ERROR_MAP = {
  MissingEntitlement: ERROR_MESSAGES.INVALID_SUBSCRIPTION,
};

const EVENT_MAP = {
  ACKNOWLEDGE_RESPONSE: 'ACKNOWLEDGE_RESPONSE',
  ACKNOWLEDGE: 'ACKNOWLEDGE',
  EXT_IDENTIFIER_RESPONSE: 'EXT_IDENTIFIER_RESPONSE',
  EXT_IDENTIFIER: 'EXT_IDENTIFIER',
  TOKEN_EXCHANGE_RESPONSE: 'TOKEN_EXCHANGE_RESPONSE',
  TOKEN_EXCHANGE: 'TOKEN_EXCHANGE',
} as const;

async function fetchTokens(deviceId: string) {
  const response = await fetch(`${ENVIRONMENT.SERVER_URL}/web-extension/session?deviceId=${deviceId}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(ERROR_MESSAGES.INVALID_SESSION);
    }
    const errorType = await response
      .json()
      .then(({ data }) => data?.errorType)
      .catch((err) => null);
    if (ERROR_MAP[errorType]) {
      throw new Error(ERROR_MAP[errorType]);
    }
    throw new Error(ERROR_MESSAGES.UNKNOWN_ERROR);
  }
  const tokens = await response.json().then(({ data }) => data);

  if (typeof tokens.accessToken !== 'string') {
    throw new Error(ERROR_MESSAGES.UNKNOWN_ERROR);
  }

  return tokens;
}

type Action =
  | { type: 'LOADING' }
  | { type: 'ACKNOWLEDGE' }
  | { type: 'SUCCESS' }
  | { type: 'TIMEOUT_CHECK' }
  | { type: 'ERROR'; message: string };

interface State {
  status: 'idle' | 'loading' | 'success' | 'error';
  isAcknowledged: boolean;
  errorMessage?: Maybe<string>;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOADING': {
      return {
        ...state,
        status: 'loading',
        errorMessage: null,
      };
    }
    case 'ACKNOWLEDGE': {
      return {
        ...state,
        isAcknowledged: true,
      };
    }
    case 'SUCCESS': {
      return {
        ...state,
        status: 'success',
        errorMessage: null,
      };
    }
    case 'TIMEOUT_CHECK': {
      if (state.status === 'loading') {
        return {
          ...state,
          status: 'error',
          errorMessage: ERROR_MESSAGES.RUNTIME_ERROR,
        };
      }
      return state;
    }
    case 'ERROR': {
      return {
        ...state,
        status: 'error',
        errorMessage:
          (ERROR_MESSAGES[action.message] ?? Object.values(ERROR_MESSAGES).includes(action.message))
            ? action.message
            : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
    default:
      throw new Error('Invalid action');
  }
}

export function useWebExtensionState() {
  const timeoutRef = useRef<any>(null);
  const ackIntervalRef = useRef<any>(null);

  const [{ status, isAcknowledged, errorMessage }, dispatch] = useReducer(reducer, {
    status: 'loading',
    isAcknowledged: false,
  });

  useEffect(() => {
    if (isAcknowledged) {
      clearTimeout(ackIntervalRef.current);
      window.postMessage({ message: EVENT_MAP.EXT_IDENTIFIER }, window.location.origin);
    }
  }, [isAcknowledged]);

  useEffect(() => {
    // Poll the content script until it lets us know it is ready and our message handler gets the message
    ackIntervalRef.current = setInterval(() => {
      window.postMessage({ message: EVENT_MAP.ACKNOWLEDGE }, window.location.origin);
    }, 500);
  }, []);

  useEffect(() => {
    /**
     * FIXME:: TEMPORARY
     * This code is the prior implementation and is here for backwards compatibility with older version of the chrome extension
     */
    try {
      dispatch({ type: 'LOADING' });
      const chrome = globalThis.chrome;
      if (chrome?.runtime) {
        chrome?.runtime?.sendMessage(webExtensionId, { type: 'EXT_IDENTIFIER' }, (response) => {
          clearTimeout(timeoutRef.current);
          clearTimeout(ackIntervalRef.current);
          if (!response || !response.success || !response.data) {
            dispatch({ type: 'ERROR', message: ERROR_MESSAGES.RUNTIME_ERROR });
          } else {
            fetchTokens(response.data)
              .then((accessToken) => {
                dispatch({ type: 'SUCCESS' });
                chrome.runtime.sendMessage(webExtensionId, { type: 'TOKENS', data: accessToken }, (response) => {
                  if (!response.success) {
                    console.error('Token delivery failed');
                    dispatch({ type: 'ERROR', message: ERROR_MESSAGES.EXT_COMM_ERROR });
                  }
                });
              })
              .catch((err) => {
                if (err instanceof Error && Object.values(ERROR_MESSAGES).includes(err.message)) {
                  dispatch({ type: 'ERROR', message: err.message });
                } else {
                  dispatch({ type: 'ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR });
                }
              });
          }
        });
      }
    } catch (ex) {
      console.warn('There was an error communicating with the extension', ex);
    }
  }, []);

  useEffect(() => {
    dispatch({ type: 'LOADING' });
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      const response = event.data;
      if (response?.message === EVENT_MAP.ACKNOWLEDGE_RESPONSE) {
        clearTimeout(ackIntervalRef.current);
        dispatch({ type: 'ACKNOWLEDGE' });
      } else if (response?.message === EVENT_MAP.EXT_IDENTIFIER_RESPONSE) {
        if (!response.success) {
          dispatch({ type: 'ERROR', message: ERROR_MESSAGES.RUNTIME_ERROR });
        } else {
          fetchTokens(response.deviceId)
            .then((accessToken) => {
              // Provide tokens to the extension
              window.postMessage({ message: EVENT_MAP.TOKEN_EXCHANGE, accessToken }, window.location.origin);
            })
            .catch((err) => {
              if (err instanceof Error && Object.values(ERROR_MESSAGES).includes(err.message)) {
                dispatch({ type: 'ERROR', message: err.message });
              } else {
                dispatch({ type: 'ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR });
              }
            });
        }
      } else if (response?.message === EVENT_MAP.TOKEN_EXCHANGE_RESPONSE) {
        clearTimeout(timeoutRef.current);
        if (!response.success) {
          dispatch({ type: 'ERROR', message: ERROR_MESSAGES.RUNTIME_ERROR });
        } else {
          dispatch({ type: 'SUCCESS' });
        }
      } else if (response?.message === 'ERROR') {
        dispatch({ type: 'ERROR', message: ERROR_MESSAGES.RUNTIME_ERROR });
      }
    });

    timeoutRef.current = setTimeout(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        clearTimeout(ackIntervalRef.current);
        dispatch({ type: 'TIMEOUT_CHECK' });
      }
    }, 30_000);
  }, []);

  return { status, errorMessage };
}
