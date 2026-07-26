import { css } from '@emotion/react';
import { AuthenticatePayload, DesktopAuthInfo } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { disconnectSocket, getOrgGroups, getOrgs } from '@jetstream/shared/data';
import { applyVerifiedFeatureFlags } from '@jetstream/shared/ui-utils';
import { UserProfileUi } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { AppLoading, JetstreamLogoInverse } from '@jetstream/ui-core';
import { DEFAULT_PROFILE, fromAppState } from '@jetstream/ui/app-state';
import { clearLocalStorageScope, isDifferentUserThanPageSession } from '@jetstream/ui/db';
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
  const [loginError, setLoginError] = useState<string | null>(null);
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

  /**
   * Adopt the signed-in user, or reload the renderer first when this is a different account than the
   * one local storage was already scoped to. `handleLogout` reloads for the normal sign out path, but
   * a session that expires drops back to the login screen in place — without this, the next account
   * to sign in from there would inherit the previous user's in-memory state.
   *
   * Returns false when a reload is underway, so callers skip the rest of their sign in work.
   */
  const applySignedInUser = useCallback(
    async (userProfile: UserProfileUi) => {
      if (isDifferentUserThanPageSession(userProfile.id)) {
        clearLocalStorageScope();
        window.location.reload();
        return false;
      }
      // Verify the feature flag signature before trusting flags from the main process (fail-closed to code defaults)
      setUserProfile(await applyVerifiedFeatureFlags(userProfile));
      return true;
    },
    [setUserProfile],
  );

  const authenticationEventHandler = useCallback(
    async (response: AuthenticatePayload) => {
      if (response.success) {
        setLoginError(null);
        if (!(await applySignedInUser(response.userProfile))) {
          return;
        }
        setAuthInfo(response.authInfo);
        // Re-fetch orgs and org groups now that the encryption key is set on the main process
        await refreshOrgsAndGroups();
      } else {
        logger.warn('Login failed', response);
        setLoginError(response.error || 'Unable to complete sign in. Please try again.');
      }
    },
    [applySignedInUser, refreshOrgsAndGroups],
  );

  const handleLogout = useCallback(async () => {
    // Tear down the authenticated data-sync socket before clearing session state so it is not
    // reused by the next account that signs in on the same running app instance.
    disconnectSocket();
    // Unbind the per-user Dexie/localforage stores so nothing can read this account's local data
    // between here and the reload below.
    clearLocalStorageScope();
    setLoginError(null);
    setUserProfile(DEFAULT_PROFILE);
    try {
      await window.electronAPI?.logout();
    } catch (ex) {
      logger.error('Error during logout', ex);
    }
    // Reload the renderer so all in-memory state and the per-user local databases are rebuilt from
    // scratch for the next account. The Dexie/localforage stores are scoped and selected at init,
    // so a fresh boot guarantees the next user never reads the previous user's local data.
    window.location.reload();
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
          if (!(await applySignedInUser(userProfile))) {
            return;
          }
          setAuthInfo(authInfo);
          // Re-fetch orgs and org groups after auth completes — the encryption key
          // is now set on the main process, so orgs can be decrypted successfully.
          await refreshOrgsAndGroups();
        }
      })
      .finally(() => setLoading(false));

    // Check auth occasionally in case of token expiry or revocation
    const interval = setInterval(() => {
      window.electronAPI?.checkAuth().then(async (response) => {
        if (response) {
          const { authInfo, userProfile } = response;
          if (!(await applySignedInUser(userProfile))) {
            return;
          }
          setAuthInfo(authInfo);
        } else {
          // The session ended without going through `handleLogout` (expired or revoked) and this
          // renderer stays mounted, so unbind the stores here too rather than leaving the departing
          // account's local data readable until the next sign in.
          clearLocalStorageScope();
          setAuthInfo(undefined);
          setUserProfile(DEFAULT_PROFILE);
        }
      });
    }, CHECK_AUTH_TIMER_INTERVAL);

    return () => {
      clearInterval(interval);
      unsubscribeAuth();
    };
  }, [authenticationEventHandler, applySignedInUser, setUserProfile, refreshOrgsAndGroups]);

  function handleLogin() {
    setLoginError(null);
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
        {loginError && (
          <div
            role="alert"
            className="slds-m-bottom_medium"
            css={css`
              background-color: #7f1d1d;
              color: #fee2e2;
              padding: 0.75rem 1rem;
              border-radius: 0.25rem;
              text-align: center;
              app-region: no-drag;
            `}
          >
            {loginError}
          </div>
        )}
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
