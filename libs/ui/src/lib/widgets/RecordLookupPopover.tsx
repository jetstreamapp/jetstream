import { css } from '@emotion/react';
import { describeGlobal, describeSObject, queryWithCache } from '@jetstream/shared/data';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { RecordWithAuditFields, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { dataTableDateFormatter } from '../data-table/data-table-formatters';
import ReadOnlyFormElement from '../form/readonly-form-element/ReadOnlyFormElement';
import Grid from '../grid/Grid';
import GridCol from '../grid/GridCol';
import Popover from '../popover/Popover';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import Icon from './Icon';
import SalesforceLogin from './SalesforceLogin';
import Spinner from './Spinner';

export interface RecordLookupPopoverProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  recordId: string;
  skipFrontDoorAuth?: boolean;
  returnUrl?: string;
  isTooling?: boolean;
}

export const RecordLookupPopover: FunctionComponent<RecordLookupPopoverProps> = ({
  org,
  serverUrl,
  recordId,
  skipFrontDoorAuth,
  returnUrl,
  isTooling,
}) => {
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sobjectName, setSobjectName] = useState<string | null>(null);
  const [record, setRecord] = useState<RecordWithAuditFields | null>(null);

  useNonInitialEffect(() => {
    setLoading(false);
    setErrorMessage(null);
    setSobjectName(null);
    setRecord(null);
  }, [recordId]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchRecord = async (reload = false) => {
    try {
      if (!reload && record) {
        return;
      }
      setLoading(true);
      const keyPrefix = recordId.substring(0, 3);
      const describeGlobalResults = await describeGlobal(org, isTooling);
      if (!isMounted.current) {
        return;
      }

      const sobject = describeGlobalResults.data.sobjects.find((sobject) => sobject.keyPrefix === keyPrefix);
      if (!sobject) {
        setErrorMessage(`An object with the prefix "${keyPrefix}" was not found.`);
        return;
      }
      setSobjectName(`${sobject.label} (${sobject.name})`);
      const fields = await describeSObject(org, sobject.name, isTooling).then((result) => result.data.fields);
      if (!isMounted.current) {
        return;
      }

      let fieldsToQuery = new Set(['Id', 'Name', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById']);
      fieldsToQuery = new Set(fields.filter((field) => fieldsToQuery.has(field.name)).map((field) => field.name));
      if (fieldsToQuery.has('CreatedById')) {
        fieldsToQuery.add('CreatedBy.Name');
      }
      if (fieldsToQuery.has('LastModifiedById')) {
        fieldsToQuery.add('LastModifiedBy.Name');
      }

      const queryResults = await queryWithCache<RecordWithAuditFields>(
        org,
        `SELECT ${Array.from(fieldsToQuery).join(', ')} FROM ${sobject.name} WHERE Id = '${recordId}'`,
        isTooling,
        reload
      );
      if (!isMounted.current) {
        return;
      }

      setRecord(queryResults.data.queryResults.records[0]);
    } catch (ex) {
      setErrorMessage(`There was an error getting the record data.`);
    } finally {
      setLoading(false);
    }
  };

  if (!recordId) {
    return null;
  }

  return (
    <Popover
      size="large"
      onChange={(isOpen) => isOpen && fetchRecord()}
      panelProps={{
        onDoubleClick: (event) => event.stopPropagation(),
      }}
      content={
        <div>
          <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl={returnUrl} skipFrontDoorAuth={skipFrontDoorAuth}>
            View in Salesforce
          </SalesforceLogin>
          <Grid
            css={css`
              min-height: 140px;
            `}
            className="slds-is-relative slds-m-top_x-small"
          >
            {loading && <Spinner />}
            {record && (
              <Grid wrap gutters>
                {errorMessage && (
                  <GridCol size={12}>
                    <ScopedNotification theme="error">{errorMessage}</ScopedNotification>
                  </GridCol>
                )}
                <GridCol size={12}>
                  <ReadOnlyFormElement id="Object" label="Object" className="slds-p-bottom_x-small" value={sobjectName} bottomBorder />
                </GridCol>
                <GridCol size={6}>
                  <ReadOnlyFormElement id="Id" label="Id" className="slds-p-bottom_x-small" value={record.Id} bottomBorder />
                </GridCol>
                <GridCol size={6}>
                  <ReadOnlyFormElement id="Name" label="Name" className="slds-p-bottom_x-small" value={record.Name} bottomBorder />
                </GridCol>
                <GridCol size={6}>
                  <ReadOnlyFormElement
                    id="Created By"
                    label="Created By"
                    className="slds-p-bottom_x-small"
                    value={record.CreatedBy?.Name || record.CreatedById}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={6}>
                  <ReadOnlyFormElement
                    id="Created Date"
                    label="Created Date"
                    className="slds-p-bottom_x-small"
                    value={dataTableDateFormatter(record.CreatedDate)}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={6}>
                  <ReadOnlyFormElement
                    id="LastModified By"
                    label="LastModified By"
                    className="slds-p-bottom_x-small"
                    value={record.LastModifiedBy?.Name || record.LastModifiedById}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={6}>
                  <ReadOnlyFormElement
                    id="Last Modified Date"
                    label="Last Modified Date"
                    className="slds-p-bottom_x-small"
                    value={dataTableDateFormatter(record.LastModifiedDate)}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={12}>
                  <button className="slds-button" disabled={loading} onClick={() => fetchRecord(true)}>
                    <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Reload Record
                  </button>
                </GridCol>
              </Grid>
            )}
          </Grid>
        </div>
      }
      buttonProps={{ className: 'slds-button' }}
    >
      {recordId}
    </Popover>
  );
};

export default RecordLookupPopover;
