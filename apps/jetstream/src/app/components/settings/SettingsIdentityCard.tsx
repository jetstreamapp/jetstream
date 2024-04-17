import { css } from '@emotion/react';
import { LogToUserProfile, LogToUserProfileIdentity, Maybe, UserProfileUiWithIdentities } from '@jetstream/types';
import { Badge, ConfirmationModalPromise } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';

function getUsername(
  type: keyof LogToUserProfile['identities'],
  identity: LogToUserProfileIdentity,
  fallback: UserProfileUiWithIdentities
) {
  // The first profile has root-level properties set and does not have profileData property set
  switch (type) {
    case 'salesforce':
      if (!identity.details) {
        return fallback.username;
      }
      return identity.details.email; // FIXME:
    case 'github':
      if (!identity.details) {
        return fallback.username;
      }
      return identity.details.email; // FIXME:
    default:
      return null;
  }
}

export interface SettingsIdentityCardProps {
  type: keyof LogToUserProfile['identities'];
  identity: LogToUserProfileIdentity;
  fallback: UserProfileUiWithIdentities;
  omitUnlink?: boolean;
  onUnlink: (identity: LogToUserProfileIdentity) => void;
  onResendVerificationEmail: (identity: LogToUserProfileIdentity) => void;
}

export const SettingsIdentityCard: FunctionComponent<SettingsIdentityCardProps> = ({
  type,
  identity,
  fallback,
  omitUnlink,
  onResendVerificationEmail,
  onUnlink,
}) => {
  const [username] = useState<Maybe<string>>(() => getUsername(type, identity, fallback));

  const { details, userId } = identity;
  const name = details?.name || fallback.name;
  const email = details?.email || fallback.email;
  const picture = details?.rawData?.picture || fallback.picture;
  const emailVerified = details?.rawData?.email_verified || fallback.emailVerified;

  async function confirmUnlink() {
    if (
      await ConfirmationModalPromise({
        confirm: 'Unlink Account',
        content: (
          <div>
            <p>
              Are you sure you want to unlink{' '}
              <strong>
                {type} - {email}
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
      className="slds-item read-only"
      css={css`
        max-width: 33rem;
      `}
    >
      <article className="slds-tile slds-tile_board">
        <h3 className="slds-tile__title slds-truncate slds-text-heading_medium" title={type}>
          {type}
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
