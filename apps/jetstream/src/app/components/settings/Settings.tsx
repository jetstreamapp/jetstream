import { useUser } from '@clerk/clerk-react';
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { TITLES } from '@jetstream/shared/constants';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { CheckboxToggle, fireToast, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import LoggerConfig from './LoggerConfig';
import SettingsItem from './SettingsItem';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SettingsProps {}

export const Settings: FunctionComponent<SettingsProps> = () => {
  const { user } = useUser();
  useTitle(TITLES.SETTINGS);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleFrontdoorLoginChange(skipFrontdoorLogin: boolean) {
    try {
      setLoading(true);
      user?.update({
        unsafeMetadata: {
          skipFrontdoorLogin,
        },
      });
    } catch (ex) {
      logger.warn('Error updating user', ex);
      fireToast({
        message: 'There was a problem updating your user. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error updating user', { stack: ex.stack, message: ex.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {loading && <Spinner />}
      <h1
        css={css`
          box-sizing: border-box;
          color: rgb(33, 33, 38);
          margin: 0px 0px 1rem;
          font-family: inherit;
          letter-spacing: normal;
          font-weight: 700;
          font-size: 1.0625rem;
          line-height: 1.41176;
        `}
      >
        Settings
      </h1>
      <SettingsItem>
        <CheckboxToggle
          id="frontdoor-toggle"
          checked={!!user?.unsafeMetadata?.skipFrontdoorLogin}
          label="Don't Auto-Login on Link Clicks"
          onChange={handleFrontdoorLoginChange}
        />
        <p>
          When enabled, Jetstream will not attempt to auto-login to Salesforce when you click a link in Jetstream. If you have issues with
          multi-factor authentication when clicking links, enable this.
        </p>
      </SettingsItem>
      <SettingsItem>
        <LoggerConfig />
      </SettingsItem>
    </>
  );
};

export default Settings;
