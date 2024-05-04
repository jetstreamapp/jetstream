import { logger } from '@jetstream/shared/client-logger';
import { unlinkIdentityFromProfile } from '@jetstream/shared/data';
import { Auth0ConnectionName, Maybe, UserProfileAuth0Identity } from '@jetstream/types';
import { applicationCookieState } from '@jetstream/ui-core';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

let windowRef: Maybe<Window>;
let addOrgCallbackFn: () => void;

function handleWindowEvent(event: MessageEvent) {
  try {
    if (addOrgCallbackFn) {
      addOrgCallbackFn();
    }
    if (windowRef) {
      windowRef.close();
      window.removeEventListener('message', handleWindowEvent);
    }
  } catch (ex) {
    // TODO: tell user there was a problem
  }
}

function linkAccountFn(options: { serverUrl: string; connection: Auth0ConnectionName }, callback: () => void) {
  const { serverUrl, connection } = options;
  addOrgCallbackFn = callback;
  window.removeEventListener('message', handleWindowEvent);
  const strWindowFeatures = 'toolbar=no, menubar=no, width=1025, height=700';
  const url = `${serverUrl}/oauth/identity/link?connection=${encodeURIComponent(connection)}`;

  windowRef = window.open(url, 'Link Jetstream Account', strWindowFeatures);
  window.addEventListener('message', handleWindowEvent, false);
}

export function useLinkAccount() {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [loading, setLoading] = useState(false);

  const linkAccount = useCallback(
    (connection: Auth0ConnectionName, callback: () => void) => {
      linkAccountFn({ serverUrl, connection }, callback);
    },
    [serverUrl]
  );

  const unlinkAccount = useCallback(async (identity: UserProfileAuth0Identity) => {
    try {
      setLoading(true);
      const fullUserProfile = await unlinkIdentityFromProfile({ provider: identity.provider, userId: identity.user_id });
      setLoading(false);
      return fullUserProfile;
    } catch (ex) {
      logger.error('[UNLINK ACCOUNT][ERROR]', ex);
      setLoading(false);
      throw new Error(ex);
    }
  }, []);

  return { linkAccount, unlinkAccount, loading };
}
