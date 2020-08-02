import { useEffect, useState } from 'react';
import Rollbar from 'rollbar';
import { ProductionDevelopment, UserProfile } from '@jetstream/types';

// Ensure rollbar is only initialized and configured once no matter how often hook is used
let _rollbar: Rollbar;
let _rollbarIsConfigured = false;
function getRollbarInstance(accessToken: string, environment: ProductionDevelopment, userProfile?: UserProfile) {
  const rollbar =
    _rollbar ||
    new Rollbar({
      accessToken,
      captureUncaught: true,
      captureUnhandledRejections: true,
      environment,
    });
  if (!_rollbarIsConfigured && userProfile) {
    _rollbarIsConfigured = true;
    const { id, email, tenantId } = userProfile;
    rollbar.configure({
      payload: {
        person: {
          id,
          email,
          tenantId,
        },
      },
    });
  }
  _rollbar = rollbar;
  return rollbar;
}

export function useRollbar(accessToken: string, environment: ProductionDevelopment, userProfile?: UserProfile) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [rollbar] = useState(() => getRollbarInstance(accessToken, environment, userProfile));

  useEffect(() => {
    if (rollbar && userProfile && !isConfigured) {
      getRollbarInstance(accessToken, environment, userProfile);
      setIsConfigured(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollbar, userProfile]);

  return rollbar;
}
