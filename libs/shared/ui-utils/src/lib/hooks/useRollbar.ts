import { Environment, UserProfileUi } from '@jetstream/types';
import { logBuffer, logger } from '@jetstream/shared/client-logger';
import { useState } from 'react';
import Rollbar from 'rollbar';
import { useNonInitialEffect } from './useNonInitialEffect';

const VERSION = process.env.GIT_VERSION;
const REPLACE_HOST_REGEX = /[a-zA-Z0-9._-]*?getjetstream.app/;

interface RollbarProperties {
  accessToken?: string;
  environment?: Environment;
  userProfile?: UserProfileUi;
  // serverUrl?: string; // could not get proxy config working
}

const getRecentLogs = () => {
  try {
    return JSON.stringify(logBuffer);
  } catch (ex) {
    return `[ERROR GETTING RECENT LOGS: ${ex.message}]`;
  }
};

class RollbarConfig {
  private static instance: RollbarConfig;

  private accessToken: string;
  private environment: string;
  private userProfile: UserProfileUi;
  // private serverUrl: string;
  public rollbar: Rollbar;
  public rollbarIsConfigured: boolean;

  // init if not already initialized
  private init(options?: RollbarProperties) {
    options = options || {};
    this.accessToken = options.accessToken || this.accessToken;
    this.environment = options.environment || this.environment;
    this.userProfile = options.userProfile || this.userProfile;
    // this.serverUrl = options.serverUrl || this.serverUrl;

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
        // Unable to get proxy config working
        // endpoint: this.serverUrl ? `${this.serverUrl}/rollbar` : 'https://api.rollbar.com/api/1/item',
        autoInstrument: {
          // eslint-disable-next-line no-restricted-globals
          log: location.hostname !== 'localhost',
        },
        hostBlockList: ['localhost'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSendCallback: (_isUncaught: boolean, _args: Rollbar.LogArgument[], payload: any) => {
          payload = payload || {};
          payload.recentLogs = getRecentLogs();
        },
        // https://docs.rollbar.com/docs/source-maps#using-source-maps-on-many-domains
        transform: (payload: any) => {
          const trace = payload.body.trace;
          if (trace?.frames) {
            for (let i = 0; i < trace.frames.length; i++) {
              const filename = trace.frames[i].filename;
              if (filename) {
                // Use dynamichost so that sourcemaps only need to be uploaded once and can be shared across all environments
                trace.frames[i].filename = trace.frames[i].filename.replace(REPLACE_HOST_REGEX, 'dynamichost');
              }
            }
          }
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

  static getInstance(options?: RollbarProperties): RollbarConfig {
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
export function useRollbar(options?: RollbarProperties): Rollbar {
  const [rollbarConfig, setRollbarConfig] = useState(() => RollbarConfig.getInstance(options));

  useNonInitialEffect(() => {
    setRollbarConfig(RollbarConfig.getInstance(options));
  }, [options]);

  return rollbarConfig.rollbar;
}

// This should be used outside of a component (e.x. utility function)
export function logErrorToRollbar(message: string, data?: any) {
  try {
    if (RollbarConfig.getInstance().rollbarIsConfigured) {
      RollbarConfig.getInstance().rollbar.error(message, data);
    }
  } catch (ex) {
    // could not report to rollbar
    logger.log('[ROLLBAR] Error logging to rollbar', ex);
  }
}
