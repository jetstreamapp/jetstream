/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { getErrorMessage } from '@jetstream/shared/utils';
import { UserProfileUi } from '@jetstream/types';
import { AppLoading, fromAppState } from '@jetstream/ui-core';
import { sendMessage } from '@jetstream/web-extension-utils';
import localforage from 'localforage';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { GlobalExtensionError } from './GlobalExtensionError';

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
  const userProfile = useRecoilValue<UserProfileUi>(fromAppState.userProfileState);

  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetRecoilState(fromAppState.salesforceOrgsState);
  const selectedOrg = useRecoilValue(fromAppState.selectedOrgState);

  const [fatalError, setFatalError] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        if (salesforceHost) {
          const sessionInfo = await sendMessage({
            message: 'GET_SESSION',
            data: { salesforceHost },
          });
          console.log('sessionInfo', sessionInfo);
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

  if (!salesforceHost || !selectedOrg?.uniqueId) {
    return <AppLoading />;
  }

  return children;
};

export default AppInitializer;
