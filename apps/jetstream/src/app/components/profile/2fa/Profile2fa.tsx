import { css } from '@emotion/react';
import { LoginConfigAbility } from '@jetstream/acl';
import { LoginConfigurationUI, UserProfileAuthFactor } from '@jetstream/auth/types';
import { Card, ScopedNotification } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
import { Profile2faEmail } from './Profile2faEmail';
import { Profile2faOtp } from './Profile2faOtp';

export interface Profile2faProps {
  authFactors: UserProfileAuthFactor[];
  loginConfiguration: LoginConfigurationUI | null;
  loginConfigAbility: LoginConfigAbility;
  onUpdate: (authFactors: UserProfileAuthFactor[]) => void;
}

export const Profile2fa: FunctionComponent<Profile2faProps> = ({ authFactors, loginConfiguration, loginConfigAbility, onUpdate }) => {
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

  const canEnable2faOtp = loginConfigAbility.can('update', { type: 'MFA', method: 'otp' });
  let canDisable2faOtp = loginConfigAbility.can('remove', { type: 'MFA', method: 'otp' });

  const canEnable2faEmail = loginConfigAbility.can('update', { type: 'MFA', method: 'email' });
  let canDisable2faEmail = loginConfigAbility.can('remove', { type: 'MFA', method: 'email' });

  // If MFA is required, the user can disable factors but must always have one remaining
  if (loginConfigAbility.cannot('remove_all', 'MFA')) {
    // if email is not allowed or email is not enabled, this is the final option and cannot be disabled
    if (!canEnable2faEmail || !factorsByType.otpEmail?.enabled) {
      canDisable2faOtp = false;
    }
    // if otp is not configured or not enabled, this is the final option and cannot be disabled
    if (!canEnable2faOtp || !factorsByType.otpEmail?.enabled) {
      canDisable2faEmail = false;
    }
  }

  return (
    <Card
      bodyClassName={null}
      title="Two-factor Authentication"
      icon={{ type: 'standard', icon: 'portal' }}
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
