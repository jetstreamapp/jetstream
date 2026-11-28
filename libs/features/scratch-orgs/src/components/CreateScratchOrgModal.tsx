import { css } from '@emotion/react';
import { SCRATCH_ORG_MAX_DURATION_DAYS, SCRATCH_ORG_MIN_DURATION_DAYS } from '@jetstream/api-types';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { createScratchOrg } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { InputReadFileContent, ListItem, SalesforceOrgUi } from '@jetstream/types';
import {
  Checkbox,
  ComboboxWithItems,
  FileSelector,
  Grid,
  GridCol,
  Input,
  Modal,
  NumberStepperInput,
  ScopedNotification,
  Section,
  Spinner,
  Textarea,
} from '@jetstream/ui';
import isString from 'lodash/isString';
import kebabCase from 'lodash/kebabCase';
import { FormEvent, FunctionComponent, useId, useMemo, useState } from 'react';
import {
  applyDefinitionToCreateScratchOrgForm,
  CreateScratchOrgFormState,
  getInitialCreateScratchOrgForm,
  isFromShapeOrSnapshot,
  validateCreateScratchOrgForm,
} from '../scratch-org-create-form.utils';
import { parseScratchOrgDefinition } from '../scratch-org-definition.utils';
import { hasScratchOrgSettings } from '../scratch-org-settings.utils';
import type { DevHubScratchOrgLimits, PendingScratchOrg } from '../scratch-org.types';
import { useScratchOrgInfoPicklists } from '../useScratchOrgInfoPicklists';
import { ScratchOrgFeaturesInput } from './ScratchOrgFeaturesInput';

/** Vertical rhythm between the rows of the form, the grid only spaces its columns */
const FORM_GRID_STYLES = css`
  row-gap: 0.75rem;
`;

/** List items need a non-empty id, so the option that leaves a choice to the Dev Hub gets one of its own */
const SAME_AS_DEV_HUB_ITEM_ID = 'default';
const SAME_AS_DEV_HUB_ITEM: ListItem = { id: SAME_AS_DEV_HUB_ITEM_ID, label: 'Same as Dev Hub', value: '' };

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

/** Fields of the form that are edited as plain text */
type TextFieldName = {
  [Field in keyof CreateScratchOrgFormState]: CreateScratchOrgFormState[Field] extends string ? Field : never;
}[keyof CreateScratchOrgFormState];

interface FormTextFieldProps {
  id: string;
  label: string;
  labelHelp?: string;
  value: string;
  error?: string;
  type?: string;
  maxLength: number;
  placeholder?: string;
  onChange: (value: string) => void;
}

const FormTextField: FunctionComponent<FormTextFieldProps> = ({
  id,
  label,
  labelHelp,
  value,
  error,
  type,
  maxLength,
  placeholder,
  onChange,
}) => (
  <Input id={id} label={label} labelHelp={labelHelp} hasError={!!error} errorMessage={error}>
    <input
      id={id}
      className="slds-input"
      type={type}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
    />
  </Input>
);

export const CreateScratchOrgModal: FunctionComponent<CreateScratchOrgModalProps> = ({
  devHubOrg,
  limits,
  connectDeniedReason,
  settingsDeniedReason,
  onClose,
  onCreated,
}) => {
  const formId = useId();
  const [form, setForm] = useState(() => getInitialCreateScratchOrgForm(devHubOrg));
  const [connect, setConnect] = useState(!connectDeniedReason);
  const [definitionFilename, setDefinitionFilename] = useState<string | null>(null);
  const [definitionWarnings, setDefinitionWarnings] = useState<string[]>([]);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { picklists, loading: loadingPicklists } = useScratchOrgInfoPicklists(devHubOrg);

  const { request, errors, settings, objectSettings } = useMemo(() => validateCreateScratchOrgForm(form), [form]);
  const hasSettings = hasScratchOrgSettings(settings, objectSettings);
  const canDeploySettings = connect && !settingsDeniedReason;
  const settingsIgnoredReason = !hasSettings
    ? null
    : (settingsDeniedReason ??
      (connect ? null : 'Settings are only deployed when the scratch org is connected to Jetstream, the settings below will be ignored.'));

  const hasNoRemainingScratchOrgs = limits.active?.remaining === 0 || limits.daily?.remaining === 0;

  function setField<K extends keyof CreateScratchOrgFormState>(field: K, value: CreateScratchOrgFormState[K]) {
    setForm((priorForm) => ({ ...priorForm, [field]: value }));
  }

  function getError(field: keyof CreateScratchOrgFormState) {
    return showErrors ? errors[field] : undefined;
  }

  /** What every text field has in common, `transform` adjusts what was typed before it is stored */
  function getTextFieldProps(field: TextFieldName, transform: (value: string) => string = (value) => value) {
    return {
      id: `${formId}-${kebabCase(field)}`,
      value: form[field],
      error: getError(field),
      onChange: (value: string) => setField(field, transform(value)),
    };
  }

  function handleDefinitionFile({ filename, content }: InputReadFileContent) {
    setDefinitionWarnings([]);
    setDefinitionError(null);
    try {
      if (!isString(content)) {
        throw new Error('The definition file could not be read as text.');
      }
      const { warnings, ...definition } = parseScratchOrgDefinition(content);
      setForm((priorForm) => applyDefinitionToCreateScratchOrgForm(priorForm, definition));
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
    if (!request || saving) {
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
        settings: canDeploySettings ? settings : null,
        objectSettings: canDeploySettings ? objectSettings : null,
      });
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
      setSaving(false);
    }
  }

  const fromShapeOrSnapshot = isFromShapeOrSnapshot(form);
  // The lists come from the Dev Hub. A value from a definition file that is not on a list stays selectable,
  // so that it is visible what will be sent and the Dev Hub is what accepts or rejects it.
  const editionListItems = useMemo((): ListItem[] => {
    const editions = picklists.editions.includes(form.edition) ? picklists.editions : [...picklists.editions, form.edition];
    return editions.map((edition) => ({ id: edition, label: edition, value: edition }));
  }, [picklists.editions, form.edition]);

  const releaseListItems = useMemo(
    (): ListItem[] => [SAME_AS_DEV_HUB_ITEM, ...picklists.releases.map((release) => ({ id: release, label: release, value: release }))],
    [picklists.releases],
  );
  const selectedReleaseItemId = releaseListItems.some(({ id }) => id === form.release) ? form.release : SAME_AS_DEV_HUB_ITEM_ID;

  const languageListItems = useMemo((): ListItem[] | null => {
    if (!picklists.languages) {
      return null;
    }
    const languages = picklists.languages.map(({ value, label }) => ({ id: value, label, secondaryLabel: value, value }));
    const hasSelectedLanguage = !form.language || languages.some(({ id }) => id === form.language);
    return [
      SAME_AS_DEV_HUB_ITEM,
      ...languages,
      ...(hasSelectedLanguage ? [] : [{ id: form.language, label: form.language, value: form.language }]),
    ];
  }, [picklists.languages, form.language]);

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
        {showErrors && !request && (
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
            <FormTextField {...getTextFieldProps('orgName')} label="Org Name" placeholder="Company" maxLength={80} />
          </GridCol>
          <GridCol size={12} sizeMedium={6}>
            <ComboboxWithItems
              comboboxProps={{
                label: 'Edition',
                isRequired: !fromShapeOrSnapshot,
                disabled: fromShapeOrSnapshot,
                hasError: !!getError('edition'),
                errorMessage: getError('edition'),
                helpText: fromShapeOrSnapshot ? 'Determined by the org shape or snapshot' : undefined,
                loading: loadingPicklists,
                itemLength: 10,
                usePortal: true,
              }}
              items={editionListItems}
              selectedItemId={form.edition}
              onSelected={(item) => setField('edition', item.value)}
            />
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
            <ComboboxWithItems
              comboboxProps={{
                label: 'Release',
                labelHelp: 'Preview and Previous are only available around a Salesforce release.',
                itemLength: 5,
                usePortal: true,
              }}
              items={releaseListItems}
              selectedItemId={selectedReleaseItemId}
              onSelected={(item) => setField('release', item.value)}
            />
          </GridCol>
          <GridCol size={12}>
            <FormTextField
              {...getTextFieldProps('adminEmail')}
              label="Admin Email"
              labelHelp="Email address of the scratch org's admin user. Defaults to the Dev Hub user's email."
              type="email"
              maxLength={255}
            />
          </GridCol>
          <GridCol size={12}>
            <ScratchOrgFeaturesInput
              id={`${formId}-features`}
              features={form.features}
              hasError={!!getError('features')}
              errorMessage={getError('features')}
              onChange={(features) => setField('features', features)}
            />
          </GridCol>
          <GridCol size={12}>
            <FormTextField {...getTextFieldProps('description')} label="Description" maxLength={2000} />
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
              <FormTextField
                {...getTextFieldProps('username')}
                label="Username"
                labelHelp="Username of the admin user. Salesforce generates one when this is blank."
                maxLength={80}
              />
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <FormTextField
                {...getTextFieldProps('namespace')}
                label="Namespace"
                labelHelp="A namespace that is linked to this Dev Hub."
                maxLength={15}
              />
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <FormTextField
                {...getTextFieldProps('country', (value) => value.toUpperCase())}
                label="Country"
                labelHelp="Two character ISO country code, e.g. US. Defaults to the Dev Hub's country."
                maxLength={2}
              />
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              {languageListItems ? (
                <ComboboxWithItems
                  comboboxProps={{
                    label: 'Language',
                    labelHelp: 'Default language of the scratch org.',
                    hasError: !!getError('language'),
                    errorMessage: getError('language'),
                    itemLength: 10,
                    usePortal: true,
                  }}
                  items={languageListItems}
                  selectedItemId={form.language || SAME_AS_DEV_HUB_ITEM_ID}
                  selectedItemLabelFn={({ label, secondaryLabel }) => (secondaryLabel ? `${label} (${secondaryLabel})` : label)}
                  onSelected={(item) => setField('language', item.value)}
                />
              ) : (
                <FormTextField
                  {...getTextFieldProps('language')}
                  label="Language"
                  labelHelp="Language code, e.g. en_US. Defaults to the Dev Hub's language."
                  maxLength={10}
                />
              )}
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <FormTextField
                {...getTextFieldProps('sourceOrg')}
                label="Org Shape Source Org Id"
                labelHelp="Create the scratch org from the org shape of this org (15 or 18 character org id)."
                placeholder="00D..."
                maxLength={18}
              />
            </GridCol>
            <GridCol size={12} sizeMedium={6}>
              <FormTextField
                {...getTextFieldProps('snapshot')}
                label="Snapshot"
                labelHelp="Create the scratch org from a scratch org snapshot with this name."
                maxLength={255}
              />
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
