import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { REGEX, groupByFlat } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, InsertUpdateUpsertDelete, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Alert, AutoFullHeightContainer, DataTable, Grid, GridCol, RowWithKey, Spinner, getColumnsForGenericTable } from '@jetstream/ui';
import { ErrorBoundaryFallback, applicationCookieState, fromLoadRecordsState, selectSkipFrontdoorAuth } from '@jetstream/ui-core';
import isNil from 'lodash/isNil';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Column } from 'react-data-grid';
import { ErrorBoundary } from 'react-error-boundary';
import { useRecoilState, useRecoilValue } from 'recoil';

const MAX_RECORD_FOR_PREVIEW = 100_000;
const MAX_COLUMNS_TO_KEEP_SET_FILTER = 2000;
const NUM_COLUMN = '_num';
const getRowId = ({ _num }: any) => _num;

export interface LoadRecordsDataPreviewProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: Maybe<DescribeGlobalSObjectResult>;
  loadType: InsertUpdateUpsertDelete;
  data: Maybe<any[]>;
  header: Maybe<string[]>;
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

function getColumnDefinitions(
  headers: {
    key: string;
    label: string;
  }[],
  numRows: number
): Column<RowWithKey>[] {
  return getColumnsForGenericTable(
    [{ key: NUM_COLUMN, label: '#', columnProps: { width: 75, filters: [] } }, ...headers],
    numRows > MAX_COLUMNS_TO_KEEP_SET_FILTER ? ['TEXT'] : undefined
  );
}

export const LoadRecordsDataPreview: FunctionComponent<LoadRecordsDataPreviewProps> = ({
  selectedOrg,
  selectedSObject,
  data,
  header,
  loadType,
}) => {
  const isMounted = useRef(true);
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontdoorLogin = useRecoilValue(selectSkipFrontdoorAuth);
  const [totalRecordCount, setTotalRecordCount] = useRecoilState(fromLoadRecordsState.loadExistingRecordCount);
  const [omitTotalRecordCount, setOmitTotalRecordCount] = useState(true);
  const [columns, setColumns] = useState<Maybe<Column<RowWithKey>[]>>(null);
  const [rows, setRows] = useState<Maybe<RowWithKey[]>>(null);
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
  }, [selectedOrg, selectedSObject, setTotalRecordCount, totalRecordCount]);

  useEffect(() => {
    if (data && header && data.length < MAX_RECORD_FOR_PREVIEW) {
      // Transform data keys if needed to ensure the table preview can be rendered
      // Special characters in the header key cause issues with react-data-grid
      let _rows = data;
      const headersWithLabel = header.map((header) => ({
        key: header.replaceAll(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '_'),
        label: header,
      }));
      const madeModifications = headersWithLabel.some((item) => item.key !== item.label);
      if (madeModifications) {
        // Replace all rows with sanitized header
        const headersByOldKey = groupByFlat(headersWithLabel, 'label');
        _rows = data.map((row) =>
          Object.keys(row).reduce((acc: Record<string, any>, field) => {
            if (headersByOldKey[field]) {
              acc[headersByOldKey[field].key] = row[field];
            }
            return acc;
          }, {})
        );
      }
      _rows = _rows.map((row, i) => ({ ...row, [NUM_COLUMN]: i + 1 }));
      setRows(_rows);
      setColumns(getColumnDefinitions(headersWithLabel, _rows.length));
    } else {
      setColumns(null);
      setRows(null);
    }
  }, [data, header]);

  const tooLargeToShowPreview = data && data.length > MAX_RECORD_FOR_PREVIEW;

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
              <div>{getLoadDescription(loadType, totalRecordCount || 0, omitTotalRecordCount, data)}</div>
            </div>
          )}
        </GridCol>
        <GridCol className="slds-is-relative">
          {tooLargeToShowPreview && <p className="slds-text-heading_small">Your file is too large to show a preview</p>}
          {Array.isArray(columns) && Array.isArray(rows) && (
            <div
              css={css`
                position: absolute;
                max-width: 100%;
                min-width: 100%;
              `}
            >
              <p className="slds-text-heading_small">File Preview</p>
              <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25}>
                  <DataTable
                    org={selectedOrg}
                    serverUrl={serverUrl}
                    skipFrontdoorLogin={skipFrontdoorLogin}
                    columns={columns}
                    data={rows}
                    getRowKey={getRowId}
                  />
                </AutoFullHeightContainer>
              </ErrorBoundary>
            </div>
          )}
        </GridCol>
      </Grid>
    </div>
  );
};

export default LoadRecordsDataPreview;
