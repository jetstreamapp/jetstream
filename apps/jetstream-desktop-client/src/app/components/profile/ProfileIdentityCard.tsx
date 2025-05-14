import { css } from '@emotion/react';
import { UserProfileIdentity } from '@jetstream/auth/types';
import { ConfirmationModalPromise } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';

function getProviderName(identity: UserProfileIdentity) {
  if (identity.type === 'credentials') {
    return 'Jetstream';
  }
  switch (identity.provider) {
    case 'google':
      return 'Google';
    case 'salesforce':
      return 'Salesforce';
    default:
      return identity.provider;
  }
}

export interface ProfileIdentityCardProps {
  identity: UserProfileIdentity;
  omitUnlink?: boolean;
  onUnlink: (identity: UserProfileIdentity) => void;
}

export const ProfileIdentityCard: FunctionComponent<ProfileIdentityCardProps> = ({ identity, omitUnlink, onUnlink }) => {
  const [providerName] = useState<string>(() => getProviderName(identity));

  const { name, email, picture } = identity;
  const username = identity.username !== email ? identity.username : undefined;

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
          </p>
          {username && username !== email && (
            <p className="slds-truncate" title={username}>
              {username}
            </p>
          )}
          <p className="slds-truncate" title={email}>
            {email}
          </p>
          {omitUnlink && (
            <p className="slds-text-color_weak slds-text-body_small">
              You must set a password before unlinking the remaining social identity
            </p>
          )}
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
