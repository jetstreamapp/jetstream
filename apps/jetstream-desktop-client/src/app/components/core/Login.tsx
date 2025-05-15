import { css } from '@emotion/react';
import { AuthenticatePayload, DesktopAuthInfo } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { Grid } from '@jetstream/ui';
import { AppLoading, JetstreamLogoInverse } from '@jetstream/ui-core';
import { DEFAULT_PROFILE, fromAppState } from '@jetstream/ui/app-state';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

interface LoginProps {
  children: (props: { onLogout: () => void; authInfo: DesktopAuthInfo }) => React.ReactNode;
}

export function Login({ children }: LoginProps) {
  const [loading, setLoading] = useState(true);
  // TODO: show loading indicator or message?
  const [loggingIn, setLoggingIn] = useState(false);
  const [authInfo, setAuthInfo] = useState<DesktopAuthInfo>();
  const [userProfile, setUserProfile] = useRecoilState(fromAppState.userProfileState);

  const authenticationEventHandler = useCallback(
    (response: AuthenticatePayload) => {
      if (response.success) {
        setUserProfile(response.userProfile);
        setAuthInfo(response.authInfo);
      } else {
        // TODO: handle else case and show error message
        logger.warn('Login failed', response);
      }
      setLoggingIn(false);
    },
    [setUserProfile]
  );

  const handleLogout = useCallback(() => {
    window.electronAPI?.logout();
    setUserProfile(DEFAULT_PROFILE);
  }, [setUserProfile]);

  useEffect(() => {
    setLoading(true);
    if (!window.electronAPI) {
      return;
    }
    window.electronAPI.onAuthenticate(authenticationEventHandler);
    window.electronAPI
      .checkAuth()
      .then((response) => {
        if (response) {
          const { authInfo, userProfile } = response;
          setAuthInfo(authInfo);
          setUserProfile(userProfile);
        }
      })
      .finally(() => setLoading(false));
  }, [authenticationEventHandler, setUserProfile]);

  if (authInfo && userProfile?.id && userProfile.id !== DEFAULT_PROFILE.id) {
    return children({ onLogout: handleLogout, authInfo });
  }

  if (loading) {
    return <AppLoading />;
  }

  function handleLogin() {
    setLoggingIn(true);
    window.electronAPI?.login();
  }

  return (
    <div
      css={css`
        height: 100vh;
        width: 100vw;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #111827;
        app-region: drag;
      `}
    >
      <Grid
        vertical
        css={css`
          width: 500px;
        `}
      >
        <JetstreamLogoInverse className="slds-m-bottom_xx-large" />
        <button
          css={css`
            background-image: linear-gradient(to right, #14b8a6, #0891b2);
            color: rgba(255, 255, 255);
            border-color: transparent;
            text-wrap-mode: nowrap;
            :hover {
              background-image: linear-gradient(to right, #0d9488, #0e7490);
            }
            app-region: no-drag;
          `}
          className="slds-button slds-button_brand"
          onClick={handleLogin}
        >
          Login
        </button>
      </Grid>
    </div>
  );
}
