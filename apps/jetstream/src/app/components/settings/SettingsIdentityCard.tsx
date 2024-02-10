import { css } from '@emotion/react';
import { Maybe, UserProfileAuth0Identity, UserProfileUiWithIdentities } from '@jetstream/types';
import { Badge, ConfirmationModalPromise } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';

function getProviderName(identity: UserProfileAuth0Identity) {
  if (!identity.isSocial) {
    return 'Jetstream';
  }
  switch (identity.connection) {
    case 'google-oauth2':
      return 'Google';
    case 'salesforce':
      return 'Salesforce';
    case 'github':
      return 'GitHub';
    default:
      return identity.connection;
  }
}

function getUsername(identity: UserProfileAuth0Identity, fallback: UserProfileUiWithIdentities) {
  if (!identity.isSocial) {
    return null;
  }
  // The first profile has root-level properties set and does not have profileData property set
  switch (identity.connection) {
    case 'salesforce':
      if (!identity.profileData) {
        return fallback.username;
      }
      return identity.profileData.username;
    case 'github':
      if (!identity.profileData) {
        return fallback.nickname;
      }
      return identity.profileData.nickname;
    default:
      return null;
  }
}

export interface SettingsIdentityCardProps {
  identity: UserProfileAuth0Identity;
  fallback: UserProfileUiWithIdentities;
  omitUnlink?: boolean;
  onUnlink: (identity: UserProfileAuth0Identity) => void;
  onResendVerificationEmail: (identity: UserProfileAuth0Identity) => void;
}

export const SettingsIdentityCard: FunctionComponent<SettingsIdentityCardProps> = ({
  identity,
  fallback,
  omitUnlink,
  onResendVerificationEmail,
  onUnlink,
}) => {
  const [providerName] = useState<string>(() => getProviderName(identity));
  const [username] = useState<Maybe<string>>(() => getUsername(identity, fallback));

  const { profileData, user_id } = identity;
  const name = profileData?.name || fallback.name;
  const email = profileData?.email || fallback.email;
  const picture = profileData?.picture || fallback.picture;
  const emailVerified = profileData?.email_verified || fallback.emailVerified;

  async function confirmUnlink() {
    if (
      await ConfirmationModalPromise({
        confirm: 'Unlink Account',
        content: (
          <div>
            <p>
              Are you sure you want to unlink{' '}
              <strong>
                {providerName} - {email}
              </strong>
              ?
            </p>
            <p>You will no longer be able to login with the linked account.</p>
          </div>
        ),
      })
    ) {
      onUnlink(identity);
    }
  }

  return (
    <li
      key={user_id}
      className="slds-item read-only"
      css={css`
        max-width: 33rem;
      `}
    >
      <article className="slds-tile slds-tile_board">
        <h3 className="slds-tile__title slds-truncate slds-text-heading_medium" title={providerName}>
          {providerName}
        </h3>
        <div className="slds-tile__detail">
          <p className="slds-truncate" title={name}>
            {name}
            {username && (
              <span className="slds-m-left_xx-small slds-truncate" title={`Username: ${username}`}>
                - {username}
              </span>
            )}
          </p>
          <p className="slds-truncate" title={email}>
            {email}
          </p>
          {!emailVerified && (
            <Fragment>
              <Badge type="warning">Unverified Email</Badge>
              <button className="slds-button" onClick={() => onResendVerificationEmail(identity)}>
                Resend
              </button>
            </Fragment>
          )}
          {omitUnlink && <p className="slds-text-color_weak slds-text-body_small">Your primary account cannot be unlinked</p>}
          {!omitUnlink && (
            <div>
              <button className="slds-button" onClick={confirmUnlink}>
                Unlink Account
              </button>
            </div>
          )}
          {picture && (
            <div
              css={css`
                position: absolute;
                bottom: 0.25rem;
                right: 0.25rem;
              `}
            >
              <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                <img alt="Avatar" src={picture} title="Avatar" />
              </span>
            </div>
          )}
        </div>
      </article>
    </li>
  );
};

export default SettingsIdentityCard;
