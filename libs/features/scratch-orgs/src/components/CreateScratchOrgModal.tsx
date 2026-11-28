import { css } from '@emotion/react';
import {
  SCRATCH_ORG_DEFAULT_DURATION_DAYS,
  SCRATCH_ORG_EDITIONS,
  SCRATCH_ORG_MAX_DURATION_DAYS,
  SCRATCH_ORG_MIN_DURATION_DAYS,
  SCRATCH_ORG_RELEASES,
  ScratchOrgCreateRequestInput,
  ScratchOrgCreateRequestSchema,
} from '@jetstream/api-types';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { createScratchOrg } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { InputReadFileContent, SalesforceOrgUi } from '@jetstream/types';
import {
  Checkbox,
  FileSelector,
  Grid,
  GridCol,
  Input,
  Modal,
  NumberStepperInput,
  ScopedNotification,
  Section,
  Select,
  Spinner,
  Textarea,
} from '@jetstream/ui';
import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import { FormEvent, FunctionComponent, useId, useMemo, useState } from 'react';
import { z } from 'zod';
import { parseFeatures, parseScratchOrgDefinition } from '../scratch-org-definition.utils';
import { getScratchOrgSettingsProblems, hasScratchOrgSettings } from '../scratch-org-settings.utils';
import type { DevHubScratchOrgLimits, PendingScratchOrg, ScratchOrgObjectSettings, ScratchOrgSettings } from '../scratch-org.types';

/** Vertical rhythm between the rows of the form, the grid only spaces its columns */
const FORM_GRID_STYLES = css`
  row-gap: 0.75rem;
`;

/** Value of the release picklist that leaves the choice to Salesforce (the Dev Hub's own release) */
const DEFAULT_RELEASE = '';

export interface CreateScratchOrgModalProps {
  devHubOrg: SalesforceOrgUi;
  limits: DevHubScratchOrgLimits;
  /** Set when the member's access profile does not allow connecting orgs, the scratch org is then created but not connected */
  connectDeniedReason?: string;
  /** Set when the member's access profile does not allow deploying metadata, which is how settings reach the scratch org */
  settingsDeniedReason?: string;
  onClose: () => void;
  onCreated: (pendingScratchOrg: PendingScratchOrg) => void;
}

interface FormState {
  orgName: string;
  edition: string;
  durationDays: number;
  adminEmail: string;
  description: string;
  features: string;
  hasSampleData: boolean;
  release: string;
  country: string;
  language: string;
  username: string;
  namespace: string;
  sourceOrg: string;
  snapshot: string;
  /** JSON object with the optional `settings` and `objectSettings` of a definition file */
  settingsJson: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

function getInitialState(devHubOrg: SalesforceOrgUi): FormState {
  return {
    orgName: '',
    edition: 'Developer',
    durationDays: SCRATCH_ORG_DEFAULT_DURATION_DAYS,
    adminEmail: devHubOrg.email || '',
    description: '',
    features: '',
    hasSampleData: false,
    release: DEFAULT_RELEASE,
    country: '',
    language: '',
    username: '',
    namespace: '',
    sourceOrg: '',
    snapshot: '',
    settingsJson: '',
  };
}

function parseSettingsJson(settingsJson: string): {
  settings: ScratchOrgSettings | null;
  objectSettings: ScratchOrgObjectSettings | null;
  error: string | null;
} {
  if (!settingsJson.trim()) {
    return { settings: null, objectSettings: null, error: null };
  }
  try {
    const value: unknown = JSON.parse(settingsJson);
    if (!isPlainObject(value)) {
      throw new Error('Settings must be a JSON object');
    }
    const { settings, objectSettings, ...unknownKeys } = value as Record<string, unknown>;
    if (Object.keys(unknownKeys).length) {
      throw new Error(`Only "settings" and "objectSettings" are allowed here, found "${Object.keys(unknownKeys).join('", "')}"`);
    }
    if ((settings && !isPlainObject(settings)) || (objectSettings && !isPlainObject(objectSettings))) {
      throw new Error('"settings" and "objectSettings" must be JSON objects');
    }
    const parsedSettings = (settings as ScratchOrgSettings) ?? null;
    const parsedObjectSettings = (objectSettings as ScratchOrgObjectSettings) ?? null;
    const [problem] = getScratchOrgSettingsProblems(parsedSettings, parsedObjectSettings);
    if (problem) {
      throw new Error(problem);
    }
    return { settings: parsedSettings, objectSettings: parsedObjectSettings, error: null };
  } catch (ex) {
    return { settings: null, objectSettings: null, error: ex instanceof SyntaxError ? 'Settings are not valid JSON' : getErrorMessage(ex) };
  }
}

function toRequest(form: FormState): ScratchOrgCreateRequestInput {
  return {
    orgName: form.orgName,
    // An org shape or snapshot determines the edition
    edition: form.sourceOrg.trim() || form.snapshot.trim() ? undefined : form.edition,
    durationDays: form.durationDays,
    adminEmail: form.adminEmail.trim() || undefined,
    description: form.description,
    features: parseFeatures(form.features),
    hasSampleData: form.hasSampleData || undefined,
    release: SCRATCH_ORG_RELEASES.find((release) => release === form.release),
    country: form.country,
    language: form.language,
    username: form.username.trim() || undefined,
    namespace: form.namespace,
    sourceOrg: form.sourceOrg.trim() || undefined,
    snapshot: form.snapshot,
  };
}

export const CreateScratchOrgModal: FunctionComponent<CreateScratchOrgModalProps> = ({
  devHubOrg,
  limits,
  connectDeniedReason,
  settingsDeniedReason,
  onClose,
  onCreated,
}) => {
  const formId = useId();
  const [form, setForm] = useState<FormState>(() => getInitialState(devHubOrg));
  const [connect, setConnect] = useState(!connectDeniedReason);
  const [definitionFilename, setDefinitionFilename] = useState<string | null>(null);
  const [definitionWarnings, setDefinitionWarnings] = useState<string[]>([]);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedSettings = useMemo(() => parseSettingsJson(form.settingsJson), [form.settingsJson]);
  const hasSettings = hasScratchOrgSettings(parsedSettings.settings, parsedSettings.objectSettings);
  const canDeploySettings = connect && !settingsDeniedReason;
  const settingsIgnoredReason = !hasSettings
    ? null
    : (settingsDeniedReason ??
      (connect ? null : 'Settings are only deployed when the scratch org is connected to Jetstream, the settings below will be ignored.'));

  const { request, errors } = useMemo(() => {
    const result = ScratchOrgCreateRequestSchema.safeParse(toRequest(form));
    const fieldErrors: FormErrors = {};
    if (!result.success) {
      Object.entries(z.flattenError(result.error).fieldErrors).forEach(([field, messages]) => {
        fieldErrors[field as keyof FormState] = (messages as string[] | undefined)?.[0];
      });
    }
    if (parsedSettings.error) {
      fieldErrors.settingsJson = parsedSettings.error;
    }
    return { request: result.success ? toRequest(form) : null, errors: fieldErrors };
  }, [form, parsedSettings.error]);

  const isValid = !!request && !Object.keys(errors).length;
  const hasNoRemainingScratchOrgs = limits.active?.remaining === 0 || limits.daily?.remaining === 0;

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((priorForm) => ({ ...priorForm, [field]: value }));
  }

  function getError(field: keyof FormState) {
    return showErrors ? errors[field] : undefined;
  }

  function handleDefinitionFile({ filename, content }: InputReadFileContent) {
    setDefinitionWarnings([]);
    setDefinitionError(null);
    try {
      if (!isString(content)) {
        throw new Error('The definition file could not be read as text.');
      }
      const { request: definition, settings, objectSettings, warnings } = parseScratchOrgDefinition(content);
      setForm((priorForm) => ({
        ...priorForm,
        orgName: definition.orgName ?? priorForm.orgName,
        edition: definition.edition ?? priorForm.edition,
        adminEmail: isString(definition.adminEmail) ? definition.adminEmail : priorForm.adminEmail,
        description: definition.description ?? priorForm.description,
        features: definition.features ? definition.features.join(', ') : priorForm.features,
        hasSampleData: definition.hasSampleData ?? priorForm.hasSampleData,
        release: definition.release ?? priorForm.release,
        country: definition.country ?? priorForm.country,
        language: definition.language ?? priorForm.language,
        username: isString(definition.username) ? definition.username : priorForm.username,
        namespace: definition.namespace ?? priorForm.namespace,
        sourceOrg: definition.sourceOrg ?? priorForm.sourceOrg,
        snapshot: definition.snapshot ?? priorForm.snapshot,
        settingsJson: hasScratchOrgSettings(settings, objectSettings)
          ? JSON.stringify({ ...(settings ? { settings } : {}), ...(objectSettings ? { objectSettings } : {}) }, null, 2)
          : priorForm.settingsJson,
      }));
      setDefinitionFilename(filename);
      setDefinitionWarnings(warnings);
    } catch (ex) {
      setDefinitionFilename(null);
      setDefinitionError(getErrorMessage(ex));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!isValid || !request || saving) {
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const { id } = await createScratchOrg(devHubOrg, request);
      onCreated({
        scratchOrgInfoId: id,
        orgName: form.orgName.trim() || 'Company',
        connect,
        settings: canDeploySettings ? parsedSettings.settings : null,
        objectSettings: canDeploySettings ? parsedSettings.objectSettings : null,
      });
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
      setSaving(false);
    }
  }

  const isFromShapeOrSnapshot = !!form.sourceOrg.trim() || !!form.snapshot.trim();
  // Editions Salesforce adds later can still be used through a definition file
  const editions = SCRATCH_ORG_EDITIONS.some((edition) => edition === form.edition)
    ? SCRATCH_ORG_EDITIONS
    : [...SCRATCH_ORG_EDITIONS, form.edition];

  return (
    <Modal
      testId="create-scratch-org-modal"
      header="New Scratch Org"
      tagline={`Dev Hub: ${devHubOrg.label || devHubOrg.username}`}
      size="md"
      closeDisabled={saving}
      closeOnBackdropClick={false}
      footer={
        <>
          <button className="slds-button slds-button_neutral" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="slds-button slds-button_brand slds-is-relative" disabled={saving}>
            {saving && <Spinner size="small" />}
            Create Scratch Org
          </button>
        </>
      }
      onClose={onClose}
    >
      <form id={formId} noValidate onSubmit={handleSubmit}>
        {errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            {errorMessage}
          </ScopedNotification>
        )}
        {showErrors && !isValid && (
          // Some of the fields are in the collapsed advanced options, so the problems are listed here as well
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            <ul className="slds-list_dotted">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </ScopedNotification>
        )}
        {settingsIgnoredReason && (
          // Shown up here because the settings are in the collapsed advanced options
          <ScopedNotification theme="warning" className="slds-m-bottom_small">
            The settings of this definition will not be deployed. {settingsIgnoredReason}
          </ScopedNotification>
        )}
        {hasNoRemainingScratchOrgs && (
          <ScopedNotification theme="warning" className="slds-m-bottom_small">
            This Dev Hub has reached its {limits.active?.remaining === 0 ? 'active' : 'daily'} scratch org limit, Salesforce will most
            likely reject this request.
          </ScopedNotification>
        )}

        <FileSelector
          id={`${formId}-definition-file`}
          label="Scratch Org Definition File"
          labelHelp="Optional. Choose a project-scratch-def.json file to fill in this form, including the settings to deploy."
          buttonLabel="Choose File"
          filename={definitionFilename}
          accept={[INPUT_ACCEPT_FILETYPES.JSON]}
          userHelpText="Optional, e.g. config/project-scratch-def.json"
          hasError={!!definitionError}
          errorMessage={definitionError}
          disabled={saving}
          onReadFile={handleDefinitionFile}
        />
        {!!definitionWarnings.length && (
          <ScopedNotification theme="warning" className="slds-m-top_x-small">
            <ul className="slds-list_dotted">
              {definitionWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </ScopedNotification>
        )}

        <Grid gutters wrap className="slds-m-top_small" css={FORM_GRID_STYLES}>
          <GridCol size={12} sizeMedium={6}>
            <Input id={`${formId}-org-name`} label="Org Name" hasError={!!getError('orgName')} errorMessage={getError('orgName')}>
              <input
                id={`${formId}-org-name`}
                className="slds-input"
                value={form.orgName}
                placeholder="Company"
                maxLength={80}
                autoComplete="off"
                onChange={(event) => setField('orgName', event.target.value)}
              />
            </Input>
          </GridCol>
          <GridCol size={12} sizeMedium={6}>
            <Select
              id={`${formId}-edition`}
              label="Edition"
              isRequired={!isFromShapeOrSnapshot}
              hasError={!!getError('edition')}
              errorMessage={getError('edition')}
              helpText={isFromShapeOrSnapshot ? 'Determined by the org shape or snapshot' : undefined}
            >
              <select
                id={`${formId}-edition`}
                className="slds-select"
                value={form.edition}
                disabled={isFromShapeOrSnapshot}
                onChange={(event) => setField('edition', event.target.value)}
              >
                {editions.map((edition) => (
                  <option key={edition} value={edition}>
                    {edition}
                  </option>
                ))}
              </select>
            </Select>
          </GridCol>
          <GridCol size={12} sizeMedium={6}>
            <NumberStepperInput
              id={`${formId}-duration`}
              label="Duration (Days)"
              value={form.durationDays}
              min={SCRATCH_ORG_MIN_DURATION_DAYS}
              max={SCRATCH_ORG_MAX_DURATION_DAYS}
              isRequired
              hasError={!!getError('durationDays')}
              errorMessage={getError('durationDays')}
              helpText={`The scratch org is deleted after this many days (${SCRATCH_ORG_MIN_DURATION_DAYS}-${SCRATCH_ORG_MAX_DURATION_DAYS}).`}
              onChange={(value) => setField('durationDays', value)}
            />
          </GridCol>
          <GridCol size={12} sizeMedium={6}>
            <Select
              id={`${formId}-release`}
              label="Release"
              labelHelp="Preview and Previous are only available around a Salesforce release."
            >
              <select
                id={`${formId}-release`}
                className="slds-select"
                value={form.release}
                onChange={(event) => setField('release', event.target.value)}
              >
                <option value={DEFAULT_RELEASE}>Same as Dev Hub</option>
                {SCRATCH_ORG_RELEASES.map((release) => (
                  <option key={release} value={release}>
                    {release}
                  </option>
                ))}
              </select>
            </Select>
          </GridCol>
          <GridCol size={12}>
            <Input
              id={`${formId}-admin-email`}
              label="Admin Email"
              labelHelp="Email address of the scratch org's admin user. Defaults to the Dev Hub user's email."
              hasError={!!getError('adminEmail')}
              errorMessage={getError('adminEmail')}
            >
              <input
                id={`${formId}-admin-email`}
                className="slds-input"
                type="email"
                value={form.adminEmail}
                maxLength={255}
                autoComplete="off"
                onChange={(event) => setField('adminEmail', event.target.value)}
              />
            </Input>
          </GridCol>
          <GridCol size={12}>
            <Textarea
              id={`${formId}-features`}
              label="Features"
              labelHelp="Add-on features to enable, such as Communities, ServiceCloud or MultiCurrency. Separate features with a comma."
              hasError={!!getError('features')}
              errorMessage={getError('features')}
            >
              <textarea
                id={`${formId}-features`}
                className="slds-textarea"
                value={form.features}
                rows={2}
                placeholder="EnableSetPasswordInApi, Communities"
                onChange={(event) => setField('features', event.target.value)}
              />
            </Textarea>
          </GridCol>
          <GridCol size={12}>
            <Input
              id={`${formId}-description`}
              label="Description"
              hasError={!!getError('description')}
              errorMessage={getError('description')}
            >
              <input
                id={`${formId}-description`}
                className="slds-input"
                value={form.description}
                maxLength={2000}
                autoComplete="off"
                onChange={(event) => setField('description', event.target.value)}
              />
            </Input>
          </GridCol>
          <GridCol size={12} className="slds-m-top_small">
            <Checkbox
              id={`${formId}-connect`}
              label="Connect to Jetstream when it is ready"
              helpText={
                connectDeniedReason ??
                'No password needed. Keep this page open until the scratch org is ready, which usually takes a minute or two.'
              }
              checked={connect}
              disabled={!!connectDeniedReason}
              onChange={setConnect}
            />
            <Checkbox
              id={`${formId}-sample-data`}
              className="slds-m-top_x-small"
              label="Include sample data"
              checked={form.hasSampleData}
              onChange={(value) => setField('hasSampleData', value)}
            />
          </GridCol>
        </Grid>

        <Section id={`${formId}-advanced`} label="Advanced Options" initialExpanded={false} className="slds-m-top_medium">
          <Grid gutters wrap css={FORM_GRID_STYLES}>
            <GridCol size={12} sizeMedium={6}>
              <Input
                id={`${formId}-username`}
                label="Username"
                labelHelp="Username of the admin user. Salesforce generates one when this is blank."
                hasError={!!getError('username')}
                errorMessage={getError('username')}
              >
                <input
                  id={`${formId}-username`}
                  className="slds-input"
                  value={form.username}
                  maxLength={80}
                  autoComplete="off"
                  onChange={(event) => setField('username', event.target.value)}
                />
              </Input>
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <Input
                id={`${formId}-namespace`}
                label="Namespace"
                labelHelp="A namespace that is linked to this Dev Hub."
                hasError={!!getError('namespace')}
                errorMessage={getError('namespace')}
              >
                <input
                  id={`${formId}-namespace`}
                  className="slds-input"
                  value={form.namespace}
                  maxLength={15}
                  autoComplete="off"
                  onChange={(event) => setField('namespace', event.target.value)}
                />
              </Input>
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <Input
                id={`${formId}-country`}
                label="Country"
                labelHelp="Two character ISO country code, e.g. US. Defaults to the Dev Hub's country."
                hasError={!!getError('country')}
                errorMessage={getError('country')}
              >
                <input
                  id={`${formId}-country`}
                  className="slds-input"
                  value={form.country}
                  maxLength={2}
                  autoComplete="off"
                  onChange={(event) => setField('country', event.target.value.toUpperCase())}
                />
              </Input>
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <Input
                id={`${formId}-language`}
                label="Language"
                labelHelp="Language code, e.g. en_US. Defaults to the Dev Hub's language."
                hasError={!!getError('language')}
                errorMessage={getError('language')}
              >
                <input
                  id={`${formId}-language`}
                  className="slds-input"
                  value={form.language}
                  maxLength={10}
                  autoComplete="off"
                  onChange={(event) => setField('language', event.target.value)}
                />
              </Input>
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <Input
                id={`${formId}-source-org`}
                label="Org Shape Source Org Id"
                labelHelp="Create the scratch org from the org shape of this org (15 or 18 character org id)."
                hasError={!!getError('sourceOrg')}
                errorMessage={getError('sourceOrg')}
              >
                <input
                  id={`${formId}-source-org`}
                  className="slds-input"
                  value={form.sourceOrg}
                  maxLength={18}
                  autoComplete="off"
                  placeholder="00D..."
                  onChange={(event) => setField('sourceOrg', event.target.value)}
                />
              </Input>
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <Input
                id={`${formId}-snapshot`}
                label="Snapshot"
                labelHelp="Create the scratch org from a scratch org snapshot with this name."
                hasError={!!getError('snapshot')}
                errorMessage={getError('snapshot')}
              >
                <input
                  id={`${formId}-snapshot`}
                  className="slds-input"
                  value={form.snapshot}
                  maxLength={255}
                  autoComplete="off"
                  onChange={(event) => setField('snapshot', event.target.value)}
                />
              </Input>
            </GridCol>
            <GridCol size={12}>
              <Textarea
                id={`${formId}-settings`}
                label="Settings (JSON)"
                labelHelp={`The "settings" and "objectSettings" of a scratch org definition file. They are deployed to the scratch org after it is connected.`}
                hasError={!!getError('settingsJson')}
                errorMessage={getError('settingsJson')}
              >
                <textarea
                  id={`${formId}-settings`}
                  className="slds-textarea slds-text-font_monospace"
                  value={form.settingsJson}
                  rows={8}
                  spellCheck={false}
                  placeholder={'{\n  "settings": {\n    "lightningExperienceSettings": { "enableS1DesktopEnabled": true }\n  }\n}'}
                  onChange={(event) => setField('settingsJson', event.target.value)}
                />
              </Textarea>
            </GridCol>
          </Grid>
        </Section>
      </form>
    </Modal>
  );
};

export default CreateScratchOrgModal;
