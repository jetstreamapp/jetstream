/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockPicklistValuesFromSobjectDescribe, UiRecordForm } from '@jetstream/record-form';
import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, genericRequest, sobjectOperation } from '@jetstream/shared/data';
import { isErrorResponse, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  CloneEditView,
  PicklistFieldValues,
  PicklistFieldValuesResponse,
  Record,
  RecordResult,
  SalesforceOrgUi,
  SobjectCollectionResponse,
} from '@jetstream/types';
import { Checkbox, FileDownloadModal, Grid, Icon, Modal, PopoverErrorButton, Spinner } from '@jetstream/ui';
import { Field } from 'jsforce';
import isUndefined from 'lodash/isUndefined';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import {
  combineRecordsForClone,
  EditFromErrors,
  handleEditFormErrorResponse,
  transformEditForm,
  validateEditForm,
} from '../utils/query-utils';

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

function getTagline(sobjectName: string, initialRecord?: Record, recordId?: string) {
  if (initialRecord && recordId) {
    return `${sobjectName} - ${initialRecord.Name} - ${recordId}`;
  } else if (recordId) {
    return `${sobjectName} - ${recordId}`;
  }
  return sobjectName;
}

export interface ViewEditCloneRecordProps {
  apiVersion: string;
  selectedOrg: SalesforceOrgUi;
  action: CloneEditView;
  sobjectName: string;
  recordId: string;
  onClose: (reloadRecords?: boolean) => void;
  onChangeAction: (action: CloneEditView) => void;
}

export const ViewEditCloneRecord: FunctionComponent<ViewEditCloneRecordProps> = ({
  apiVersion,
  selectedOrg,
  action,
  sobjectName,
  recordId,
  onClose,
  onChangeAction,
}) => {
  const isMounted = useRef(null);
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const [sobjectFields, setSobjectFields] = useState<Field[]>();
  const [picklistValues, setPicklistValues] = useState<PicklistFieldValues>();
  const [initialRecord, setInitialRecord] = useState<Record>();
  const [modifiedRecord, setModifiedRecord] = useState<Record>();
  const [formIsDirty, setIsFormDirty] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showFieldTypes, setShowFieldTypes] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<EditFromErrors>({ hasErrors: false, fieldErrors: {}, generalErrors: [] });
  const [modalTitle, setModalTitle] = useState(() => getModalTitle(action));

  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    setModalTitle(getModalTitle(action));
  }, [action]);

  useNonInitialEffect(() => {
    const isDirty = Object.values(modifiedRecord).filter((value) => value !== undefined).length > 0;
    const fieldErrors = { ...formErrors.fieldErrors };
    let needsFormErrorsUpdate = false;
    let hasRemainingErrors = false;
    if (formErrors.hasErrors) {
      Object.keys(fieldErrors).forEach((key) => {
        if (isUndefined(modifiedRecord[key])) {
          needsFormErrorsUpdate = true;
          fieldErrors[key] = undefined;
        } else {
          hasRemainingErrors = true;
        }
      });
    }
    setIsFormDirty(isDirty);
    if (needsFormErrorsUpdate) {
      setFormErrors({ hasErrors: hasRemainingErrors, fieldErrors, generalErrors: formErrors.generalErrors });
    }
  }, [modifiedRecord]);

  const fetchMetadata = useCallback(async () => {
    try {
      let picklistValues: PicklistFieldValues = {};
      let record: Record = {};

      if (action !== 'create') {
        record = await sobjectOperation<Record>(selectedOrg, sobjectName, 'retrieve', { ids: recordId });
      }

      const sobjectMetadata = await describeSObject(selectedOrg, sobjectName);

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

      if (action === 'clone') {
        record.attributes = undefined;
        record.Id = undefined;
      }

      if (isMounted.current) {
        setSobjectFields(sobjectMetadata.data.fields);
        setPicklistValues(picklistValues);
        setInitialRecord(record);
        setLoading(false);
      }
    } catch (ex) {
      // TODO: error handling
      if (isMounted.current) {
        setFormErrors({ hasErrors: true, fieldErrors: {}, generalErrors: ['Oops. There was a problem loading the record information.'] });
        setLoading(false);
      }
    }
  }, [action, apiVersion, recordId, selectedOrg, sobjectName]);

  useEffect(() => {
    setLoading(true);
    fetchMetadata();
  }, [fetchMetadata]);

  async function handleRecordChange(record: Record) {
    setModifiedRecord(record);
  }

  async function handleSave() {
    let record = transformEditForm(sobjectFields, modifiedRecord);
    const currentFormErrors = validateEditForm(sobjectFields, record);

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
        recordResponse = (await sobjectOperation<SobjectCollectionResponse>(selectedOrg, sobjectName, 'update', { records: [record] }))[0];
      } else {
        // include all creatable fields from original record
        record = combineRecordsForClone(sobjectFields, initialRecord, record);
        recordResponse = (await sobjectOperation<SobjectCollectionResponse>(selectedOrg, sobjectName, 'create', { records: [record] }))[0];
      }

      if (isMounted.current) {
        if (isErrorResponse(recordResponse)) {
          setFormErrors(handleEditFormErrorResponse(recordResponse));
        } else {
          // record created/updated
          onClose(true);
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
  }

  function handleDownloadModalClose(canceled?: boolean) {
    if (canceled) {
      setDownloadModalOpen(false);
    } else {
      onClose();
    }
  }

  return (
    <div>
      {downloadModalOpen && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Download Record"
          data={[initialRecord]}
          fileNameParts={['record', recordId]}
          allowedTypes={['xlsx', 'csv', 'json']}
          onModalClose={handleDownloadModalClose}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {!downloadModalOpen && (
        <Modal
          header={modalTitle}
          tagline={getTagline(sobjectName, initialRecord, recordId)}
          size="lg"
          closeOnEsc={!loading && !formIsDirty}
          className="h-100 slds-is-relative"
          footer={
            <Fragment>
              {action === 'view' && (
                <Grid align="spread">
                  <div>
                    <Checkbox
                      id={`record-actions-show-field-types`}
                      checked={showFieldTypes}
                      onChange={setShowFieldTypes}
                      label="Show Field Types"
                      disabled={loading || saving || !initialRecord}
                    />
                  </div>
                  <div>
                    {formErrors.hasErrors && formErrors.generalErrors.length > 0 && (
                      <span className="slds-text-align_left d-inline-block">
                        <PopoverErrorButton errors={formErrors.generalErrors} omitPortal />
                      </span>
                    )}
                    <button className="slds-button slds-button_neutral" onClick={() => onChangeAction('edit')} disabled={loading}>
                      <Icon type="utility" icon="edit" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Edit Record
                    </button>
                    <button className="slds-button slds-button_neutral" onClick={() => onChangeAction('clone')} disabled={loading}>
                      <Icon type="utility" icon="copy" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Clone Record
                    </button>
                    <button className="slds-button slds-button_neutral" onClick={() => setDownloadModalOpen(true)} disabled={loading}>
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Download
                    </button>
                    <button className="slds-button slds-button_brand" onClick={() => onClose()} disabled={loading}>
                      Close
                    </button>
                  </div>
                </Grid>
              )}
              {action !== 'view' && (
                <Grid align="center">
                  <div>
                    {formErrors.hasErrors && formErrors.generalErrors.length > 0 && (
                      <span className="slds-text-align_left d-inline-block">
                        <PopoverErrorButton errors={formErrors.generalErrors} omitPortal />
                      </span>
                    )}
                    <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
                      Cancel
                    </button>
                    <button
                      className="slds-button slds-button_brand"
                      onClick={handleSave}
                      disabled={(action === 'edit' && !formIsDirty) || loading || !initialRecord}
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
          <div>
            {(loading || saving) && <Spinner />}
            {!loading && initialRecord && (
              <UiRecordForm
                action={action}
                sobjectFields={sobjectFields}
                picklistValues={picklistValues}
                record={initialRecord}
                saveErrors={formErrors.fieldErrors}
                onChange={handleRecordChange}
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ViewEditCloneRecord;
