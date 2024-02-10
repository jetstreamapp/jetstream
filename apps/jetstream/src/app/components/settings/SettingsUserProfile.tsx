import { css } from '@emotion/react';
import { UserProfileUiWithIdentities } from '@jetstream/types';
import { Form, FormRow, FormRowItem, Grid, Input, ReadOnlyFormItem } from '@jetstream/ui';
import { Fragment, FunctionComponent, useMemo } from 'react';

export interface SettingsUserProfileProps {
  fullUserProfile: UserProfileUiWithIdentities;
  name: string;
  editMode: boolean;
  onEditMode: (value: true) => void;
  onChange: (value: { name: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const SettingsUserProfile: FunctionComponent<SettingsUserProfileProps> = ({
  fullUserProfile,
  name,
  editMode,
  onEditMode,
  onChange,
  onSave,
  onCancel,
}) => {
  const invalidName = !name || name.length > 255;

  const blockNameEdit = useMemo(
    () => fullUserProfile.identities.some((identity) => identity.provider !== 'auth0'),
    [fullUserProfile.identities]
  );

  return (
    <Fragment>
      <Grid className="slds-m-top_large" verticalAlign="center">
        <div className="slds-avatar slds-avatar_circle slds-avatar_large">
          <img alt={fullUserProfile.name} src={fullUserProfile.picture} title="Avatar" />
        </div>
        {/* TODO: implement this sometime */}
        {/* <div>
          <button className="slds-button slds-button_neutral slds-m-left_small">Change picture</button>
        </div> */}
      </Grid>
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
                  className="slds-form-element_horizontal slds-is-editing"
                  label="Name"
                  hasError={invalidName}
                  errorMessage="Your name must be between 1 and 255 characters"
                >
                  <input
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
    </Fragment>
  );
};

export default SettingsUserProfile;
