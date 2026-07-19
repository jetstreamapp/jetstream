import { css } from '@emotion/react';
import { getPicklistValuesForRecordAndRecordType, removeUnavailablePicklistValues, UiRecordForm } from '@jetstream/record-form';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { describeSObject, sobjectOperation } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { filterCreateSobjects, isErrorResponse, tracker, useNonInitialEffect } from '@jetstream/shared/ui-utils';
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
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, useAmplitude } from '@jetstream/ui-core';
import { EditFromErrors, handleEditFormErrorResponse, transformEditForm, validateEditForm } from '@jetstream/ui-core/shared';
import { applicationCookieState, selectedOrgState } from '@jetstream/ui/app-state';
import { recordDataHistoryAction } from '@jetstream/ui/data-history';
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
    } catch (ex) {
      if (isMounted.current) {
        logger.error('Error fetching metadata', ex);
        tracker.error('Error fetching record metadata', ex);
        setFormErrors({
          hasErrors: true,
          fieldErrors: {},
          generalErrors: ['Oops. There was a problem loading the record information. Make sure the record id is valid.'],
        });
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedObject) {
      return;
    }
    const record = transformEditForm(sobjectMetadata?.fields || [], modifiedRecord);
    const currentFormErrors = validateEditForm(sobjectMetadata?.fields || [], record);

    if (currentFormErrors.hasErrors) {
      setFormErrors({ hasErrors: true, fieldErrors: currentFormErrors.fieldErrors, generalErrors: [] });
      return;
    } else if (formErrors.hasErrors) {
      // reset state since there are no longer any errors
      setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
    }

    setSaving(true);

    try {
      const recordResponse: RecordResult = (await sobjectOperation(selectedOrg, selectedObject.name, 'create', { records: [record] }))[0];
      const isErrorResult = isErrorResponse(recordResponse);
      let retrievedRecord: SalesforceRecord | undefined;

      if (isMounted.current) {
        if (isErrorResult) {
          setFormErrors(handleEditFormErrorResponse(recordResponse));
        } else {
          retrievedRecord = (await sobjectOperation(selectedOrg, selectedObject.name, 'retrieve', { ids: [recordResponse.id] }))[0];
          setCreatedRecord({ id: recordResponse.id, sobject: selectedObject.name, record: retrievedRecord });
        }
      }

      // Record the create to Data History (success OR error). Fire-and-forget + self-gating; the results
      // payload includes the re-fetched full record on success. Small single-record payload -> stored inline.
      void recordDataHistoryAction({
        org: selectedOrg,
        source: 'create-record',
        operation: 'create',
        api: 'collections',
        sobjects: [selectedObject.name],
        request: record,
        results: { result: recordResponse, record: retrievedRecord },
        counts: { total: 1, success: isErrorResult ? 0 : 1, failure: isErrorResult ? 1 : 0 },
        status: isErrorResult ? 'failed' : 'success',
      });

      trackEvent(ANALYTICS_KEYS.create_record_save, { success: true });
    } catch (ex) {
      if (isMounted.current) {
        setFormErrors({ hasErrors: true, fieldErrors: {}, generalErrors: [getErrorMessage(ex) || 'An unknown problem has occurred.'] });
      }
      trackEvent(ANALYTICS_KEYS.create_record_save, { success: false });
    }
    if (isMounted.current) {
      setSaving(false);
    }
  }

  return (
    <Page key={selectedOrg.uniqueId} testId="manage-permissions-page">
      <RequireMetadataApiBanner />
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
            <button className="slds-button slds-button_brand" disabled={!selectedObject} onClick={() => handleSave()}>
              Save
            </button>
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
            {selectedObject && sobjectMetadata?.fields && (
              <>
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
              </>
            )}
          </AutoFullHeightContainer>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default CreateRecords;
