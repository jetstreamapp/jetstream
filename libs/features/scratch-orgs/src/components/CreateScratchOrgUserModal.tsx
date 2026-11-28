import { css } from '@emotion/react';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, fireToast, Grid, GridCol, Input, Modal, ScopedNotification, Select, Spinner } from '@jetstream/ui';
import { FormEvent, FunctionComponent, useEffect, useId, useState } from 'react';
import { createScratchOrgUser, fetchScratchOrgProfiles, setScratchOrgUserPassword } from '../scratch-org-data.utils';
import type { GeneratedCredentials, ScratchOrgProfileRecord } from '../scratch-org.types';
import { generatePassword } from '../scratch-org.utils';

/** Vertical rhythm between the rows of the form, the grid only spaces its columns */
const FORM_GRID_STYLES = css`
  row-gap: 0.75rem;
`;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PROFILE_NAME = 'Standard User';

export interface CreateScratchOrgUserModalProps {
  scratchOrg: SalesforceOrgUi;
  onClose: () => void;
  /** Called once the user exists, with its credentials when a password was generated */
  onCreated: (credentials: GeneratedCredentials | null) => void;
}

/** Usernames must be unique across all of Salesforce, so the suggestion is tied to this scratch org and the current time */
function getSuggestedUsername(scratchOrg: SalesforceOrgUi): string {
  const domain = scratchOrg.username.split('@')[1] || 'example.com';
  return `user.${Date.now()}@${domain}`;
}

export const CreateScratchOrgUserModal: FunctionComponent<CreateScratchOrgUserModalProps> = ({ scratchOrg, onClose, onCreated }) => {
  const formId = useId();
  const [profiles, setProfiles] = useState<ScratchOrgProfileRecord[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(scratchOrg.email || '');
  const [username, setUsername] = useState(() => getSuggestedUsername(scratchOrg));
  const [profileId, setProfileId] = useState('');
  const [shouldGeneratePassword, setShouldGeneratePassword] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    fetchScratchOrgProfiles(scratchOrg)
      .then((records) => {
        if (isActive) {
          setProfiles(records);
          setProfileId((records.find(({ Name }) => Name === DEFAULT_PROFILE_NAME) ?? records[0])?.Id ?? '');
        }
      })
      .catch((ex) => isActive && setErrorMessage(`Unable to load profiles. ${getErrorMessage(ex)}`))
      .finally(() => isActive && setLoadingProfiles(false));
    return () => {
      isActive = false;
    };
  }, [scratchOrg]);

  const emailError = email && !EMAIL_REGEX.test(email.trim()) ? 'Enter a valid email address' : null;
  const usernameError = username && !EMAIL_REGEX.test(username.trim()) ? 'A username must be in the format of an email address' : null;
  const isValid = !!lastName.trim() && !!email.trim() && !!username.trim() && !!profileId && !emailError && !usernameError;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValid || saving) {
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    let userId: string;
    try {
      userId = await createScratchOrgUser(scratchOrg, { firstName, lastName, email, username, profileId });
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
      setSaving(false);
      return;
    }
    if (!shouldGeneratePassword) {
      onCreated(null);
      return;
    }
    try {
      const password = generatePassword();
      await setScratchOrgUserPassword(scratchOrg, userId, password);
      onCreated({ username: username.trim().toLowerCase(), password, loginUrl: scratchOrg.instanceUrl });
    } catch (ex) {
      // The user exists at this point, so the modal closes and a password can be generated from the list of users
      fireToast({ type: 'warning', message: `The user was created, but a password could not be set. ${getErrorMessage(ex)}` });
      onCreated(null);
    }
  }

  return (
    <Modal
      header="New Scratch Org User"
      tagline={scratchOrg.orgName || scratchOrg.username}
      closeDisabled={saving}
      closeOnBackdropClick={false}
      footer={
        <>
          <button className="slds-button slds-button_neutral" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="slds-button slds-button_brand slds-is-relative" disabled={!isValid || saving}>
            {saving && <Spinner size="small" />}
            Create User
          </button>
        </>
      }
      onClose={onClose}
    >
      <form id={formId} className="slds-is-relative" onSubmit={handleSubmit}>
        {loadingProfiles && <Spinner />}
        {errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            {errorMessage}
          </ScopedNotification>
        )}
        <Grid gutters wrap css={FORM_GRID_STYLES}>
          <GridCol size={12} sizeMedium={6}>
            <Input id={`${formId}-first-name`} label="First Name">
              <input
                id={`${formId}-first-name`}
                className="slds-input"
                value={firstName}
                maxLength={40}
                autoComplete="off"
                onChange={(event) => setFirstName(event.target.value)}
              />
            </Input>
          </GridCol>
          <GridCol size={12} sizeMedium={6}>
            <Input id={`${formId}-last-name`} label="Last Name" isRequired>
              <input
                id={`${formId}-last-name`}
                className="slds-input"
                value={lastName}
                maxLength={80}
                required
                autoComplete="off"
                onChange={(event) => setLastName(event.target.value)}
              />
            </Input>
          </GridCol>
          <GridCol size={12}>
            <Input
              id={`${formId}-email`}
              label="Email"
              isRequired
              hasError={!!emailError}
              errorMessage={emailError}
              errorMessageId={`${formId}-email-error`}
            >
              <input
                id={`${formId}-email`}
                className="slds-input"
                type="email"
                value={email}
                maxLength={80}
                required
                autoComplete="off"
                aria-describedby={emailError ? `${formId}-email-error` : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Input>
          </GridCol>
          <GridCol size={12}>
            <Input
              id={`${formId}-username`}
              label="Username"
              isRequired
              hasError={!!usernameError}
              errorMessage={usernameError}
              errorMessageId={`${formId}-username-error`}
              labelHelp="Usernames must be unique across every Salesforce org, not just this one."
            >
              <input
                id={`${formId}-username`}
                className="slds-input"
                value={username}
                maxLength={80}
                required
                autoComplete="off"
                aria-describedby={usernameError ? `${formId}-username-error` : undefined}
                onChange={(event) => setUsername(event.target.value)}
              />
            </Input>
          </GridCol>
          <GridCol size={12}>
            <Select id={`${formId}-profile`} label="Profile" isRequired>
              <select
                id={`${formId}-profile`}
                className="slds-select"
                value={profileId}
                required
                disabled={loadingProfiles}
                onChange={(event) => setProfileId(event.target.value)}
              >
                {profiles.map(({ Id, Name, UserLicense }) => (
                  <option key={Id} value={Id}>
                    {Name}
                    {UserLicense?.Name ? ` (${UserLicense.Name})` : ''}
                  </option>
                ))}
              </select>
            </Select>
          </GridCol>
          <GridCol size={12} className="slds-m-top_small">
            <Checkbox
              id={`${formId}-generate-password`}
              label="Generate a password"
              helpText="The password is shown once after the user is created."
              checked={shouldGeneratePassword}
              onChange={setShouldGeneratePassword}
            />
          </GridCol>
        </Grid>
      </form>
    </Modal>
  );
};

export default CreateScratchOrgUserModal;
