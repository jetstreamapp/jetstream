import { useEffect, useState } from 'react';
import Rollbar from 'rollbar';
import { Environment, UserProfileUi } from '@jetstream/types';

const VERSION = process.env.GIT_VERSION;
console.log('[JETSTREAM VERSION]:', VERSION);

// Ensure rollbar is only initialized and configured once no matter how often hook is used
let _rollbar: Rollbar;
let _rollbarIsConfigured = false;
function getRollbarInstance(accessToken: string, environment: Environment, userProfile?: UserProfileUi) {
  if (!accessToken || !environment) {
    return _rollbar;
  }
  const rollbar =
    _rollbar ||
    new Rollbar({
      codeVersion: VERSION,
      accessToken,
      captureUncaught: true,
      captureUnhandledRejections: true,
      environment,
      autoInstrument: {
        // eslint-disable-next-line no-restricted-globals
        log: location.hostname !== 'localhost',
      },
      hostBlackList: ['localhost'],
    });
  if (!_rollbarIsConfigured && userProfile) {
    _rollbarIsConfigured = true;
    const { sub, email } = userProfile;
    rollbar.configure({
      code_version: VERSION,
      payload: {
        person: {
          id: sub,
          email,
        },
      },
    });
  }
  _rollbar = rollbar;
  return rollbar;
}

/**
 * Parameters are only required on initialization component
 * Anything else lower in the tree will be able to use without arguments
 *
 * @param accessToken
 * @param environment
 * @param userProfile
 */
export function useRollbar(accessToken?: string, environment?: Environment, userProfile?: UserProfileUi) {
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
