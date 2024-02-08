import { Auth0ConnectionName, UserProfileAuth0Identity, UserProfileUiWithIdentities } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import SettingsIdentityCard from './SettingsIdentityCard';

export interface SettingsLinkedAccountsProps {
  fullUserProfile: UserProfileUiWithIdentities;
  onLink: (connection: Auth0ConnectionName) => void;
  onUnlink: (identity: UserProfileAuth0Identity) => void;
  onResendVerificationEmail: (identity: UserProfileAuth0Identity) => void;
}

export const SettingsLinkedAccounts: FunctionComponent<SettingsLinkedAccountsProps> = ({
  fullUserProfile,
  onLink,
  onUnlink,
  onResendVerificationEmail,
}) => {
  return (
    <Grid className="slds-m-top_small slds-m-bottom_large" vertical>
      <div className="slds-text-heading_small">Linked Accounts</div>
      <p>You can login to Jetstream using any of these accounts</p>
      <ul className="slds-has-dividers_around-space">
        {fullUserProfile.identities.map((identity, i) => (
          <SettingsIdentityCard
            key={identity.user_id}
            omitUnlink={i === 0}
            identity={identity}
            fallback={fullUserProfile}
            onUnlink={onUnlink}
            onResendVerificationEmail={onResendVerificationEmail}
          />
        ))}
      </ul>
      <div>
        <button className="slds-button slds-button_neutral slds-m-top_small" onClick={() => onLink('google-oauth2')}>
          Link Google Account
        </button>
        <button className="slds-button slds-button_neutral slds-m-top_small" onClick={() => onLink('salesforce')}>
          Link Salesforce Account
        </button>
      </div>
    </Grid>
  );
};

export default SettingsLinkedAccounts;
