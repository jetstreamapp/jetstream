import { css } from '@emotion/react';
import { getPicklistValuesForRecordAndRecordType, removeUnavailablePicklistValues, UiRecordForm } from '@jetstream/record-form';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { describeSObject, sobjectOperation } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { filterCreateSobjects, isErrorResponse, tracker, useNonInitialEffect, usePrimaryActionShortcut } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import {
  DescribeGlobalSObjectResult,
  DescribeSObjectResult,
  ListItem,
  PicklistFieldValues,
  RecordResult,
  SalesforceRecord,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ComboboxWithItems,
  ConnectedSobjectList,
  fireToast,
  getAriaKeyshortcuts,
  getModifierKey,
  KeyboardShortcut,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
  Tooltip,
  useAnnouncer,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, useAmplitude } from '@jetstream/ui-core';
import { EditFromErrors, handleEditFormErrorResponse, transformEditForm, validateEditForm } from '@jetstream/ui-core/shared';
import { applicationCookieState, selectedOrgState } from '@jetstream/ui/app-state';
import { recordSingleRecordAction, SingleRecordActionContext } from '@jetstream/ui/data-history';
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { LastCreatedRecord } from './LastCreatedRecord';

const HEIGHT_BUFFER = 160;

export const CreateRecords = () => {
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();

  const { defaultApiVersion } = useAtomValue(applicationCookieState);
  const selectedOrg = useAtomValue(selectedOrgState);
  const [formKey, setFormKey] = useState(0);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [sobjects, setSobjects] = useState<DescribeGlobalSObjectResult[] | null>(null);
  const [selectedObject, setSelectedObject] = useState<DescribeGlobalSObjectResult | null>(null);
  const [recordTypes, setRecordTypes] = useState<ListItem[]>();
  const [selectedRecordTypeId, setSelectedRecordTypeId] = useState<string>();
  const [sobjectMetadata, setSobjectMetadata] = useState<DescribeSObjectResult>();
  const [picklistValues, setPicklistValues] = useState<PicklistFieldValues>();
  const [initialRecord, setInitialRecord] = useState<SalesforceRecord>({});
  const [formErrors, setFormErrors] = useState<EditFromErrors>({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
  const [modifiedRecord, setModifiedRecord] = useState<SalesforceRecord>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [createdRecord, setCreatedRecord] = useState<{ id: string; sobject: string; record: any } | null>(null);

  // Announce async outcomes (form loaded, record created, save failed) to screen readers
  const { announce, announcer } = useAnnouncer();
  // Ref (not state) so back-to-back Cmd+Enter presses can't double-submit before React re-renders
  const saveInProgress = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // reset on org change
  useNonInitialEffect(() => {
    setSobjects(null);
    setSelectedObject(null);
    setSobjectMetadata(undefined);
    setPicklistValues(undefined);
    setRecordTypes(undefined);
    setSelectedRecordTypeId(undefined);
    setInitialRecord({});
    setModifiedRecord({});
    setCreatedRecord(null);
    setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
  }, [selectedOrg]);

  useNonInitialEffect(() => {
    if (selectedObject) {
      setSobjectMetadata(undefined);
      setPicklistValues(undefined);
      setRecordTypes(undefined);
      setSelectedRecordTypeId(undefined);
      setInitialRecord({});
      setModifiedRecord({});
      setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
      handleObjectSelection(selectedObject.name);
    }
  }, [selectedObject]);

  function handleClearForm() {
    setInitialRecord({});
    setModifiedRecord({});
    setFormKey((priorKey) => priorKey + 1);
    setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
    setCreatedRecord(null);
  }

  async function handleRecordChange(record: SalesforceRecord) {
    setModifiedRecord(record);
  }

  async function handleRecordTypeChange(recordTypeId: string) {
    const priorRecordTypeId = selectedRecordTypeId;
    setSelectedRecordTypeId(recordTypeId);
    setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });

    const updatedPicklistValues = await calculatePicklistValues({ recordTypeId, updateLoadingState: true });
    if (!isMounted.current) {
      return;
    }
    // Picklist values could not be obtained, the form still has the prior record type's values so the prior selection is restored
    if (!updatedPicklistValues) {
      setSelectedRecordTypeId(priorRecordTypeId);
      return;
    }

    // Everything the user already entered is retained, only picklist values that the new record type does not allow are removed
    const { record, fieldsWithClearedValues } = removeUnavailablePicklistValues(
      sobjectMetadata?.fields || [],
      updatedPicklistValues,
      modifiedRecord,
    );
    setModifiedRecord(record);
    setFormKey((priorKey) => priorKey + 1);

    if (fieldsWithClearedValues.length) {
      fireToast({
        type: 'info',
        message: `Some values were removed because they are not available for the selected record type: ${fieldsWithClearedValues
          .map(({ label }) => label)
          .join(', ')}`,
      });
    }
  }

  async function calculatePicklistValues({
    recordTypeId,
    updateLoadingState = false,
  }: { recordTypeId?: string; updateLoadingState?: boolean } = {}): Promise<PicklistFieldValues | undefined> {
    try {
      if (updateLoadingState) {
        setLoading(true);
      }

      if (!sobjectMetadata || !selectedObject) {
        setPicklistValues(undefined);
        return;
      }
      const picklistValues = await getPicklistValuesForRecordAndRecordType({
        org: selectedOrg,
        sobjectName: selectedObject.name,
        recordTypeId,
        sobjectMetadata,
        apiVersion: defaultApiVersion,
      });
      setPicklistValues(picklistValues);
      return picklistValues;
    } catch (ex) {
      if (isMounted.current) {
        logger.error('Error calculating record types', ex);
        fireToast({ message: 'Error getting picklist values for record type', type: 'error' });
        setLoading(false);
      }
    } finally {
      if (updateLoadingState) {
        setLoading(false);
      }
    }
  }

  async function handleObjectSelection(sobjectName: string) {
    try {
      setLoading(true);

      const sobjectMetadata = await describeSObject(selectedOrg, sobjectName);

      setSobjectMetadata(sobjectMetadata.data);
      if (sobjectMetadata.data.recordTypeInfos.length) {
        setSelectedRecordTypeId(sobjectMetadata.data.recordTypeInfos.find((item) => item.master)?.recordTypeId);
      }
      if (sobjectMetadata.data.recordTypeInfos.length > 1) {
        setRecordTypes(
          sobjectMetadata.data.recordTypeInfos.map((item) => ({
            id: item.recordTypeId,
            value: item.recordTypeId,
            label: item.name,
            secondaryLabel: item.developerName,
            secondaryLabelOnNewLine: true,
          })),
        );
      }

      await calculatePicklistValues();

      setInitialRecord({});
      announce(`${sobjectMetadata.data.label} record form loaded to the right of the object list and is ready to fill out.`);
    } catch (ex) {
      if (isMounted.current) {
        logger.error('Error fetching metadata', ex);
        tracker.error('Error fetching record metadata', ex);
        setFormErrors({
          hasErrors: true,
          fieldErrors: {},
          generalErrors: ['Oops. There was a problem loading the record information. Make sure the record id is valid.'],
        });
        announce('There was a problem loading the record information.');
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedObject || saveInProgress.current) {
      return;
    }
    const record = transformEditForm(sobjectMetadata?.fields || [], modifiedRecord);
    const currentFormErrors = validateEditForm(sobjectMetadata?.fields || [], record);

    if (currentFormErrors.hasErrors) {
      setFormErrors({ hasErrors: true, fieldErrors: currentFormErrors.fieldErrors, generalErrors: [] });
      const errorCount = Object.keys(currentFormErrors.fieldErrors).length;
      announce(`Record was not saved. ${errorCount} ${errorCount === 1 ? 'field has' : 'fields have'} errors.`);
      return;
    } else if (formErrors.hasErrors) {
      // reset state since there are no longer any errors
      setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
    }

    saveInProgress.current = true;
    setSaving(true);

    // Identity + request of the Data History entry, shared by the success and thrown-error paths below
    const historyEntry = {
      org: selectedOrg,
      source: 'create-record',
      operation: 'create',
      api: 'collections',
      sobjects: [selectedObject.name],
      request: record,
    } satisfies SingleRecordActionContext;

    try {
      const recordResponse: RecordResult = (await sobjectOperation(selectedOrg, selectedObject.name, 'create', { records: [record] }))[0];
      const isErrorResult = isErrorResponse(recordResponse);
      let retrievedRecord: SalesforceRecord | undefined;

      if (isMounted.current) {
        if (isErrorResult) {
          const saveErrors = handleEditFormErrorResponse(recordResponse);
          setFormErrors(saveErrors);
          const fieldErrorCount = Object.keys(saveErrors.fieldErrors).length;
          announce(
            [
              'Record was not saved.',
              ...saveErrors.generalErrors,
              fieldErrorCount ? `${fieldErrorCount} ${fieldErrorCount === 1 ? 'field has' : 'fields have'} errors.` : '',
            ]
              .filter(Boolean)
              .join(' '),
          );
        } else {
          // The record WAS created at this point — a failure re-fetching it for display must not fall
          // through to the outer catch (which reports the create itself as failed) or skip history capture.
          try {
            retrievedRecord = (await sobjectOperation(selectedOrg, selectedObject.name, 'retrieve', { ids: [recordResponse.id] }))[0];
            setCreatedRecord({ id: recordResponse.id, sobject: selectedObject.name, record: retrievedRecord });
            announce('Record created successfully.');
          } catch (ex) {
            logger.warn('Record was created but could not be re-fetched', ex);
            if (isMounted.current) {
              const createdButNotReloadedMessage = `Your record was created (${recordResponse.id}), but it could not be reloaded for display.`;
              setFormErrors({
                hasErrors: true,
                fieldErrors: {},
                generalErrors: [createdButNotReloadedMessage],
              });
              announce(createdButNotReloadedMessage);
            }
          }
        }
      }

      // Record the create to Data History (success OR error). Fire-and-forget + self-gating; the results
      // payload includes the re-fetched full record on success. Written as request.json/results.json like
      // every other capture, and rolled back all-or-nothing if any part of the capture fails.
      void recordSingleRecordAction({
        ...historyEntry,
        outcome: { succeeded: !isErrorResult, results: { result: recordResponse, record: retrievedRecord } },
      });

      trackEvent(ANALYTICS_KEYS.create_record_save, { success: true });
    } catch (ex) {
      if (isMounted.current) {
        const thrownErrorMessage = getErrorMessage(ex) || 'An unknown problem has occurred.';
        setFormErrors({ hasErrors: true, fieldErrors: {}, generalErrors: [thrownErrorMessage] });
        announce(`Record was not saved. ${thrownErrorMessage}`);
      }
      // A THROWN create (network error, expired session) is still recorded — the request may even
      // have applied server-side (e.g. a timeout). Graceful error results are captured above.
      void recordSingleRecordAction({
        ...historyEntry,
        outcome: { succeeded: false, results: { error: getErrorMessage(ex) }, errorMessage: getErrorMessage(ex) },
      });
      trackEvent(ANALYTICS_KEYS.create_record_save, { success: false });
    }
    saveInProgress.current = false;
    if (isMounted.current) {
      setSaving(false);
    }
  }

  const saveDisabled = !selectedObject || loading || saving;
  usePrimaryActionShortcut(handleSave, { disabled: saveDisabled });

  return (
    <Page key={selectedOrg.uniqueId} testId="manage-permissions-page">
      <RequireMetadataApiBanner />
      {announcer}
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'record_create' }}
            label={'Create New Record'}
            docsPath={APP_ROUTES.LOAD_CREATE_RECORD.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            {!!Object.keys(modifiedRecord).length && (
              <button
                className="slds-button slds-button_neutral slds-m-right_x-small"
                disabled={!selectedObject}
                onClick={() => handleClearForm()}
              >
                Clear
              </button>
            )}
            <Tooltip
              openDelay={500}
              content={
                <div className="slds-p-bottom_small">
                  <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                </div>
              }
            >
              {/* aria-disabled (not disabled) keeps the button focusable so keyboard users can reach
                  the shortcut tooltip, and preserves focus while a save is in flight */}
              <button
                className="slds-button slds-button_brand"
                aria-disabled={saveDisabled}
                aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'enter'])}
                onClick={() => {
                  if (!saveDisabled) {
                    handleSave();
                  }
                }}
              >
                Save
              </button>
            </Tooltip>
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-col_bump-left"
            css={css`
              min-height: 32px;
            `}
          >
            {!!createdRecord && <LastCreatedRecord selectedOrg={selectedOrg} recordId={createdRecord.id} />}
          </div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer bottomBuffer={10} className="slds-p-left_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        <Split
          sizes={[33, 66]}
          minSize={[300, 300]}
          gutterSize={selectedObject ? 15 : 0}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <ConnectedSobjectList
              selectedOrg={selectedOrg}
              sobjects={sobjects}
              selectedSObject={selectedObject}
              recentItemsEnabled
              recentItemsKey="sobject"
              filterFn={filterCreateSobjects}
              onSobjects={setSobjects}
              onSelectedSObject={setSelectedObject}
            />
          </div>

          <AutoFullHeightContainer bottomBuffer={25} className="slds-p-around_x-small slds-is-relative slds-scrollable_none">
            {(loading || saving) && <Spinner />}
            {Array.isArray(formErrors?.generalErrors) && !!formErrors.generalErrors.length && (
              <ScopedNotification theme="error" className="slds-m-bottom_x-small">
                <ul>
                  {formErrors.generalErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </ScopedNotification>
            )}
            {selectedObject &&
              sobjectMetadata?.fields && (
                // Landmark so screen reader users can jump straight to the form for the chosen object
                <section aria-label={`${selectedObject.label} record form`}>
                  {Array.isArray(recordTypes) && (
                    <div className="slds-p-horizontal_xx-small">
                      <ComboboxWithItems
                        comboboxProps={{
                          label: 'Record Type',
                          labelHelp: 'The Record Type controls which picklist values are available',
                          // Prevents overlapping picklist value requests from applying out of order
                          disabled: loading || saving,
                        }}
                        items={recordTypes}
                        selectedItemId={selectedRecordTypeId}
                        onSelected={(item) => handleRecordTypeChange(item.id)}
                      />
                      <hr className="slds-m-vertical_small" />
                    </div>
                  )}
                  <UiRecordForm
                    key={formKey}
                    org={selectedOrg}
                    controlClassName="slds-p-bottom_x-small slds-p-horizontal_xx-small"
                    action="create"
                    sobjectFields={sobjectMetadata.fields || []}
                    picklistValues={picklistValues || {}}
                    record={initialRecord}
                    initialModifiedRecord={modifiedRecord}
                    saveErrors={formErrors.fieldErrors}
                    disabled={loading || saving}
                    onChange={handleRecordChange}
                  />
                </section>
              )}
          </AutoFullHeightContainer>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default CreateRecords;
