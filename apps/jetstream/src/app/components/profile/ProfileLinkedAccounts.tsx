import { css } from '@emotion/react';
import { LoginConfigAbility } from '@jetstream/acl';
import type { LoginConfigurationUI, UserProfileIdentity, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useCsrfToken, useRollbar } from '@jetstream/shared/ui-utils';
import { fireToast, Grid } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent } from 'react';
import { ProfileIdentityCard } from './ProfileIdentityCard';
import { useLinkAccount } from './useLinkAccount';

export interface ProfileLinkedAccountsProps {
  fullUserProfile: UserProfileUiWithIdentities;
  loginConfiguration: LoginConfigurationUI | null;
  loginConfigAbility: LoginConfigAbility;
  onUserProfilesChange: (userProfile: UserProfileUiWithIdentities) => void;
}

const searchParams = new URLSearchParams({
  returnUrl: window.location.href,
  isAccountLink: 'true',
}).toString();

export const ProfileLinkedAccounts: FunctionComponent<ProfileLinkedAccountsProps> = ({
  fullUserProfile,
  loginConfiguration,
  loginConfigAbility,
  onUserProfilesChange,
}) => {
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const { unlinkAccount, providers } = useLinkAccount();
  const { csrfToken } = useCsrfToken();

  async function handleUnlinkAccount(identity: UserProfileIdentity) {
    try {
      const userProfile = await unlinkAccount(identity);
      onUserProfilesChange(userProfile);
      trackEvent(ANALYTICS_KEYS.settings_unlink_account, { provider: identity.provider, userId: identity.providerAccountId });
    } catch (ex) {
      fireToast({
        message: 'There was a problem unlinking your account. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error unlinking account', { stack: ex.stack, message: ex.message });
    }
  }

  const canLinkIdentity = loginConfigAbility.can('link', 'Identity');

  // If no linked identities and user cannot link identities, don't show the section
  if (fullUserProfile.identities.length === 0 && !canLinkIdentity) {
    return null;
  }

  return (
    <Grid className="slds-m-top_small" vertical>
      <h2 className="slds-text-heading_small">Linked Accounts</h2>
      <p>You can login to Jetstream using any of these accounts</p>
      <ul className="slds-has-dividers_around-space">
        {fullUserProfile.identities.map((identity, i) => (
          <ProfileIdentityCard
            key={identity.providerAccountId}
            omitUnlink={
              !canLinkIdentity ||
              loginConfigAbility.cannot('unlink', { type: 'Identity', provider: identity.provider }) ||
              (fullUserProfile.identities.length === 1 && !fullUserProfile.hasPasswordSet)
            }
            identity={identity}
            loginConfigAbility={loginConfigAbility}
            onUnlink={handleUnlinkAccount}
          />
        ))}
      </ul>
      {providers && csrfToken && canLinkIdentity && (
        <Grid wrap>
          {loginConfigAbility.can('link', { type: 'Identity', provider: 'google' }) && (
            <form
              className="w-100"
              css={css`
                max-width: 33rem;
              `}
              action={`${providers.google.signinUrl}?${searchParams}`}
              method="POST"
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="callbackUrl" value={providers.google.callbackUrl} />
              <button type="submit" className="slds-button slds-button_neutral slds-m-top_small slds-m-right_smal slds-button_stretch">
                <img
                  src="https://res.cloudinary.com/getjetstream/image/upload/v1693697889/public/google-login-icon_bzw1hi.svg"
                  alt="Google"
                  className="slds-m-right_x-small"
                  css={css`
                    width: 1.25rem;
                    height: 1.25rem;
                  `}
                />
                Link Google Account
              </button>
            </form>
          )}
          {loginConfigAbility.can('link', { type: 'Identity', provider: 'google' }) && (
            <form
              className="w-100"
              css={css`
                max-width: 33rem;
              `}
              action={`${providers.salesforce.signinUrl}?${searchParams}`}
              method="POST"
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="callbackUrl" value={providers.salesforce.callbackUrl} />
              <button type="submit" className="slds-button slds-button_neutral slds-m-top_small slds-button_stretch">
                <img
                  src="https://res.cloudinary.com/getjetstream/image/upload/v1724511801/salesforce-blue_qdptxw.svg"
                  alt="Salesforce"
                  className="slds-m-right_x-small"
                  css={css`
                    width: 1.25rem;
                    height: 1.25rem;
                  `}
                />
                Link Salesforce Account
              </button>
            </form>
          )}
        </Grid>
      )}
    </Grid>
  );
};
