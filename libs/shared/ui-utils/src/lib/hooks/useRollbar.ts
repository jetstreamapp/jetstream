import { Environment, UserProfileUi } from '@jetstream/types';
import { logBuffer } from '@jetstream/shared/client-logger';
import { useState } from 'react';
import Rollbar from 'rollbar';
import { useNonInitialEffect } from './useNonInitialEffect';

const VERSION = process.env.GIT_VERSION;
console.log('[JETSTREAM VERSION]:', VERSION);

class RollbarConfig {
  private static instance: RollbarConfig;

  private accessToken: string;
  private environment: string;
  private userProfile: UserProfileUi;
  public rollbar: Rollbar;
  public rollbarIsConfigured: boolean;

  // init if not already initialized
  private init(options?: { accessToken?: string; environment?: Environment; userProfile?: UserProfileUi }) {
    options = options || {};
    this.accessToken = options.accessToken || this.accessToken;
    this.environment = options.environment || this.environment;
    this.userProfile = options.userProfile || this.userProfile;

    if (this.rollbarIsConfigured || !this.accessToken || !this.environment) {
      return;
    }
    this.rollbar =
      this.rollbar ||
      new Rollbar({
        codeVersion: VERSION,
        accessToken: this.accessToken,
        captureUncaught: true,
        captureUnhandledRejections: true,
        environment: this.environment,
        autoInstrument: {
          // eslint-disable-next-line no-restricted-globals
          log: location.hostname !== 'localhost',
        },
        hostBlackList: ['localhost'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSendCallback: (_isUncaught: boolean, _args: Rollbar.LogArgument[], payload: any) => {
          payload = payload || {};
          payload.recentLogs = logBuffer;
        },
      });
    this.rollbar.global({ itemsPerMinute: 10, maxItems: 20 });
    this.configure();
  }

  // when userProfile is provided, set configuration and flagged as configured
  private configure() {
    if (!this.rollbarIsConfigured && this.userProfile) {
      this.rollbarIsConfigured = true;
      const { sub, email } = this.userProfile;
      this.rollbar.configure({
        code_version: VERSION,
        payload: {
          person: {
            id: sub,
            email,
          },
        },
      });
    }
  }

  static getInstance(options?: { accessToken?: string; environment?: Environment; userProfile?: UserProfileUi }): RollbarConfig {
    if (!this.instance) {
      this.instance = new this();
    }
    this.instance.init(options);
    return this.instance;
  }
}

/**
 * Parameters are only required on initialization component
 * Anything else lower in the tree will be able to use without arguments
 *
 * @param accessToken
 * @param environment
 * @param userProfile
 */
export function useRollbar(options?: { accessToken?: string; environment?: Environment; userProfile?: UserProfileUi }): Rollbar {
  const [rollbarConfig, setRollbarConfig] = useState(() => RollbarConfig.getInstance(options));

  useNonInitialEffect(() => {
    setRollbarConfig(RollbarConfig.getInstance(options));
  }, [options]);

  return rollbarConfig.rollbar;
}
