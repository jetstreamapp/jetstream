import { css } from '@emotion/react';
import { LoginConfigAbility } from '@jetstream/acl';
import type { UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { Form, FormRow, FormRowItem, Input, ReadOnlyFormItem } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ProfileUserPassword } from './ProfileUserPassword';

export interface ProfileUserProfileProps {
  fullUserProfile: UserProfileUiWithIdentities;
  name: string;
  editMode: boolean;
  loginConfigAbility: LoginConfigAbility;
  onEditMode: (value: true) => void;
  onChange: (value: { name: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  onSetPassword: (password: string) => Promise<void>;
  onResetPassword: () => Promise<void>;
  onRemovePassword: () => Promise<void>;
}

export const ProfileUserProfile: FunctionComponent<ProfileUserProfileProps> = ({
  fullUserProfile,
  name,
  editMode,
  loginConfigAbility,
  onEditMode,
  onChange,
  onSave,
  onCancel,
  onSetPassword,
  onResetPassword,
  onRemovePassword,
}) => {
  const ability = useAtomValue(abilityState);
  const invalidName = !name || name.length > 255;

  const blockNameEdit = useMemo(
    () => fullUserProfile.identities.some((identity) => identity.isPrimary && identity.provider !== 'credentials'),
    [fullUserProfile.identities],
  );

  return (
    <div
      className="slds-m-top_small slds-m-bottom_large"
      css={css`
        max-width: 33rem;
      `}
    >
      <Form>
        <FormRow>
          <FormRowItem>
            {!editMode && (
              <ReadOnlyFormItem label="Name" horizontal omitEdit={blockNameEdit} onEditMore={() => onEditMode(true)}>
                {fullUserProfile.name}
              </ReadOnlyFormItem>
            )}
            {editMode && (
              <Input
                id="name"
                className="slds-form-element_horizontal slds-is-editing"
                label="Name"
                hasError={invalidName}
                errorMessage="Your name must be between 1 and 255 characters"
              >
                <input
                  id="name"
                  className="slds-input"
                  value={name}
                  minLength={1}
                  maxLength={254}
                  onChange={(event) => onChange({ name: event.target.value })}
                />
              </Input>
            )}
          </FormRowItem>
          <FormRowItem>
            <ReadOnlyFormItem label="Email" horizontal omitEdit labelHelp="File a support ticket to change your email.">
              {fullUserProfile.email}
            </ReadOnlyFormItem>
          </FormRowItem>
          {loginConfigAbility.can('read', 'Password') && (
            <ProfileUserPassword
              fullUserProfile={fullUserProfile}
              loginConfigAbility={loginConfigAbility}
              onResetPassword={onResetPassword}
              onSetPassword={onSetPassword}
              onRemovePassword={onRemovePassword}
            />
          )}
          {fullUserProfile.teamMembership?.team && (
            <FormRowItem>
              <ReadOnlyFormItem label="Team" horizontal omitEdit>
                {ability.can('read', 'Team') ? (
                  <Link to="/teams" className="slds-button">
                    {fullUserProfile.teamMembership.team.name}
                  </Link>
                ) : (
                  fullUserProfile.teamMembership.team.name
                )}
              </ReadOnlyFormItem>
            </FormRowItem>
          )}
        </FormRow>
        {editMode && (
          <FormRow className="slds-align_absolute-center slds-m-top_medium">
            <button className="slds-button slds-button_brand" disabled={invalidName} onClick={onSave}>
              Save
            </button>
            <button className="slds-button slds-button_neutral" onClick={onCancel}>
              Cancel
            </button>
          </FormRow>
        )}
      </Form>
    </div>
  );
};
