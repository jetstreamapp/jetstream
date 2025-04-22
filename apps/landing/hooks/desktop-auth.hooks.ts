import type { Maybe } from '@jetstream/types';
import { useSearchParams } from 'next/navigation';
import { useEffect, useReducer } from 'react';
import { ENVIRONMENT } from '../utils/environment';

/**
 * DATA FLOW:
 * Page is loading in browser with deviceId and token
 * If user is authenticated and has desktop access, validate accessToken
 * Pass token to desktop app via jetstream protocol
 * Desktop app will then call the API with the token to verify it is valid, and will then be logged in
 */

const ERROR_MESSAGES = {
  INVALID_SESSION: 'Sign in to Jetstream',
  RUNTIME_ERROR: 'Error communicating with desktop application, is the application open?',
  UNKNOWN_ERROR: 'There was an unexpected error authenticating your account',
  INVALID_SUBSCRIPTION: 'You do not have a valid subscription to use the desktop application, sign up to get access today.',
};

const ERROR_MAP = {
  MissingEntitlement: ERROR_MESSAGES.INVALID_SUBSCRIPTION,
};

async function fetchTokens(deviceId: string) {
  const response = await fetch(`${ENVIRONMENT.SERVER_URL}/desktop-app/auth/session?deviceId=${deviceId}`, {
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

type Action = { type: 'LOADING' } | { type: 'SUCCESS' } | { type: 'ERROR'; message: string };

interface State {
  status: 'idle' | 'loading' | 'success' | 'error';
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
    case 'SUCCESS': {
      return {
        ...state,
        status: 'success',
        errorMessage: null,
      };
    }
    case 'ERROR': {
      return {
        ...state,
        status: 'error',
        errorMessage:
          ERROR_MESSAGES[action.message] ?? Object.values(ERROR_MESSAGES).includes(action.message)
            ? action.message
            : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
    default:
      throw new Error('Invalid action');
  }
}

export function useDesktopAuthState() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('deviceId');
  const token = searchParams.get('token');

  const [{ status, errorMessage }, dispatch] = useReducer(reducer, {
    status: 'loading',
  });

  useEffect(() => {
    try {
      if (!deviceId || !token) {
        // For some reason on the initial render, the deviceId and token are not available
        if (!deviceId && window.location.href.includes('deviceId')) {
          return;
        }
        if (!token && window.location.href.includes('token')) {
          return;
        }
        dispatch({ type: 'ERROR', message: ERROR_MESSAGES.RUNTIME_ERROR });
      } else {
        fetchTokens(deviceId)
          .then((tokens) => {
            // Provide tokens to the extension
            window.location.href = `jetstream://auth?deviceId=${deviceId}&token=${token}&accessToken=${tokens.accessToken}`;
            // TODO: ideally we could poll server to figure out if the app was able to login successfully
            dispatch({ type: 'SUCCESS' });
          })
          .catch((err) => {
            if (err instanceof Error && Object.values(ERROR_MESSAGES).includes(err.message)) {
              dispatch({ type: 'ERROR', message: err.message });
            } else {
              dispatch({ type: 'ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR });
            }
          });
      }
    } catch (ex) {
      dispatch({ type: 'ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR });
    }
  }, [deviceId, token]);

  return { status, errorMessage };
}
