/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { UserProfileUi } from '@jetstream/types';
import { AppLoading } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import localforage from 'localforage';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { chromeSyncStorage, UserProfileState } from '../utils/extension.store';
import { sendMessage } from '../utils/web-extension.utils';
import { GlobalExtensionError } from './GlobalExtensionError';
import { GlobalExtensionLoggedOut } from './GlobalExtensionLoggedOut';

const args = new URLSearchParams(location.search.slice(1));
const salesforceHost = args.get('host');

// Configure IndexedDB database
localforage.config({
  name: 'jetstream-web-extension',
});

export interface AppInitializerProps {
  onUserProfile: (userProfile: UserProfileUi) => void;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ onUserProfile, children }) => {
  const location = useLocation();

  const { authTokens } = useRecoilValue(chromeSyncStorage);
  const chromeUserProfile = useRecoilValue(UserProfileState);
  const [userProfile, setUserProfile] = useRecoilState(fromAppState.userProfileState);

  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetRecoilState(fromAppState.salesforceOrgsState);
  const selectedOrg = useRecoilValue(fromAppState.selectedOrgState);

  const [fatalError, setFatalError] = useState<string>();

  // Ensure user access token is valid
  useEffect(() => {
    try {
      sendMessage({ message: 'VERIFY_AUTH' }).catch((err) => {
        logger.error('Error logging in', err);
      });
    } catch (err) {
      logger.error(err);
    }
  }, []);

  // set userProfile from chromeUserProfile
  useEffect(() => {
    if (chromeUserProfile) {
      setUserProfile(chromeUserProfile);
    }
  }, [chromeUserProfile, setUserProfile]);

  useNonInitialEffect(() => {
    const pageUrl = new URL(window.location.href);
    const searchParams = pageUrl.searchParams;
    searchParams.set('url', location.pathname);
    history.pushState(null, '', pageUrl);
  }, [location.pathname]);

  useEffect(() => {
    (async () => {
      try {
        if (salesforceHost) {
          const sessionInfo = await sendMessage({
            message: 'GET_SESSION',
            data: { salesforceHost },
          });
          if (sessionInfo) {
            const { org } = await sendMessage({
              message: 'INIT_ORG',
              data: { sessionInfo },
            });
            setSalesforceOrgs([org]);
            setSelectedOrgId(org.uniqueId);
          }
        }
      } catch (ex) {
        logger.error('Error initializing org', ex);
        setFatalError(getErrorMessage(ex));
      }
    })();
  }, [setSalesforceOrgs, setSelectedOrgId]);

  useEffect(() => {
    if (userProfile) {
      onUserProfile(userProfile);
    }
  }, [onUserProfile, userProfile]);

  if (fatalError) {
    return <GlobalExtensionError message={fatalError} />;
  }

  if (!authTokens?.loggedIn || !chromeUserProfile) {
    return <GlobalExtensionLoggedOut />;
  }

  if (!salesforceHost || !selectedOrg?.uniqueId) {
    return <AppLoading />;
  }

  return children;
};

export default AppInitializer;
