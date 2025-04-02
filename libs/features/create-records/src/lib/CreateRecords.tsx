import { css } from '@emotion/react';
import { getPicklistValuesForRecordAndRecordType, UiRecordForm } from '@jetstream/record-form';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { describeSObject, sobjectOperation } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { filterCreateSobjects, isErrorResponse, useNonInitialEffect, useSentry } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import {
  DescribeGlobalSObjectResult,
  DescribeSObjectResult,
  ListItem,
  PicklistFieldValues,
  RecordResult,
  SalesforceOrgUi,
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
import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { LastCreatedRecord } from './LastCreatedRecord';

const HEIGHT_BUFFER = 160;

export const CreateRecords = () => {
  const isMounted = useRef(true);
  const sentry = useSentry();
  const { trackEvent } = useAmplitude();

  const { defaultApiVersion } = useRecoilValue(applicationCookieState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [key, setKey] = useState(() => new Date().getTime());

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
    setKey(new Date().getTime());
    setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
    setCreatedRecord(null);
  }

  async function handleRecordChange(record: SalesforceRecord) {
    setModifiedRecord(record);
  }

  async function handleRecordTypeChange(recordTypeId: string) {
    setSelectedRecordTypeId(recordTypeId);
    calculatePicklistValues({ recordTypeId, updateLoadingState: true });
    setModifiedRecord({});
    setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
  }

  async function calculatePicklistValues({
    recordTypeId,
    updateLoadingState = false,
  }: { recordTypeId?: string; updateLoadingState?: boolean } = {}) {
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
          }))
        );
      }

      await calculatePicklistValues();

      setInitialRecord({});
    } catch (ex) {
      if (isMounted.current) {
        logger.error('Error fetching metadata', ex);
        sentry.trackError('Error fetching record metadata', ex, 'CreateRecords');
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
    } else if (Object.keys(formErrors).length) {
      setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
    }

    setSaving(true);

    try {
      const recordResponse: RecordResult = (await sobjectOperation(selectedOrg, selectedObject.name, 'create', { records: [record] }))[0];

      if (isMounted.current) {
        if (isErrorResponse(recordResponse)) {
          setFormErrors(handleEditFormErrorResponse(recordResponse));
        } else {
          const retrievedRecord = (await sobjectOperation(selectedOrg, selectedObject.name, 'retrieve', { ids: [recordResponse.id] }))[0];
          setCreatedRecord({ id: recordResponse.id, sobject: selectedObject.name, record: retrievedRecord });
        }
      }
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
                      comboboxProps={{ label: 'Record Type', labelHelp: 'The Record Type controls which picklist values are available' }}
                      items={recordTypes}
                      selectedItemId={selectedRecordTypeId}
                      onSelected={(item) => handleRecordTypeChange(item.id)}
                    />
                    <hr className="slds-m-vertical_small" />
                  </div>
                )}
                <UiRecordForm
                  key={`${key}-${selectedRecordTypeId || ''}`}
                  controlClassName="slds-p-bottom_x-small slds-p-horizontal_xx-small"
                  action="create"
                  sobjectFields={sobjectMetadata.fields || []}
                  picklistValues={picklistValues || {}}
                  record={initialRecord}
                  saveErrors={formErrors.fieldErrors}
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
