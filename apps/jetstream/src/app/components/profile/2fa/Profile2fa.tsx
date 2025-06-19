import { css } from '@emotion/react';
import { LoginConfigurationUI, UserProfileAuthFactor } from '@jetstream/auth/types';
import { Card, ScopedNotification } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
import { Profile2faEmail } from './Profile2faEmail';
import { Profile2faOtp } from './Profile2faOtp';

export interface Profile2faProps {
  authFactors: UserProfileAuthFactor[];
  loginConfiguration: LoginConfigurationUI | null;
  onUpdate: (authFactors: UserProfileAuthFactor[]) => void;
}

export const Profile2fa: FunctionComponent<Profile2faProps> = ({ authFactors, loginConfiguration, onUpdate }) => {
  const factorsByType = useMemo(() => {
    return {
      // 'email': authFactors.filter((factor) => factor.type === 'email'), // TODO:
      otp: authFactors.find((factor) => factor.type === '2fa-otp'),
      otpEmail: authFactors.find((factor) => factor.type === '2fa-email'),
    };
  }, [authFactors]);

  const has2faEnabled = useMemo(() => {
    return authFactors.some(({ enabled }) => enabled);
  }, [authFactors]);

  const canEnable2faOtp = !loginConfiguration || loginConfiguration.allowedMfaMethods.otp;
  const canDisable2faOtp = !loginConfiguration || !loginConfiguration.requireMfa;

  const canEnable2faEmail = !loginConfiguration || loginConfiguration.allowedMfaMethods.email;
  const canDisable2faEmail = !loginConfiguration || !loginConfiguration.requireMfa;

  return (
    <Card
      bodyClassName={null}
      title="Two-factor Authentication"
      icon={{
        type: 'standard',
        icon: 'portal',
      }}
      nestedBorder
      css={css`
        max-width: 33rem;
      `}
    >
      {!has2faEnabled && (
        <ScopedNotification theme="warning" className="slds-m-around_medium">
          You don't have two-factor authentication enabled. Enable it to add an extra layer of security to your account.
        </ScopedNotification>
      )}
      <Profile2faOtp
        key={`otp-${factorsByType?.otp?.updatedAt}`}
        isConfigured={!!factorsByType.otp}
        isEnabled={!!factorsByType.otp?.enabled}
        canEnable={canEnable2faOtp}
        canDisabled={canDisable2faOtp}
        onUpdate={onUpdate}
      />
      <Profile2faEmail
        key={`otpEmail-${factorsByType?.otpEmail?.updatedAt}`}
        isEnabled={!!factorsByType.otpEmail?.enabled}
        canEnable={canEnable2faEmail}
        canDisabled={canDisable2faEmail}
        onUpdate={onUpdate}
      />
    </Card>
  );
};
