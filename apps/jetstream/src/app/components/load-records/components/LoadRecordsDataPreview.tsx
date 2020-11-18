/** @jsx jsx */
import { ColDef } from '@ag-grid-community/core';
import { css, jsx } from '@emotion/core';
import { query } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import { Alert, AutoFullHeightContainer, DataTable, Grid, GridCol, Spinner } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import isNil from 'lodash/isNil';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import * as fromLoadRecordsState from '../load-records.state';

const NUM_COLUMN = '_num';

export interface LoadRecordsDataPreviewProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: DescribeGlobalSObjectResult;
  loadType: InsertUpdateUpsertDelete;
  data: any[];
  header: string[];
}

// function valueGetter: ((params: ValueGetterParams) => any) | string;

function getLoadDescription(loadType: InsertUpdateUpsertDelete, totalRecordCount: number, data: any[]) {
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
      <span className="slds-text-color_weak">There are currently {formatNumber(totalRecordCount)} records in Salesforce.</span>
    </span>
  );
}

function getColumnDefinitions(headers: string[]): ColDef[] {
  const colDefs = headers.map(
    (header): ColDef => ({
      headerName: header,
      field: header,
      valueGetter: (params) => params.data[header],
    })
  );

  colDefs.unshift({
    headerName: '#',
    field: NUM_COLUMN,
    width: 75,
  });

  return colDefs;
}

export const LoadRecordsDataPreview: FunctionComponent<LoadRecordsDataPreviewProps> = ({
  selectedOrg,
  selectedSObject,
  data,
  header,
  loadType,
}) => {
  const isMounted = useRef(null);
  const [totalRecordCount, setTotalRecordCount] = useRecoilState(fromLoadRecordsState.loadExistingRecordCount);
  const [columns, setColumns] = useState<ColDef[]>(null);
  const [rows, setRows] = useState<any[]>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (selectedOrg && selectedSObject && isNil(totalRecordCount)) {
      (async () => {
        setLoading(true);
        const sobjectName = selectedSObject.name;
        const results = await query(selectedOrg, `SELECT COUNT() FROM ${sobjectName}`);
        if (!isMounted.current || selectedSObject?.name !== sobjectName) {
          return;
        }
        setTotalRecordCount(results.queryResults.totalSize);
        setLoading(false);
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
              <div>{getLoadDescription(loadType, totalRecordCount, data)}</div>
            </div>
          )}
        </GridCol>
        <GridCol
          css={css`
            height: 500px;
          `}
        >
          {columns && rows && (
            <Fragment>
              <div className="slds-text-heading_small">File Preview</div>
              <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25}>
                <DataTable
                  columns={columns}
                  data={rows}
                  agGridProps={{
                    suppressMenuHide: true,
                    suppressRowClickSelection: true,
                    headerHeight: 25,
                    gridOptions: {
                      defaultColDef: {
                        resizable: true,
                      },
                    },
                  }}
                />
              </AutoFullHeightContainer>
            </Fragment>
          )}
        </GridCol>
      </Grid>
    </div>
  );
};

export default LoadRecordsDataPreview;
