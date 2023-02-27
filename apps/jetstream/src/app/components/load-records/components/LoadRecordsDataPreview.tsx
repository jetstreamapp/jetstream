import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import { Alert, AutoFullHeightContainer, DataTable, getColumnsForGenericTable, Grid, GridCol, RowWithKey, Spinner } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import isNil from 'lodash/isNil';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Column } from 'react-data-grid';
import { useRecoilState } from 'recoil';
import * as fromLoadRecordsState from '../load-records.state';

const NUM_COLUMN = '_num';

const getRowId = ({ _num }: any) => _num;

export interface LoadRecordsDataPreviewProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: DescribeGlobalSObjectResult;
  loadType: InsertUpdateUpsertDelete;
  data: any[];
  header: string[];
}

// function valueGetter: ((params: ValueGetterParams) => any) | string;

function getLoadDescription(loadType: InsertUpdateUpsertDelete, totalRecordCount: number, omitTotalRecordCount: boolean, data: any[]) {
  let action: string;
  switch (loadType) {
    case 'INSERT':
      action = 'create';
      break;
    case 'UPDATE':
      action = 'update';
      break;
    case 'UPSERT':
      action = 'update or create';
      break;
    case 'DELETE':
    default:
      action = 'delete';
      break;
  }
  return (
    <span>
      <span>
        You are about to{' '}
        <strong>
          {action} {formatNumber(data.length)}
        </strong>{' '}
        records.{' '}
      </span>
      {!omitTotalRecordCount && (
        <span className="slds-text-color_weak">There are currently {formatNumber(totalRecordCount)} records in Salesforce.</span>
      )}
    </span>
  );
}

function getColumnDefinitions(headers: string[]): Column<RowWithKey>[] {
  return getColumnsForGenericTable([
    { key: NUM_COLUMN, label: '#', columnProps: { width: 75, filters: [] } },
    ...headers.map((header) => ({ key: header, label: header })),
  ]);
}

export const LoadRecordsDataPreview: FunctionComponent<LoadRecordsDataPreviewProps> = ({
  selectedOrg,
  selectedSObject,
  data,
  header,
  loadType,
}) => {
  const isMounted = useRef(true);
  const [totalRecordCount, setTotalRecordCount] = useRecoilState(fromLoadRecordsState.loadExistingRecordCount);
  const [omitTotalRecordCount, setOmitTotalRecordCount] = useState(true);
  const [columns, setColumns] = useState<Column<RowWithKey>[]>(null);
  const [rows, setRows] = useState<RowWithKey[]>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedOrg && selectedSObject && isNil(totalRecordCount)) {
      (async () => {
        const sobjectName = selectedSObject.name;
        try {
          setLoading(true);
          // TODO: we could use recordCount API: :ENDPOINT/services/data/v{{version}}/limits/recordCount?sObjects=Account,Contact
          // TODO: this could be moved into a custom hook
          const results = await query(selectedOrg, `SELECT COUNT() FROM ${sobjectName}`);
          if (!isMounted.current || selectedSObject?.name !== sobjectName) {
            return;
          }
          setTotalRecordCount(results.queryResults.totalSize);
          setOmitTotalRecordCount(false);
        } catch (ex) {
          logger.warn('[ERROR] Unable to get total record count', ex);
        } finally {
          if (!isMounted.current || selectedSObject?.name !== sobjectName) {
            // eslint-disable-next-line no-unsafe-finally
            return;
          }
          setLoading(false);
        }
      })();
    }
  }, [selectedOrg, selectedSObject, totalRecordCount]);

  useEffect(() => {
    if (data && header) {
      setRows(data.map((row, i) => ({ ...row, [NUM_COLUMN]: i + 1 })));
      setColumns(getColumnDefinitions(header));
    } else {
      setColumns(null);
      setRows(null);
    }
  }, [data, header]);

  return (
    <div>
      <Grid vertical>
        <GridCol className="slds-m-bottom--medium">
          {!selectedSObject && (
            <Alert type="warning" leadingIcon="info">
              <strong>Select an object from the list on the left to continue</strong>
            </Alert>
          )}
          {selectedSObject && !data && (
            <Alert type="warning" leadingIcon="info">
              <strong>Upload a file to continue</strong>
            </Alert>
          )}
          {selectedSObject && data && (
            <div className="slds-is-relative">
              {loading && <Spinner size="small" />}
              <div>
                Object: <strong>{selectedSObject.name}</strong>
              </div>
              <div>{getLoadDescription(loadType, totalRecordCount, omitTotalRecordCount, data)}</div>
            </div>
          )}
        </GridCol>
        <GridCol className="slds-is-relative">
          {columns && rows && (
            <div
              css={css`
                position: absolute;
                max-width: 100%;
                min-width: 100%;
              `}
            >
              <div className="slds-text-heading_small">File Preview</div>
              <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25}>
                <DataTable columns={columns} data={rows} getRowKey={getRowId} />
              </AutoFullHeightContainer>
            </div>
          )}
        </GridCol>
      </Grid>
    </div>
  );
};

export default LoadRecordsDataPreview;
