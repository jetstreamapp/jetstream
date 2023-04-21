import { logBuffer, logger } from '@jetstream/shared/client-logger';
import { NOOP } from '@jetstream/shared/utils';
import { Environment, UserProfileUi } from '@jetstream/types';
import isBoolean from 'lodash/isBoolean';
import { useState } from 'react';
import Rollbar, { LogArgument } from 'rollbar';
import { useNonInitialEffect } from './useNonInitialEffect';

const REPLACE_HOST_REGEX = /[a-zA-Z0-9._-]*?getjetstream.app/;

interface RollbarProperties {
  accessToken?: string;
  environment?: Environment;
  userProfile?: UserProfileUi;
  version?: string;
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
  private version: string;
  public rollbar: Rollbar;
  public rollbarIsConfigured: boolean;
  public optOut = false;

  // init if not already initialized
  private init(options?: RollbarProperties) {
    options = options || {};
    this.accessToken = options.accessToken || this.accessToken;
    this.environment = options.environment || this.environment;
    this.userProfile = options.userProfile || this.userProfile;
    this.version = options.version || this.version;

    if (this.rollbarIsConfigured || !this.accessToken || !this.environment) {
      return;
    }
    this.rollbar =
      this.rollbar ||
      new Rollbar({
        enabled: !this.optOut,
        codeVersion: this.version,
        code_version: this.version,
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
        payload: {
          server: {
            root: 'webpack:///./',
          },
          client: {
            javascript: {
              source_map_enabled: true,
              environment: this.environment,
              code_version: this.version,
            },
          },
        },
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
        enabled: !this.optOut,
        codeVersion: this.version,
        code_version: this.version,
        checkIgnore: (isUncaught: boolean, args: LogArgument[], item: any) => {
          try {
            if (
              item?.body?.trace?.exception?.description === 'Canceled' ||
              item?.body?.trace?.exception?.class === 'ChunkLoadError' ||
              item?.body?.trace?.exception?.class === '(unknown)' ||
              item?.body?.trace?.frames?.[0]?.filename?.endsWith('/js/monaco/vs/loader.js')
            ) {
              return true;
            }
            return false;
          } catch (ex) {
            return false;
          }
        },
        payload: {
          server: {
            root: 'webpack:///./',
          },
          client: {
            javascript: {
              source_map_enabled: true,
              environment: this.environment,
              code_version: this.version,
            },
          },
          person: {
            id: sub,
            email,
          },
        },
      });
    }
  }

  static getInstance(options?: RollbarProperties, optOut?: boolean): RollbarConfig {
    if (!this.instance) {
      this.instance = new this();
    }
    if (isBoolean(optOut)) {
      this.instance.optOut = optOut;
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
export function useRollbar(options?: RollbarProperties, optOut?: boolean): Rollbar {
  const [rollbarConfig, setRollbarConfig] = useState(() => RollbarConfig.getInstance(options, optOut));

  useNonInitialEffect(() => {
    setRollbarConfig(RollbarConfig.getInstance(options, optOut));
  }, [options, optOut]);

  return (
    rollbarConfig.rollbar || {
      error: NOOP,
    }
  );
}

// This should be used outside of a component (e.x. utility function)
export function logErrorToRollbar(
  message: string,
  data?: any,
  severity: 'log' | 'debug' | 'info' | 'warn' | 'error' | 'critical' = 'error'
) {
  try {
    if (RollbarConfig.getInstance().rollbarIsConfigured) {
      RollbarConfig.getInstance().rollbar[severity](message, data);
    }
  } catch (ex) {
    // could not report to rollbar
    logger.log('[ROLLBAR] Error logging to rollbar', ex);
  }
}
