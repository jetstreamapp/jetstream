import { logger } from '@jetstream/shared/client-logger';
import { Maybe } from '@jetstream/types';
import { useNonInitialEffect } from 'libs/shared/ui-utils/src/lib/hooks/useNonInitialEffect';
import { useRollbar } from 'libs/shared/ui-utils/src/lib/hooks/useRollbar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getUseInjectScript } from './useInjectScript';

const useInjectScript = getUseInjectScript('https://accounts.google.com/gsi/client');

const apiConfig: ApiConfig = {
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  DEFAULT_SCOPE: 'https://www.googleapis.com/auth/drive.file',
};

let API_LOADED: ApisLoaded = {
  auth: false,
  picker: false,
  drive: false,
};
let _signedIn = false;
let _authorized = false;
let _authResponse: Maybe<gapi.auth2.AuthResponse>;

let gapiAuthInstance: gapi.auth2.GoogleAuth;

export interface ApiConfig {
  discoveryDocs: string[];
  DEFAULT_SCOPE: string;
}

export interface ApisLoaded {
  auth: boolean;
  picker: boolean;
  drive: boolean;
}

export interface GoogleApiData {
  apiConfig: ApiConfig;
  authorized: boolean;
  authResponse: Maybe<gapi.auth2.AuthResponse>;
  error?: string;
  gapiAuthInstance: gapi.auth2.GoogleAuth;
  hasApisLoaded: boolean;
  hasInitialized: boolean;
  signedIn: boolean;
}

export interface GoogleApiClientConfig {
  appId: string;
  apiKey: string;
  clientId: string;
}

/**
 * Handles loading Google API via script tag and loading individual libraries
 * @returns
 */
export function useLoadGoogleApi({
  apiKey,
  appId,
  clientId,
}: GoogleApiClientConfig): [GoogleApiData, (options?: gapi.auth2.SigninOptions) => void, () => void] {
  const isMounted = useRef(true);
  const rollbar = useRollbar();
  const [scriptLoaded, scriptLoadError] = useInjectScript();
  const [error, setError] = useState<string | null>(null);
  const [hasApisLoaded, setHasApisLoaded] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(!!gapiAuthInstance);
  const [signedIn, setSignedIn] = useState(_signedIn);
  const [authorized, setAuthorized] = useState(_authorized);
  const [authResponse, setAuthResponse] = useState<Maybe<gapi.auth2.AuthResponse>>(_authResponse);
  const [apiLoaded, setApiLoaded] = useState(API_LOADED);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // get the apis from googleapis
  useEffect(() => {
    if (scriptLoaded && !scriptLoadError && !hasApisLoaded) {
      loadApis();
    }
  }, [scriptLoaded, scriptLoadError, hasApisLoaded]);

  useNonInitialEffect(() => {
    API_LOADED = apiLoaded;
    _signedIn = signedIn;
    _authorized = authorized;
    _authResponse = authResponse;
  }, [apiLoaded, signedIn, authorized, authResponse]);

  useEffect(() => {
    if (scriptLoadError) {
      setError('There was an error initializing Google');
      rollbar?.critical('Error loading Google API script from Network');
    }
  }, [scriptLoadError]);

  // load the Drive picker api
  const loadApis = useCallback(async () => {
    setHasApisLoaded(true);
    if (!apiLoaded.auth && gapi) {
      // https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#js-client-library_4
      /** @deprecated */
      gapi.load('client:auth2', () => {
        if (isMounted.current) {
          setApiLoaded((priorValue) => ({ ...priorValue, auth: true }));
        }
        gapi.client.load('drive', 'v3').then(
          () => {
            if (isMounted.current) {
              setApiLoaded((priorValue) => ({ ...priorValue, drive: true }));
            }
          },
          (reason) => {
            if (isMounted.current) {
              logger.error('Error loading API client', reason);
              setError('There was an error initializing Google');
              rollbar?.critical('Error loading Google API', { reason });
            }
          }
        );
        initClient(apiConfig.DEFAULT_SCOPE);
      });
    }
    if (!apiLoaded.picker && gapi) {
      gapi.load('picker', () => {
        if (isMounted.current) {
          setApiLoaded((priorValue) => ({ ...priorValue, picker: true }));
        }
      });
    }
  }, []);

  const initClient = useCallback(async (scope: string, forceInit?: boolean) => {
    try {
      if (forceInit || !gapiAuthInstance) {
        await gapi.client.init({
          apiKey,
          clientId,
          discoveryDocs: apiConfig.discoveryDocs,
          scope, // space-delimited list of access scopes.
        });
        if (isMounted.current) {
          /** @deprecated */
          gapiAuthInstance = gapi.auth2.getAuthInstance();
          setHasInitialized(true);
          logger.log('Google initialized');
          // if user previously signed in, then they are signed in upon init
          if (gapiAuthInstance.isSignedIn.get()) {
            /** @deprecated */
            initSignIn(gapiAuthInstance.currentUser.get());
          }
        }
      }
    } catch (ex) {
      if (isMounted.current) {
        let errorMessage = 'There was an error initializing Google';
        const details: string = ex?.details || '';
        logger.error('Error loading API client', ex);
        rollbar?.critical('Error loading Google API', { message: ex.message || ex.error, stack: ex.stack, details: ex.details, error: ex });
        if (ex.error === 'idpiframe_initialization_failed') {
          if (details.startsWith('Not a valid origin for the client')) {
            // this is a misconfiguration, keep default error message
          } else if (details.startsWith(`Failed to read the 'localStorage' property`)) {
            errorMessage = 'Loading Google failed. Website data storage must be enabled.';
          } else if (details.startsWith('Cookies are not enabled')) {
            errorMessage = 'Loading Google failed. Logging in with Google is not supported in Incognito or private browsing mode.';
          }
        }
        setError(errorMessage);
      }
    }
  }, []);

  function initSignIn(user: gapi.auth2.GoogleUser) {
    logger.log('Signed in with Google');
    setSignedIn(true);
    setAuthResponse(user.getAuthResponse(true));
    setAuthorized(user.hasGrantedScopes(apiConfig.DEFAULT_SCOPE));
  }

  const signIn = useCallback(
    async (options?: gapi.auth2.SigninOptions) => {
      try {
        if (scriptLoaded && hasInitialized && hasApisLoaded && !!gapiAuthInstance && (!signedIn || !authorized)) {
          options = options || {};
          options.prompt = options.prompt ?? 'select_account';
          options.fetch_basic_profile = options.fetch_basic_profile ?? false;
          options.ux_mode = 'popup';
          options.scope = apiConfig.DEFAULT_SCOPE;

          const user = await gapiAuthInstance.signIn(options);
          if (isMounted.current) {
            initSignIn(user);
          }
        }
      } catch (ex) {
        if (isMounted.current) {
          logger.error('Error Signing in', ex);
          if (ex.error === 'popup_closed_by_user') {
            return;
          } else if (ex.error === 'access_denied') {
            setError('You did not provide the required access, sign in again and choose the necessary permissions.');
          } else {
            setError('There was a problem signing in');
            rollbar?.critical('Google Sign In error', { message: ex.message || ex.error, stack: ex.stack, ex: ex });
          }
        }
      }
    },
    [authorized, error, hasApisLoaded, hasInitialized, signedIn]
  );

  const signOut = useCallback(() => {
    try {
      if (signedIn) {
        gapiAuthInstance.signOut();
        setSignedIn(false);
        setAuthorized(false);
        setAuthResponse(null);
      }
    } catch (ex) {
      logger.error('Error Signing out', ex);
      rollbar?.critical('Google Sign Out error (could be user initiated)', { message: ex.message || ex.error, stack: ex.stack });
    }
  }, [signedIn]);

  return [
    {
      apiConfig,
      authorized,
      authResponse,
      error,
      gapiAuthInstance,
      hasApisLoaded,
      hasInitialized,
      signedIn,
    },
    signIn,
    signOut,
  ];
}
