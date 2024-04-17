import { Auth0ConnectionName, LogToUserProfileIdentity, UserProfileUiWithIdentities } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import SettingsIdentityCard from './SettingsIdentityCard';

export interface SettingsLinkedAccountsProps {
  fullUserProfile: UserProfileUiWithIdentities;
  onLink: (connection: Auth0ConnectionName) => void;
  onUnlink: (identity: LogToUserProfileIdentity) => void;
  onResendVerificationEmail: (identity: LogToUserProfileIdentity) => void;
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
        {Object.keys(fullUserProfile.identities || {}).map((key, i) => (
          <SettingsIdentityCard
            key={key}
            type={key as keyof UserProfileUiWithIdentities['identities']}
            omitUnlink={i === 0}
            identity={fullUserProfile.identities![key]}
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
