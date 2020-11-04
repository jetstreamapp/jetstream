/** @jsx jsx */
import { ColDef } from '@ag-grid-community/core';
import { css, jsx } from '@emotion/core';
import { query } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable, Grid, GridCol, Icon, Spinner } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';

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
  switch (loadType) {
    case 'INSERT':
      return (
        <span>
          To a total of <strong>{formatNumber(totalRecordCount)}</strong> records, you are about to{' '}
          <strong>add {formatNumber(data.length)}</strong> records.
        </span>
      );
    case 'UPDATE':
      return (
        <span>
          From a total of <strong>{formatNumber(totalRecordCount)}</strong> records, you are about to{' '}
          <strong>update {formatNumber(data.length)}</strong> records.
        </span>
      );
    case 'UPSERT':
      return (
        <span>
          From a total of <strong>{formatNumber(totalRecordCount)}</strong> records, you are about to{' '}
          <strong>update or add {formatNumber(data.length)}</strong> records.
        </span>
      );
    case 'DELETE':
      return (
        <span>
          From a total of <strong>{formatNumber(totalRecordCount)}</strong> records, you are about to{' '}
          <strong>delete {formatNumber(data.length)}</strong> records.
        </span>
      );
    default:
      break;
  }
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

const infoIcon = <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-right_xx-small" />;

export const LoadRecordsDataPreview: FunctionComponent<LoadRecordsDataPreviewProps> = ({
  selectedOrg,
  selectedSObject,
  data,
  header,
  loadType,
}) => {
  const isMounted = useRef(null);
  const [totalRecordCount, setTotalRecordCount] = useState<number>();
  const [columns, setColumns] = useState<ColDef[]>(null);
  const [rows, setRows] = useState<any[]>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (selectedOrg && selectedSObject) {
      (async () => {
        setLoading(true);
        setTotalRecordCount(null);
        const sobjectName = selectedSObject.name;
        const results = await query(selectedOrg, `SELECT COUNT() FROM ${sobjectName}`);
        if (!isMounted.current || selectedSObject?.name !== sobjectName) {
          return;
        }
        setTotalRecordCount(results.queryResults.totalSize);
        setLoading(false);
      })();
    } else {
      setTotalRecordCount(null);
    }
  }, [selectedOrg, selectedSObject]);

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
            <Fragment>
              {infoIcon}
              <strong>Select an object from the list on the left to continue</strong>
            </Fragment>
          )}
          {selectedSObject && !data && (
            <Fragment>
              {infoIcon}
              <strong>Upload a file to continue</strong>
            </Fragment>
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
