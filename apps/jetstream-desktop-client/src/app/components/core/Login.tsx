import { css } from '@emotion/react';
import { AuthenticatePayload, DesktopAuthInfo } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { getOrgGroups, getOrgs } from '@jetstream/shared/data';
import { Grid } from '@jetstream/ui';
import { AppLoading, JetstreamLogoInverse } from '@jetstream/ui-core';
import { DEFAULT_PROFILE, fromAppState } from '@jetstream/ui/app-state';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

// 12 hours in milliseconds
const CHECK_AUTH_TIMER_INTERVAL = 12 * 60 * 60 * 1000;

interface LoginProps {
  children: (props: { onLogout: () => void; authInfo: DesktopAuthInfo }) => React.ReactNode;
}

export function Login({ children }: LoginProps) {
  const [loading, setLoading] = useState(true);
  const [authInfo, setAuthInfo] = useState<DesktopAuthInfo>();
  const [userProfile, setUserProfile] = useAtom(fromAppState.userProfileState);
  const setOrgs = useSetAtom(fromAppState.salesforceOrgsState);
  const setOrgGroups = useSetAtom(fromAppState.orgGroupsState);

  const refreshOrgsAndGroups = useCallback(async () => {
    const [orgsResult, orgGroupsResult] = await Promise.allSettled([getOrgs(), getOrgGroups()]);
    if (orgsResult.status === 'fulfilled') {
      setOrgs(orgsResult.value);
    } else {
      logger.warn('Error refreshing orgs', orgsResult.reason);
    }
    if (orgGroupsResult.status === 'fulfilled') {
      setOrgGroups(orgGroupsResult.value);
    } else {
      logger.warn('Error refreshing org groups', orgGroupsResult.reason);
    }
  }, [setOrgs, setOrgGroups]);

  const authenticationEventHandler = useCallback(
    async (response: AuthenticatePayload) => {
      if (response.success) {
        setUserProfile(response.userProfile);
        setAuthInfo(response.authInfo);
        // Re-fetch orgs and org groups now that the encryption key is set on the main process
        await refreshOrgsAndGroups();
      } else {
        // TODO: handle else case and show error message
        logger.warn('Login failed', response);
      }
    },
    [setUserProfile, refreshOrgsAndGroups],
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

    // Register authentication event listener and get cleanup function
    const unsubscribeAuth = window.electronAPI.onAuthenticate(authenticationEventHandler);

    window.electronAPI
      .checkAuth()
      .then(async (response) => {
        if (response) {
          const { authInfo, userProfile } = response;
          setAuthInfo(authInfo);
          setUserProfile(userProfile);
          // Re-fetch orgs and org groups after auth completes — the encryption key
          // is now set on the main process, so orgs can be decrypted successfully.
          await refreshOrgsAndGroups();
        }
      })
      .finally(() => setLoading(false));

    // Check auth occasionally in case of token expiry or revocation
    const interval = setInterval(() => {
      window.electronAPI?.checkAuth().then((response) => {
        if (response) {
          const { authInfo, userProfile } = response;
          setAuthInfo(authInfo);
          setUserProfile(userProfile);
        } else {
          setAuthInfo(undefined);
          setUserProfile(DEFAULT_PROFILE);
        }
      });
    }, CHECK_AUTH_TIMER_INTERVAL);

    return () => {
      clearInterval(interval);
      unsubscribeAuth();
    };
  }, [authenticationEventHandler, setUserProfile, refreshOrgsAndGroups]);

  function handleLogin() {
    window.electronAPI?.login();
  }

  /**
   * Logged in children renderer
   */
  if (authInfo && userProfile?.id && userProfile.id !== DEFAULT_PROFILE.id) {
    return children({ onLogout: handleLogout, authInfo });
  }

  /**
   * Loading
   */
  if (loading) {
    return <AppLoading />;
  }

  /**
   * Not logged in
   */
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
