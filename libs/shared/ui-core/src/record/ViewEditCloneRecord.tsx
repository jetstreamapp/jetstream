/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockPicklistValuesFromSobjectDescribe, UiRecordForm } from '@jetstream/record-form';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, SOBJECT_NAME_FIELD_MAP } from '@jetstream/shared/constants';
import { describeGlobal, describeSObject, genericRequest, query, sobjectOperation } from '@jetstream/shared/data';
import { copyRecordsToClipboard, isErrorResponse, useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import {
  AsyncJobNew,
  BulkDownloadJob,
  ChildRelationship,
  CloneEditView,
  CopyAsDataType,
  ErrorResult,
  Field,
  FileExtCsvXLSXJsonGSheet,
  Maybe,
  PicklistFieldValues,
  PicklistFieldValuesResponse,
  RecordResult,
  SalesforceOrgUi,
  SalesforceRecord,
} from '@jetstream/types';
import {
  Breadcrumbs,
  ButtonGroupContainer,
  DownloadFromServerOpts,
  DropDown,
  Grid,
  Icon,
  Modal,
  PopoverErrorButton,
  RecordDownloadModal,
  SalesforceLogin,
  Spinner,
  Tabs,
} from '@jetstream/ui';
import {
  combineRecordsForClone,
  EditFromErrors,
  handleEditFormErrorResponse,
  transformEditForm,
  validateEditForm,
} from '@jetstream/ui-core/shared';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import Editor from '@monaco-editor/react';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useAmplitude } from '../analytics';
import { fromJetstreamEvents } from '../jetstream-events';
import { applicationCookieState } from '../state-management/app-state';
import { ViewChildRecords } from './ViewChildRecords';

const CHILD_RELATIONSHIP_BLOCK_LIST = new Set<string>([
  'OutgoingEmailRelations',
  'UserFieldAccessRights',
  'RecordActionHistories',
  'DocumentChecklistItemUploadedBy',
  'DocumentChecklistWho',
  'UserEntityAccessRights', // this works, but no useful fields show up
  'UserPreferences', // this works, but no useful fields show up
  'ContentDocumentLinks', // this works, but no useful fields show up
]);

function getModalTitle(action: CloneEditView) {
  if (action === 'view') {
    return 'View Record';
  } else if (action === 'edit') {
    return 'Edit Record';
  } else if (action === 'clone') {
    return 'Clone Record';
  }
  return 'Create Record';
}

function getTagline(
  selectedOrg: SalesforceOrgUi,
  serverUrl: string,
  sobjectName: string,
  initialRecord?: SalesforceRecord,
  recordId?: string | null
) {
  if (initialRecord && recordId) {
    return (
      <SalesforceLogin
        serverUrl={serverUrl}
        org={selectedOrg}
        returnUrl={`/${recordId}`}
        skipFrontDoorAuth
        iconPosition="right"
        title="View record in Salesforce"
      >
        {sobjectName} - {initialRecord[SOBJECT_NAME_FIELD_MAP[sobjectName] || 'Name']} - {recordId}
      </SalesforceLogin>
    );
  } else if (recordId) {
    return (
      <SalesforceLogin
        serverUrl={serverUrl}
        org={selectedOrg}
        returnUrl={`/${recordId}`}
        skipFrontDoorAuth
        iconPosition="right"
        title="View record in Salesforce"
      >
        {sobjectName} - {recordId}
      </SalesforceLogin>
    );
  }
  return sobjectName;
}

export interface ViewEditCloneRecordProps {
  apiVersion: string;
  selectedOrg: SalesforceOrgUi;
  action: CloneEditView;
  sobjectName: string;
  recordId: string | null;
  onClose: (reloadRecords?: boolean) => void;
  onChangeAction: (action: CloneEditView) => void;
  onFetch?: (recordId: string, record: any) => void;
  onFetchError?: (recordId: string, sobjectName: string) => void;
}

export const ViewEditCloneRecord: FunctionComponent<ViewEditCloneRecordProps> = ({
  apiVersion,
  selectedOrg,
  action,
  sobjectName: initialSobjectName,
  recordId: initialRecordId,
  onClose,
  onChangeAction,
  onFetch,
  onFetchError,
}) => {
  const { trackEvent } = useAmplitude();
  const isMounted = useRef(true);
  const modalRef = useRef(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const rollbar = useRollbar();
  // If user was ever in view mode, clicking cancel will take back to view instead of close
  const hasEverBeenInViewMode = useRef(false);
  hasEverBeenInViewMode.current = action === 'view' || hasEverBeenInViewMode.current;

  const [{ serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);

  // User can drill in to related records, this allows us to go back up the chain via Breadcrumbs
  const [recordId, setRecordId] = useState(initialRecordId);
  const [sobjectName, setSobjectName] = useState(initialSobjectName);
  const [priorRecords, setPriorRecords] = useState<{ recordId: string; sobjectName: string }[]>([]);

  const [childRelationships, setChildRelationships] = useState<ChildRelationship[]>();
  const [sobjectFields, setSobjectFields] = useState<Field[]>();
  const [picklistValues, setPicklistValues] = useState<PicklistFieldValues>();
  const [initialRecord, setInitialRecord] = useState<SalesforceRecord>();
  const [recordWithChildrenQueries, setRecordWithChildrenQueries] = useState<Record<string, Maybe<SalesforceRecord>>>({});
  const [modifiedRecord, setModifiedRecord] = useState<SalesforceRecord>({});
  const [formIsDirty, setIsFormDirty] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<EditFromErrors>({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
  const [modalTitle, setModalTitle] = useState(() => getModalTitle(action));
  const [isViewAsJson, setIsViewAsJson] = useState(false);

  const [downloadModalData, setDownloadModalData] = useState<
    { open: false } | { open: true; data: SalesforceRecord; fields: string[]; subqueryFields?: Record<string, string[]> }
  >({
    open: false,
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    setModalTitle(getModalTitle(action));
    setIsViewAsJson(false);
  }, [action]);

  useNonInitialEffect(() => {
    setIsFormDirty(Object.values(modifiedRecord).filter((value) => value !== undefined).length > 0);
  }, [action, modifiedRecord]);

  const fetchMetadata = useCallback(async () => {
    try {
      let picklistValues: PicklistFieldValues = {};
      let record: SalesforceRecord = {};

      const sobjectMetadata = await describeSObject(selectedOrg, sobjectName);
      setChildRelationships(
        sobjectMetadata.data.childRelationships.filter(
          (item) => item.relationshipName && item.childSObject && !CHILD_RELATIONSHIP_BLOCK_LIST.has(item.relationshipName)
        )
      );

      if (action !== 'create' && recordId) {
        const response: SalesforceRecord | ErrorResult = (
          await sobjectOperation(selectedOrg, sobjectName, 'retrieve', { ids: [recordId] })
        )[0];
        if ('success' in response && !response.success) {
          setFormErrors(handleEditFormErrorResponse(response));
          setLoading(false);
          return;
        }
        record = response;
      }

      let recordTypeId = record?.RecordTypeId;
      if (!recordTypeId) {
        const recordTypeInfos = sobjectMetadata.data.recordTypeInfos;
        if (recordTypeInfos.length === 1) {
          recordTypeId = recordTypeInfos[0].recordTypeId;
        } else {
          const foundRecordType = recordTypeInfos.find((recordType) => recordType.master);
          if (foundRecordType) {
            recordTypeId = foundRecordType.recordTypeId;
          }
        }
      }
      if (recordTypeId) {
        try {
          const results = await genericRequest<PicklistFieldValuesResponse>(selectedOrg, {
            method: 'GET',
            url: `/services/data/${apiVersion}/ui-api/object-info/${sobjectName}/picklist-values/${recordTypeId}`,
            isTooling: false,
          });
          picklistValues = results.picklistFieldValues;
        } catch (ex) {
          logger.warn('[RECORD-UI][ERROR]', ex);
          if (ex?.message?.endsWith('not supported in UI API')) {
            // UI API is not supported, artificially build picklist values
            picklistValues = mockPicklistValuesFromSobjectDescribe(sobjectMetadata.data);
          } else {
            throw ex;
          }
        }
      } else {
        // UI API is not supported because there is no record type id, artificially build picklist values
        picklistValues = mockPicklistValuesFromSobjectDescribe(sobjectMetadata.data);
      }

      // Query all related records so that related record name can be shown in the UI
      if (recordId) {
        try {
          const { queryResults } = await query(
            selectedOrg,
            composeQuery({
              sObject: sobjectName,
              fields: sobjectMetadata.data.fields
                .filter((field) => field.type === 'reference' && field.relationshipName && record[field.name])
                .map((field) =>
                  getField({
                    field: 'Name',
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    relationships: [field.relationshipName!],
                  })
                ),
              where: {
                left: {
                  field: 'Id',
                  operator: '=',
                  value: recordId,
                  literalType: 'STRING',
                },
              },
            })
          );
          record = { ...record, ...queryResults.records[0] };
        } catch (ex) {
          logger.warn('Could not fetch related records');
        }
      }

      if (action === 'clone') {
        record.attributes = undefined;
        record.Id = undefined;
      }

      if (isMounted.current) {
        setSobjectFields(sobjectMetadata.data.fields);
        setPicklistValues(picklistValues);
        setInitialRecord(record);
        setLoading(false);
        onFetch && recordId && onFetch(recordId, record);
      }
    } catch (ex) {
      if (isMounted.current) {
        logger.error('Error fetching metadata', ex);
        rollbar.error('Error fetching record metadata', { message: ex.message, stack: ex.stack });
        setFormErrors({
          hasErrors: true,
          fieldErrors: {},
          generalErrors: ['Oops. There was a problem loading the record information. Make sure the record id is valid.'],
        });
        setLoading(false);
        onFetchError && recordId && onFetchError(recordId, sobjectName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, apiVersion, recordId, selectedOrg, sobjectName]);

  useEffect(() => {
    setLoading(true);
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    trackEvent(ANALYTICS_KEYS.record_modal_action_change, { action, isViewAsJson });
  }, [action, isViewAsJson, trackEvent]);

  async function handleRecordChange(record: SalesforceRecord) {
    setModifiedRecord(record);
  }

  async function handleSave() {
    let record = transformEditForm(sobjectFields || [], modifiedRecord);
    const currentFormErrors = validateEditForm(sobjectFields || [], record);

    if (currentFormErrors.hasErrors) {
      setFormErrors({ hasErrors: true, fieldErrors: currentFormErrors.fieldErrors, generalErrors: [] });
      return;
    } else if (Object.keys(formErrors).length) {
      setFormErrors({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
    }

    setSaving(true);

    try {
      let recordResponse: RecordResult;

      if (action === 'edit') {
        record.attributes = { type: sobjectName };
        record.Id = recordId;
        recordResponse = (await sobjectOperation(selectedOrg, sobjectName, 'update', { records: [record] }))[0];
      } else {
        // include all creatable fields from original record
        record = combineRecordsForClone(sobjectFields || [], initialRecord, record);
        recordResponse = (await sobjectOperation(selectedOrg, sobjectName, 'create', { records: [record] }))[0];
      }

      if (isMounted.current) {
        if (isErrorResponse(recordResponse)) {
          setFormErrors(handleEditFormErrorResponse(recordResponse));
        } else {
          // record created/updated
          hasEverBeenInViewMode.current ? onChangeAction('view') : onClose(true);
          // onClose(true);
        }
      }
    } catch (ex) {
      if (isMounted.current) {
        setFormErrors({ hasErrors: true, fieldErrors: {}, generalErrors: ['An unknown problem has occurred.'] });
      }
    }
    if (isMounted.current) {
      setSaving(false);
    }
    trackEvent(ANALYTICS_KEYS.record_modal_save, { action });
  }

  function handleDownloadModalOpen() {
    const record = { ...initialRecord, ...recordWithChildrenQueries };
    setDownloadModalData({
      open: true,
      data: [record],
      fields: Object.keys(record).filter((field) => field !== 'attributes'),
      subqueryFields: Object.keys(record)
        .filter((field) => field !== 'attributes')
        .reduce((acc, field) => {
          if (record[field] && isObject(record[field]) && Array.isArray((record[field] as any)?.records)) {
            const firstRecord = (record[field] as any)?.records?.[0] || {};
            acc[field] = Object.keys(firstRecord)
              .filter((field) => field !== 'attributes')
              .map((field) => {
                if (field === 'CreatedBy' || field === 'LastModifiedBy') {
                  return `${field}.Name`;
                }
                return field;
              });
          }
          return acc;
        }, {}),
    });
  }

  function handleDownloadModalClose(canceled?: boolean) {
    setDownloadModalData({ open: false });
  }

  // Used for Google Drive upload
  function handleDownloadFromServer(options: DownloadFromServerOpts) {
    const { fileFormat, fileName, fields, subqueryFields, includeSubquery, whichFields, recordsToInclude, googleFolder } = options;
    const jobs: AsyncJobNew<BulkDownloadJob>[] = [
      {
        type: 'BulkDownload',
        title: `Download Records`,
        org: selectedOrg,
        meta: {
          serverUrl,
          sObject: sobjectName,
          soql: '',
          isTooling: false,
          includeDeletedRecords: false,
          useBulkApi: false,
          fields,
          subqueryFields,
          records: recordsToInclude || [],
          totalRecordCount: 1,
          nextRecordsUrl: '',
          hasAllRecords: true,
          fileFormat,
          fileName,
          includeSubquery,
          googleFolder,
        },
      },
    ];
    fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
    trackEvent(ANALYTICS_KEYS.record_modal_download, {
      fileFormat,
      whichFields,
      includeSubquery,
    });
    onClose();
  }

  function handleDidDownload(fileFormat: FileExtCsvXLSXJsonGSheet, whichFields: 'all' | 'specified', includeSubquery: boolean) {
    trackEvent(ANALYTICS_KEYS.record_modal_download, {
      fileFormat,
      whichFields,
      includeSubquery,
    });
  }

  function handleCopyToClipboard(format: CopyAsDataType = 'excel') {
    if (!initialRecord) {
      return;
    }
    copyRecordsToClipboard(
      [initialRecord],
      format,
      Object.keys(initialRecord).filter((field) => field !== 'attributes')
    );
    trackEvent(ANALYTICS_KEYS.record_modal_clipboard);
  }

  /**
   * Drill in to related record
   * Save breadcrumb of prior record so that user can navigate back
   */
  async function viewRelatedRecord(newRecordId: string, metadata: Field) {
    try {
      const keyPrefix = newRecordId.substring(0, 3);
      const describeGlobalResults = await describeGlobal(selectedOrg);
      const sobject = describeGlobalResults.data.sobjects.find((sobject) => sobject.keyPrefix === keyPrefix);
      if (!sobject) {
        throw new Error(`Could not find sobject for record id ${newRecordId}`);
      }
      if (isMounted.current) {
        recordId && setPriorRecords((prevValue) => [...prevValue, { recordId, sobjectName }]);
        setModifiedRecord({});
        setRecordId(newRecordId);
        setSobjectName(sobject.name);
      }
    } catch (ex) {
      if (isMounted.current) {
        setFormErrors({
          hasErrors: true,
          fieldErrors: {},
          generalErrors: ['Oops. There was a problem loading the related record information.'],
        });
      }
    } finally {
      trackEvent(ANALYTICS_KEYS.record_modal_view_related);
    }
  }

  /**
   * User clicked on breadcrumb to revert to prior record
   */
  function revertToPriorRecord(index: number) {
    try {
      const { recordId, sobjectName } = priorRecords[index];
      setPriorRecords((prevValue) => prevValue.filter((record, idx) => idx < index));
      setModifiedRecord({});
      setRecordId(recordId);
      setSobjectName(sobjectName);
    } catch (ex) {
      setFormErrors({
        hasErrors: true,
        fieldErrors: {},
        generalErrors: ['Oops. There was a problem loading the related record information.'],
      });
    }
  }

  const tabs = [
    {
      id: 'root',
      title: 'Record',
      content: (
        <UiRecordForm
          action={action}
          sobjectFields={sobjectFields || []}
          picklistValues={picklistValues || {}}
          record={initialRecord}
          saveErrors={formErrors.fieldErrors}
          onChange={handleRecordChange}
          viewRelatedRecord={viewRelatedRecord}
        />
      ),
    },
  ];
  if (recordId) {
    tabs.push({
      id: 'child',
      title: 'Child Records',
      content: (
        <ViewChildRecords
          selectedOrg={selectedOrg}
          sobjectName={sobjectName}
          parentRecordId={recordId}
          childRelationships={childRelationships || []}
          initialData={recordWithChildrenQueries[recordId]}
          modalRef={modalRef}
          onChildrenData={(parentRecordId, record) =>
            setRecordWithChildrenQueries((priorData) => ({ ...priorData, [parentRecordId]: record }))
          }
        />
      ),
    });
  }

  return (
    <div>
      {downloadModalData.open && (
        <RecordDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          downloadModalOpen
          fields={downloadModalData.fields || []}
          subqueryFields={downloadModalData.subqueryFields || {}}
          records={downloadModalData.data || []}
          totalRecordCount={1}
          onModalClose={handleDownloadModalClose}
          onDownload={handleDidDownload}
          onDownloadFromServer={handleDownloadFromServer}
        />
      )}

      {!downloadModalData.open && (
        <Modal
          ref={modalRef}
          header={modalTitle}
          tagline={
            <div>
              {getTagline(selectedOrg, serverUrl, sobjectName, initialRecord, recordId)}
              {!!priorRecords.length && (
                <>
                  <hr className="slds-m-vertical_small" />
                  <Breadcrumbs
                    items={priorRecords.map((item, index) => ({
                      id: `${item.sobjectName}-${item.recordId}-${index}`,
                      label: `${item.sobjectName} (${item.recordId})`,
                      metadata: index,
                    }))}
                    currentItem="Current Record"
                    onClick={(item) => isNumber(item.metadata) && revertToPriorRecord(item.metadata)}
                  />
                </>
              )}
            </div>
          }
          size="lg"
          closeOnEsc={!loading && !formIsDirty}
          className="h-100 slds-is-relative"
          footer={
            <Fragment>
              {action === 'view' && (
                <div>
                  {formErrors.hasErrors && formErrors.generalErrors.length > 0 && (
                    <span className="slds-text-align_left d-inline-block">
                      <PopoverErrorButton className="slds-m-right_small" errors={formErrors.generalErrors} omitPortal />
                    </span>
                  )}
                  <ButtonGroupContainer className="slds-float_left">
                    <button
                      className="slds-button slds-button_neutral"
                      onClick={() => handleCopyToClipboard()}
                      title="Copy the record to the clipboard which can then pasted into a spreadsheet."
                    >
                      <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
                      <span>Copy to Clipboard</span>
                    </button>
                    <DropDown
                      className="slds-button_last"
                      dropDownClassName="slds-dropdown_actions"
                      position="right"
                      items={[
                        { id: 'csv', value: 'Copy as CSV' },
                        { id: 'json', value: 'Copy as JSON' },
                      ]}
                      onSelected={(item) => handleCopyToClipboard(item as CopyAsDataType)}
                    />
                  </ButtonGroupContainer>
                  <button
                    className="slds-button slds-button_neutral"
                    onClick={() => setIsViewAsJson(!isViewAsJson)}
                    disabled={loading || !initialRecord}
                  >
                    <Icon
                      type="utility"
                      icon={isViewAsJson ? 'record_lookup' : 'merge_field'}
                      className="slds-button__icon slds-button__icon_left"
                      omitContainer
                    />
                    {isViewAsJson ? 'View as Record' : 'View as JSON'}
                  </button>
                  <button
                    className="slds-button slds-button_neutral"
                    onClick={() => onChangeAction('edit')}
                    disabled={loading || !initialRecord}
                  >
                    <Icon type="utility" icon="edit" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Edit
                  </button>
                  <button
                    className="slds-button slds-button_neutral"
                    onClick={() => onChangeAction('clone')}
                    disabled={loading || !initialRecord}
                  >
                    <Icon type="utility" icon="copy" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Clone
                  </button>
                  <button
                    className="slds-button slds-button_neutral"
                    onClick={() => handleDownloadModalOpen()}
                    disabled={loading || !initialRecord}
                  >
                    <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Download
                  </button>
                  <button className="slds-button slds-button_brand" onClick={() => onClose()}>
                    Close
                  </button>
                </div>
              )}
              {action !== 'view' && (
                <Grid align="center">
                  <div>
                    {formErrors.hasErrors && formErrors.generalErrors.length > 0 && (
                      <span className="slds-text-align_left d-inline-block">
                        <PopoverErrorButton errors={formErrors.generalErrors} omitPortal />
                      </span>
                    )}
                    <button
                      className="slds-button slds-button_neutral"
                      onClick={() => {
                        hasEverBeenInViewMode.current ? onChangeAction('view') : onClose();
                      }}
                      disabled={loading || saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="slds-button slds-button_brand"
                      onClick={handleSave}
                      disabled={(action === 'edit' && !formIsDirty) || loading || saving || !initialRecord}
                    >
                      Save
                    </button>
                  </div>
                </Grid>
              )}
            </Fragment>
          }
          onClose={() => onClose()}
        >
          <div ref={modalBodyRef}>
            {(loading || saving) && <Spinner />}
            {!loading && initialRecord && (
              <>
                {/* Create and Edit do not show child records */}
                {!isViewAsJson && action !== 'view' && (
                  <UiRecordForm
                    action={action}
                    sobjectFields={sobjectFields || []}
                    picklistValues={picklistValues || {}}
                    record={initialRecord}
                    saveErrors={formErrors.fieldErrors}
                    onChange={handleRecordChange}
                    viewRelatedRecord={viewRelatedRecord}
                  />
                )}
                {!isViewAsJson && action === 'view' && (
                  <Tabs
                    onChange={(value) => {
                      value === 'children' && trackEvent(ANALYTICS_KEYS.record_modal_view_children);
                    }}
                    tabs={tabs}
                  />
                )}
                {isViewAsJson && (
                  <div className="slds-p-around_large">
                    <Editor
                      height={
                        modalBodyRef.current?.parentElement?.clientHeight ? modalBodyRef.current?.parentElement?.clientHeight - 50 : '70vh'
                      }
                      theme="vs-dark"
                      defaultLanguage="json"
                      value={JSON.stringify(initialRecord, null, 2)}
                      options={{ readOnly: true }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
