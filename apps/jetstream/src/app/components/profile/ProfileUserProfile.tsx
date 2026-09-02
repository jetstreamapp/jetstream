import { css } from '@emotion/react';
import { LoginConfigAbility } from '@jetstream/acl';
import type { LoginConfigurationUI, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { Form, FormRow, FormRowItem, Input, ReadOnlyFormItem } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { ProfileUserEmail } from './ProfileUserEmail';
import { ProfileUserPassword } from './ProfileUserPassword';

export interface ProfileUserProfileProps {
  fullUserProfile: UserProfileUiWithIdentities;
  name: string;
  editMode: boolean;
  loginConfigAbility: LoginConfigAbility;
  loginConfiguration: LoginConfigurationUI | null;
  onEditMode: (value: true) => void;
  onChange: (value: { name: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  onSetPassword: (password: string) => Promise<void>;
  onResetPassword: () => Promise<void>;
  onRemovePassword: () => Promise<void>;
  onRequestEmailChange: (newEmail: string) => Promise<boolean>;
  onCancelEmailChange: () => Promise<void>;
}

export const ProfileUserProfile: FunctionComponent<ProfileUserProfileProps> = ({
  fullUserProfile,
  name,
  editMode,
  loginConfigAbility,
  loginConfiguration,
  onEditMode,
  onChange,
  onSave,
  onCancel,
  onSetPassword,
  onResetPassword,
  onRemovePassword,
  onRequestEmailChange,
  onCancelEmailChange,
}) => {
  const ability = useAtomValue(abilityState);
  const invalidName = !name || name.length > 255;

  const blockNameEdit = useMemo(
    () => fullUserProfile.identities.some((identity) => identity.isPrimary && identity.provider !== 'credentials'),
    [fullUserProfile.identities],
  );

  // Save and Cancel unmount with edit mode, which would drop keyboard focus to <body> — return it to
  // the Edit button that replaces them (polled briefly: the parent flips edit mode after its save resolves)
  const containerRef = useRef<HTMLDivElement>(null);
  function focusEditButton() {
    let attemptsRemaining = 10;
    const tryFocus = () => {
      const editButton = containerRef.current?.querySelector<HTMLElement>('button[title="Edit Name"]');
      if (editButton) {
        editButton.focus();
        return;
      }
      attemptsRemaining--;
      if (attemptsRemaining > 0) {
        window.setTimeout(tryFocus, 50);
      }
    };
    window.setTimeout(tryFocus);
  }

  return (
    <div
      ref={containerRef}
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
          <ProfileUserEmail
            fullUserProfile={fullUserProfile}
            loginConfigAbility={loginConfigAbility}
            loginConfiguration={loginConfiguration}
            onRequestEmailChange={onRequestEmailChange}
            onCancelEmailChange={onCancelEmailChange}
          />
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
            <button
              className="slds-button slds-button_brand"
              disabled={invalidName}
              onClick={() => {
                onSave();
                focusEditButton();
              }}
            >
              Save
            </button>
            <button
              className="slds-button slds-button_neutral"
              onClick={() => {
                onCancel();
                focusEditButton();
              }}
            >
              Cancel
            </button>
          </FormRow>
        )}
      </Form>
    </div>
  );
};
