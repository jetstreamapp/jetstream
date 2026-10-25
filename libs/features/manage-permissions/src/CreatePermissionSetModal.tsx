import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getErrorMessage, multiWordObjectFilter } from '@jetstream/shared/utils';
import { ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import {
  Checkbox,
  ComboboxWithGroupedItems,
  ComboboxWithItems,
  Grid,
  Input,
  Modal,
  RadioButton,
  RadioGroup,
  SalesforceLogin,
  ScopedNotification,
  Spinner,
  Textarea,
  getProfileOrPermSetSetupUrl,
} from '@jetstream/ui';
import { ConfirmPageChange, useAnalytics } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FormEvent, FunctionComponent, useEffect, useMemo, useState } from 'react';
import {
  PermissionSetCreateResult,
  PermissionSetLicenseOption,
  createPermissionSet,
  fetchCloneSourceDetails,
  fetchPermissionSetLicenses,
  generatePermissionSetApiName,
  getCloneSourceGroups,
  isValidPermissionSetApiName,
} from './utils/permission-set-create-utils';

const NO_LICENSE_ID = '__none__';

/** Search the API Name and package as well as the label */
const cloneSourceFilterFn = (filter: string) => {
  const matchesFilter = multiWordObjectFilter<ListItem>(['label', 'secondaryLabel', 'tertiaryLabel'], filter);
  return (item: unknown) => matchesFilter(item as ListItem);
};

export type CreatePermissionSetStartFrom = 'blank' | 'clone';

export interface CreatePermissionSetModalProps {
  selectedOrg: SalesforceOrgUi;
  profiles: ListItem<string, PermissionSetWithProfileRecord>[];
  permissionSets: ListItem<string, PermissionSetNoProfileRecord>[];
  managedPermissionSets: ListItem<string, PermissionSetNoProfileRecord>[];
  initialStartFrom?: CreatePermissionSetStartFrom;
  /** Pre-selected profile or permission set to clone */
  initialCloneSourceId?: string | null;
  /** `createdPermissionSetId` is set when a permission set was created, even if some permissions failed to copy */
  onClose: (createdPermissionSetId?: string) => void;
}

export const CreatePermissionSetModal: FunctionComponent<CreatePermissionSetModalProps> = ({
  selectedOrg,
  profiles,
  permissionSets,
  managedPermissionSets,
  initialStartFrom = 'blank',
  initialCloneSourceId,
  onClose,
}) => {
  const { trackEvent } = useAnalytics();
  const { serverUrl } = useAtomValue(applicationCookieState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);

  const [startFrom, setStartFrom] = useState<CreatePermissionSetStartFrom>(initialStartFrom);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(initialCloneSourceId || null);
  const [label, setLabel] = useState('');
  /** The API Name follows the label until the user edits it */
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [licenseId, setLicenseId] = useState<string>(NO_LICENSE_ID);
  const [hasActivationRequired, setHasActivationRequired] = useState(false);

  const [licenses, setLicenses] = useState<PermissionSetLicenseOption[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(true);
  /** Clone source the license and session activation defaults were last read from */
  const [cloneSourceDetailsId, setCloneSourceDetailsId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PermissionSetCreateResult | null>(null);

  const cloneSourceGroups = useMemo(
    () => getCloneSourceGroups(profiles, permissionSets, managedPermissionSets),
    [profiles, permissionSets, managedPermissionSets],
  );

  const cloneSource = useMemo(
    () => (cloneSourceId ? cloneSourceGroups.flatMap(({ items }) => items).find(({ id }) => id === cloneSourceId) : undefined),
    [cloneSourceId, cloneSourceGroups],
  );
  const cloneSourceIsProfile = !!cloneSource && profiles.some(({ id }) => id === cloneSource.id);

  const licenseItems = useMemo((): ListItem[] => {
    return [
      { id: NO_LICENSE_ID, label: '--None--', value: NO_LICENSE_ID },
      ...licenses.map(({ id, label, type }) => ({
        id,
        label,
        value: id,
        secondaryLabel: type === 'UserLicense' ? 'User License' : 'Permission Set License',
        secondaryLabelOnNewLine: true,
      })),
    ];
  }, [licenses]);

  useEffect(() => {
    let isActive = true;
    fetchPermissionSetLicenses(selectedOrg)
      .then((results) => isActive && setLicenses(results))
      .catch(() => isActive && setLicenses([]))
      .finally(() => isActive && setLicensesLoading(false));
    return () => {
      isActive = false;
    };
  }, [selectedOrg]);

  // Default the license and session activation to match what is being cloned, the same as Salesforce's own clone
  useEffect(() => {
    if (startFrom !== 'clone' || !cloneSourceId) {
      return;
    }
    let isActive = true;
    fetchCloneSourceDetails(selectedOrg, cloneSourceId)
      .then((details) => {
        if (!isActive) {
          return;
        }
        setLicenseId(details.licenseId || NO_LICENSE_ID);
        setHasActivationRequired(details.hasActivationRequired);
      })
      .catch(() => {
        // Not required to clone - the user can still choose the license themselves
      })
      .finally(() => isActive && setCloneSourceDetailsId(cloneSourceId));
    return () => {
      isActive = false;
    };
  }, [selectedOrg, startFrom, cloneSourceId]);

  const name = nameOverride ?? generatePermissionSetApiName(label);
  const cloneSourceLoading = startFrom === 'clone' && !!cloneSourceId && cloneSourceDetailsId !== cloneSourceId;
  const nameIsValid = !name || isValidPermissionSetApiName(name);
  const canSave = !saving && !result && !!label.trim() && !!name && nameIsValid && (startFrom === 'blank' || !!cloneSourceId);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!canSave) {
      return;
    }
    const cloneFromId = startFrom === 'clone' ? cloneSourceId : null;
    try {
      setSaving(true);
      setErrorMessage(null);
      const createResult = await createPermissionSet(
        selectedOrg,
        {
          label: label.trim(),
          name,
          description: description.trim(),
          licenseId: licenseId === NO_LICENSE_ID ? null : licenseId,
          hasActivationRequired,
        },
        cloneFromId,
        setProgressMessage,
      );
      setResult(createResult);
      trackEvent(ANALYTICS_KEYS.permission_manager_permission_set_created, {
        cloned: !!cloneFromId,
        clonedFrom: cloneFromId ? (cloneSourceIsProfile ? 'Profile' : 'PermissionSet') : undefined,
        hasLicense: licenseId !== NO_LICENSE_ID,
        failedPermissions: createResult.cloneSteps.reduce((total, { failed }) => total + failed, 0),
      });
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
    } finally {
      setSaving(false);
      setProgressMessage(null);
    }
  }

  function handleClose() {
    if (!saving) {
      onClose(result?.id);
    }
  }

  const failedCloneSteps = result?.cloneSteps.filter(({ failed }) => failed > 0) || [];

  return (
    <>
      <ConfirmPageChange actionInProgress={saving} />
      <Modal
        testId="create-permission-set-modal"
        header={startFrom === 'clone' ? 'Clone Permission Set' : 'New Permission Set'}
        tagline={
          startFrom === 'clone'
            ? 'Copy every permission from a profile or permission set into a new permission set'
            : 'Create a new permission set'
        }
        size="md"
        closeOnEsc={!saving}
        closeOnBackdropClick={false}
        closeDisabled={saving}
        footer={
          <Grid align="end">
            <button className="slds-button slds-button_neutral" onClick={handleClose} disabled={saving}>
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button className="slds-button slds-button_brand" form="create-permission-set-form" type="submit" disabled={!canSave}>
                {startFrom === 'clone' ? 'Clone' : 'Create'}
              </button>
            )}
          </Grid>
        }
        onClose={handleClose}
      >
        <div
          className="slds-is-relative"
          css={css`
            min-height: 20rem;
          `}
        >
          {saving && <Spinner />}
          {progressMessage && (
            <p className="slds-text-align_center slds-text-color_weak slds-m-bottom_small" role="status">
              {progressMessage}…
            </p>
          )}
          {errorMessage && (
            <ScopedNotification theme="error" className="slds-m-bottom_small">
              {errorMessage}
            </ScopedNotification>
          )}
          {result ? (
            <CreatePermissionSetResult
              selectedOrg={selectedOrg}
              serverUrl={serverUrl}
              skipFrontDoorAuth={skipFrontDoorAuth}
              label={label}
              result={result}
              failedCloneSteps={failedCloneSteps}
            />
          ) : (
            <form id="create-permission-set-form" onSubmit={handleSubmit}>
              <RadioGroup label="Start From" isButtonGroup>
                <RadioButton
                  id="permission-set-start-from-blank"
                  name="permission-set-start-from"
                  label="Blank"
                  value="blank"
                  checked={startFrom === 'blank'}
                  disabled={saving}
                  onChange={() => setStartFrom('blank')}
                />
                <RadioButton
                  id="permission-set-start-from-clone"
                  name="permission-set-start-from"
                  label="Clone Existing"
                  value="clone"
                  checked={startFrom === 'clone'}
                  disabled={saving}
                  onChange={() => setStartFrom('clone')}
                />
              </RadioGroup>

              {startFrom === 'clone' && (
                <div className="slds-m-top_small">
                  <ComboboxWithGroupedItems
                    comboboxProps={{
                      label: 'Profile or Permission Set to Clone',
                      isRequired: true,
                      placeholder: 'Select a profile or permission set',
                      disabled: saving,
                      loading: cloneSourceLoading,
                      helpText: cloneSourceIsProfile
                        ? 'Profile-only settings like page layouts, record types, login hours and IP ranges are not part of permission sets and are not copied.'
                        : undefined,
                    }}
                    groups={cloneSourceGroups}
                    filterFn={cloneSourceFilterFn}
                    selectedItemId={cloneSourceId}
                    onSelected={(item) => setCloneSourceId(item.id)}
                  />
                </div>
              )}

              <Input id="permission-set-label" label="Label" isRequired className="slds-m-top_small">
                <input
                  id="permission-set-label"
                  className="slds-input"
                  value={label}
                  maxLength={80}
                  required
                  disabled={saving}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Input>

              <Input
                id="permission-set-name"
                label="API Name"
                isRequired
                className="slds-m-top_small"
                hasError={!nameIsValid}
                errorMessageId="permission-set-name-error"
                errorMessage="The API Name must begin with a letter, contain only letters, numbers and single underscores, and cannot end with an underscore."
              >
                <input
                  id="permission-set-name"
                  className="slds-input"
                  value={name}
                  maxLength={80}
                  required
                  disabled={saving}
                  aria-describedby={!nameIsValid ? 'permission-set-name-error' : undefined}
                  onChange={(event) => setNameOverride(event.target.value)}
                />
              </Input>

              <Textarea id="permission-set-description" label="Description" className="slds-m-top_small">
                <textarea
                  id="permission-set-description"
                  className="slds-textarea"
                  value={description}
                  rows={2}
                  maxLength={255}
                  disabled={saving}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Textarea>

              <div className="slds-m-top_small">
                <ComboboxWithItems
                  comboboxProps={{
                    label: 'License',
                    disabled: saving,
                    loading: licensesLoading,
                    helpText:
                      'A license limits who the permission set can be assigned to. Choose --None-- to assign it to users with any license.',
                  }}
                  items={licenseItems}
                  selectedItemId={licenseId}
                  onSelected={(item) => setLicenseId(item.id)}
                />
              </div>

              <Checkbox
                id="permission-set-session-activation"
                className="slds-m-top_small"
                label="Session Activation Required"
                labelHelp="Users must activate this permission set for a session, for example from a flow, before its permissions apply."
                checked={hasActivationRequired}
                disabled={saving}
                onChange={setHasActivationRequired}
              />
            </form>
          )}
        </div>
      </Modal>
    </>
  );
};

interface CreatePermissionSetResultProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  skipFrontDoorAuth: boolean;
  label: string;
  result: PermissionSetCreateResult;
  failedCloneSteps: PermissionSetCreateResult['cloneSteps'];
}

const CreatePermissionSetResult: FunctionComponent<CreatePermissionSetResultProps> = ({
  selectedOrg,
  serverUrl,
  skipFrontDoorAuth,
  label,
  result,
  failedCloneSteps,
}) => {
  return (
    <div data-testid="create-permission-set-result">
      <ScopedNotification theme={failedCloneSteps.length ? 'warning' : 'success'}>
        <p>
          <strong>{label}</strong> was created
          {failedCloneSteps.length ? ', but some permissions could not be copied.' : ' and selected.'}
        </p>
        <SalesforceLogin
          serverUrl={serverUrl}
          org={selectedOrg}
          returnUrl={getProfileOrPermSetSetupUrl('PermissionSet', result.id)}
          skipFrontDoorAuth={skipFrontDoorAuth}
        >
          View in Salesforce
        </SalesforceLogin>
      </ScopedNotification>

      {result.cloneSteps.length > 0 && (
        <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-m-top_small">
          <thead>
            <tr className="slds-line-height_reset">
              <th scope="col">Permissions</th>
              <th scope="col" className="slds-text-align_right">
                Copied
              </th>
              <th scope="col" className="slds-text-align_right">
                Failed
              </th>
            </tr>
          </thead>
          <tbody>
            {result.cloneSteps.map(({ key, label: stepLabel, total, failed }) => (
              <tr key={key}>
                <th scope="row" className="slds-cell-wrap">
                  {stepLabel}
                </th>
                <td className="slds-text-align_right">{formatNumber(total - failed)}</td>
                <td className={`slds-text-align_right${failed ? ' slds-text-color_error' : ''}`}>{formatNumber(failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {failedCloneSteps.length > 0 && (
        <div className="slds-m-top_medium">
          <h3 className="slds-text-heading_small slds-m-bottom_x-small">Permissions that were not copied</h3>
          <p className="slds-text-color_weak slds-m-bottom_x-small">
            These are usually permissions only a profile can have, or permissions the selected license does not include.
          </p>
          {failedCloneSteps.map(({ key, label: stepLabel, errors }) => (
            <details key={key} className="slds-m-bottom_x-small">
              <summary>{stepLabel}</summary>
              <ul className="slds-list_dotted slds-m-top_xx-small">
                {errors.map(({ message, count }) => (
                  <li key={message} className="slds-text-body_small">
                    {message}
                    {count > 1 && <span className="slds-text-color_weak"> ({formatNumber(count)} permissions)</span>}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatePermissionSetModal;
