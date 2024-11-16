import { Providers, UserProfileIdentity } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import { getAuthProviders, unlinkIdentityFromProfile } from '@jetstream/shared/data';
import { useCallback, useEffect, useState } from 'react';

export function useLinkAccount() {
  const [providers, setProviders] = useState<Providers>();
  const [loading, setLoading] = useState(false);

  const fetchAuthProviders = useCallback(async () => {
    try {
      setLoading(true);
      setProviders(await getAuthProviders());
    } catch (ex) {
      logger.warn('[FETCH AUTH PROVIDERS][ERROR]', ex);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthProviders();
  }, [fetchAuthProviders]);

  const unlinkAccount = useCallback(async (identity: UserProfileIdentity) => {
    try {
      setLoading(true);
      const fullUserProfile = await unlinkIdentityFromProfile({
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
      });
      setLoading(false);
      return fullUserProfile;
    } catch (ex) {
      logger.error('[UNLINK ACCOUNT][ERROR]', ex);
      setLoading(false);
      throw new Error(ex);
    }
  }, []);

  return { unlinkAccount, providers, loading };
}
