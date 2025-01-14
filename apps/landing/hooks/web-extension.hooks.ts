import { parseCookie } from '@jetstream/shared/ui-utils';
import { useEffect, useState } from 'react';

const ERROR_MESSAGES = {
  INVALID_SESSION: 'Sign in to Jetstream to use the Chrome extension',
  EXT_COMM_ERROR: 'Error communicating with web extension',
  RUNTIME_ERROR: 'Error communicating with web extension, do you have the extension installed?',
  UNKNOWN_ERROR: 'There was an unexpected error authenticating your account',
  INVALID_SUBSCRIPTION:
    'You do not have a valid subscription to use the Chrome extension, sign up for a plan that includes the Chrome extension.',
};

const errorMap = {
  MissingEntitlement: ERROR_MESSAGES.INVALID_SUBSCRIPTION,
};

async function fetchTokens(deviceId: string, webExtensionId: string) {
  const response = await fetch(`/web-extension/session?deviceId=${deviceId}`, {
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
    if (errorMap[errorType]) {
      throw new Error(errorMap[errorType]);
    }
    throw new Error(ERROR_MESSAGES.UNKNOWN_ERROR);
  }
  const tokens = await response.json().then(({ data }) => data);

  if (!tokens.accessToken) {
    throw new Error(ERROR_MESSAGES.UNKNOWN_ERROR);
  }

  if (chrome && chrome.runtime) {
    console.log('Sending tokens to Chrome extension');
    chrome.runtime.sendMessage(webExtensionId, { type: 'TOKENS', data: tokens }, (response) => {
      if (!response.success) {
        console.error('Token delivery failed');
        throw new Error(ERROR_MESSAGES.EXT_COMM_ERROR);
      }
    });
  } else {
    console.error('Chrome runtime not available');
    throw new Error(ERROR_MESSAGES.RUNTIME_ERROR);
  }
}

export function useWebExtensionState() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    setState('loading');
    const webExtensionId = parseCookie<string>('WEB_EXTENSION_ID');
    if (chrome?.runtime && webExtensionId) {
      chrome?.runtime?.sendMessage(webExtensionId, { type: 'EXT_IDENTIFIER' }, (response) => {
        if (!response || !response.success || !response.data) {
          setState('error');
          setErrorMessage(ERROR_MESSAGES.RUNTIME_ERROR);
        } else {
          fetchTokens(response.data, webExtensionId)
            .then(() => {
              setState('success');
            })
            .catch((err) => {
              setState('error');
              if (err instanceof Error && Object.values(ERROR_MESSAGES).includes(err.message)) {
                setErrorMessage(err.message);
              } else {
                setErrorMessage(ERROR_MESSAGES.UNKNOWN_ERROR);
              }
            });
        }
      });
    } else {
      setState('error');
      setErrorMessage(ERROR_MESSAGES.RUNTIME_ERROR);
    }
  }, []);

  return { state, errorMessage };
}
