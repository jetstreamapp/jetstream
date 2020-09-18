/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, query } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Icon, Page, PageHeader, PageHeaderActions, PageHeaderRow, PageHeaderTitle, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Column } from 'react-table';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromAutomationCtlState from './automation-control.state';
import AutomationControlTable from './AutomationControlTable';
import {
  AutomationControlRow,
  AutomationControlRowMetadata,
  AutomationControlRowMetadataItem,
  AutomationControlRowSobject,
} from './temp-types';

const HEIGHT_BUFFER = 170;
const SUB_ROW_PLACEHOLDER = 'SUB_ROW_PLACEHOLDER';

function getColumns(): Column[] {
  const columns: Column[] = [
    {
      accessor: 'name',
      Header: 'Name', // sobject for top level rows, metadata type for second subrows, and item name for third subrows
      Cell: ({ row, cell }) => {
        if (row.canExpand) {
          return (
            <Fragment>
              <button
                {...row.getToggleRowExpandedProps()}
                className="slds-button slds-button_icon slds-button_icon-x-small slds-m-right_x-small"
                aria-hidden="true"
                tabIndex={-1}
                title={row.id}
              >
                <Icon type="utility" icon="chevronright" omitContainer className="slds-button__icon slds-button__icon_small" />
                <span className="slds-assistive-text">Expand {row.id}</span>
              </button>
              <div className="slds-truncate" title={cell.value}>
                {cell.value}
              </div>
            </Fragment>
          );
        } else if (cell.value === SUB_ROW_PLACEHOLDER) {
          // show loading indicator
          // TODO: fetch metadata and update it somehow
          return (
            <div
              css={css`
                min-height: 25px;
              `}
            >
              <Spinner size="x-small" />
            </div>
          );
        } else {
          return (
            <div className="slds-truncate" title={cell.value}>
              {cell.value}
            </div>
          );
        }
      },
    },
    {
      accessor: 'Description',
      Header: 'description',
    },
    {
      accessor: 'errorMessage',
      Header: 'Error Message',
    },
    {
      accessor: 'value',
      Header: 'Value',
    },
    {
      accessor: 'status',
      Header: 'Status',
    },
    {
      accessor: 'progress',
      Header: 'Progress',
    },
  ];

  return columns;
}

function getInitialRows(
  sobjects: DescribeGlobalSObjectResult[],
  grandchildRowsByKey: MapOf<AutomationControlRowMetadataItem[]>
): AutomationControlRowSobject[] {
  return sobjects.map(
    (sobject): AutomationControlRowSobject => ({
      key: sobject.name,
      name: sobject.label,
      subRows: getInitialSubRows(sobject.name, grandchildRowsByKey),
      _isDirty: false,
      _meta: { sobject: sobject.name },
    })
  );
}

function getInitialSubRows(
  sobject: string,
  grandchildRowsByKey: MapOf<AutomationControlRowMetadataItem[]>
): AutomationControlRowMetadata[] {
  return [
    {
      key: `${sobject}-ValidationRule`,
      name: 'Validation Rules',
      subRows: grandchildRowsByKey[`${sobject}-ValidationRule`]
        ? grandchildRowsByKey[`${sobject}-ValidationRule`]
        : [
            {
              key: `${sobject}-ValidationRule.${SUB_ROW_PLACEHOLDER}`,
              name: SUB_ROW_PLACEHOLDER,
              _isDirty: false,
              _meta: {
                sobject,
                metadataType: 'ValidationRule',
              },
            },
          ],
      _isDirty: false,
      _meta: { sobject, metadataType: 'ValidationRule' },
    },
    {
      key: `${sobject}-WorkflowRule`,
      name: 'Workflow Rules',
      subRows: grandchildRowsByKey[`${sobject}-WorkflowRule`]
        ? grandchildRowsByKey[`${sobject}-WorkflowRule`]
        : [
            {
              key: `${sobject}-WorkflowRule.${SUB_ROW_PLACEHOLDER}`,
              name: SUB_ROW_PLACEHOLDER,
              _isDirty: false,
              _meta: {
                sobject,
                metadataType: 'WorkflowRule',
              },
            },
          ],
      _isDirty: false,
      _meta: { sobject, metadataType: 'WorkflowRule' },
    },
    {
      key: `${sobject}-Flow`,
      name: 'Process Builders (IMPOSSIBLE PER OBJ)',
      subRows: grandchildRowsByKey[`${sobject}-Flow`]
        ? grandchildRowsByKey[`${sobject}-Flow`]
        : [
            {
              key: `${sobject}-Flow.${SUB_ROW_PLACEHOLDER}`,
              name: SUB_ROW_PLACEHOLDER,
              _isDirty: false,
              _meta: {
                sobject,
                metadataType: 'Flow',
              },
            },
          ],
      _isDirty: false,
      _meta: { sobject, metadataType: 'Flow' },
    },
    {
      key: `${sobject}-ApexTrigger`,
      name: 'Apex Triggers',
      subRows: grandchildRowsByKey[`${sobject}-ApexTrigger`]
        ? grandchildRowsByKey[`${sobject}-ApexTrigger`]
        : [
            {
              key: `${sobject}-ApexTrigger.${SUB_ROW_PLACEHOLDER}`,
              name: SUB_ROW_PLACEHOLDER,
              _isDirty: false,
              _meta: {
                sobject,
                metadataType: 'ApexTrigger',
              },
            },
          ],
      _isDirty: false,
      _meta: { sobject, metadataType: 'ApexTrigger' },
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControl2Props {}

export const AutomationControl2: FunctionComponent<AutomationControl2Props> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);
  // TODO: reset when org changes
  const [sobjects, setSobjects] = useRecoilState(fromAutomationCtlState.sObjectsState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);

  // TODO: this can be majorly improved
  const [rows, setRows] = useState<AutomationControlRowSobject[]>([]);
  // right now this is not even being used - but we should flatten all rows and then rebuild this into array when it changes
  const [rowsByKey, setRowsByKey] = useState<MapOf<AutomationControlRowMetadataItem[]>>({});

  const memoizedColumns: Column<any>[] = useMemo<any>(() => getColumns(), []);
  const memoizedRows: AutomationControlRow[] = useMemo(() => rows, [rows]);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      (async () => {
        setLoading(true);
        try {
          const results = await describeGlobal(selectedOrg);
          setSobjects(orderObjectsBy(results.sobjects.filter(filterSobjectFn), 'label'));
        } catch (ex) {
          logger.error(ex);
          setErrorMessage(ex.message);
        }
        setLoading(false);
      })();
    }
  }, [selectedOrg, loading, errorMessage, sobjects, setSobjects]);

  useEffect(() => {
    if (sobjects) {
      const initRows = getInitialRows(sobjects, rowsByKey);
      const initRowsByKey = initRows.reduce((output: MapOf<AutomationControlRowMetadataItem[]>, row: AutomationControlRowSobject) => {
        row.subRows.forEach((metadataTypeRow: AutomationControlRowMetadata) => {
          output[
            `${row._meta.sobject}-${metadataTypeRow._meta.metadataType}`
          ] = metadataTypeRow.subRows as AutomationControlRowMetadataItem[];
        });
        return output;
      }, {});
      setRows(initRows);
      setRowsByKey(initRowsByKey);
    }
  }, [sobjects]);

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return sobject.queryable && !sobject.name.endsWith('CleanInfo') && !sobject.name.endsWith('share') && !sobject.name.endsWith('history');
  }

  async function handleFetchMetadata(rowsThatNeedData: AutomationControlRowMetadataItem[]) {
    // // TODO:
    // if (rowsThatNeedData[0]._meta.metadataType === 'ValidationRule') {
    //   updateLoadingMetadataItem(rowsThatNeedData[0], true);
    //   const { sobject, metadataType } = rowsThatNeedData[0]._meta;
    //   const soql = `
    //     SELECT Id, EntityDefinitionId, ValidationName, Active, Description, ErrorMessage,
    //     CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name
    //     FROM ValidationRule
    //     WHERE NamespacePrefix = null
    //     AND EntityDefinitionId = ${sobject}
    //     ORDER BY ValidationName
    //   `;
    //   // FIXME: we might need to use metadata api for this (readMetadata) to get the error message
    //   // or maybe user can toggle to fetch extra stuff if they need it
    //   // or we could count() then use collection api to fetch with offset to get all items
    //   const results = await query(selectedOrg, soql, true);
    //   const newRows = results.queryResults.records.map(
    //     (record): AutomationControlRowMetadataItem => ({
    //       key: `${sobject}-${metadataType}-${record.EntityDefinitionId}.${record.ValidationName}`,
    //       name: record.ValidationName,
    //       description: record.Description,
    //       errorMessage: record.ErrorMessage,
    //       value: '<todo>',
    //       status: record.Active || false,
    //       progress: '',
    //       _loadingData: false,
    //       _isDirty: false,
    //       _meta: {
    //         sobject,
    //         metadataType,
    //         record,
    //       },
    //     })
    //   );
    //   updateMetadataItemRows(sobject, metadataType, newRows);
    // }
  }

  function updateLoadingMetadataItem(rowThatNeedsData: AutomationControlRowMetadataItem, loadingData: boolean) {
    const clonedRows = [...rows];
    clonedRows.map((sobjectRow: AutomationControlRowSobject) => {
      let outputSobjectRow = sobjectRow;
      if (sobjectRow._meta.sobject === rowThatNeedsData._meta.sobject) {
        outputSobjectRow = { ...sobjectRow, subRows: [...sobjectRow.subRows] };
        outputSobjectRow.subRows.map((metadataRow: AutomationControlRowMetadata) => {
          let outputMetadataRow = metadataRow;
          if (metadataRow._meta.metadataType === rowThatNeedsData._meta.metadataType) {
            outputMetadataRow = { ...metadataRow, subRows: [...metadataRow.subRows] };
            metadataRow.subRows = [...metadataRow.subRows];
            metadataRow.subRows.forEach((metadataItemRow: AutomationControlRowMetadataItem) => {
              let outputMetadataItemRow = metadataItemRow;
              if (metadataItemRow.key === rowThatNeedsData.key) {
                outputMetadataItemRow = { ...metadataItemRow, _loadingData: loadingData };
              }
              return outputMetadataItemRow;
            });
          }
          return outputMetadataRow;
        });
      }
      return outputSobjectRow;
    });
    setRows(clonedRows);
  }

  function updateMetadataItemRows(sobject: string, metadataType: string, newRows: AutomationControlRowMetadataItem[]) {
    const clonedRows = [...rows];
    clonedRows.map((sobjectRow: AutomationControlRowSobject) => {
      let outputSobjectRow = sobjectRow;
      if (sobjectRow._meta.sobject === sobject) {
        outputSobjectRow = { ...sobjectRow, subRows: [...sobjectRow.subRows] };
        outputSobjectRow.subRows.map((metadataRow: AutomationControlRowMetadata) => {
          let outputMetadataRow = metadataRow;
          if (metadataRow._meta.metadataType === metadataType) {
            outputMetadataRow = { ...metadataRow, subRows: [...metadataRow.subRows] };
            metadataRow.subRows = newRows;
          }
          return outputMetadataRow;
        });
      }
      return outputSobjectRow;
    });
    setRows(clonedRows);
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'activations' }} label="Automation Control" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button className={classNames('slds-button slds-button_neutral')} title="Enable All">
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              Enable All
            </button>
            <button className={classNames('slds-button slds-button_neutral')} title="Disable All">
              <Icon type="utility" icon="dash" className="slds-button__icon slds-button__icon_left" omitContainer />
              Disable All
            </button>
            <button className="slds-button slds-button_brand">
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
              Deploy Changes
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER} fillHeight>
        {loading && <Spinner />}
        <AutomationControlTable columns={memoizedColumns} data={memoizedRows} fetchMetadata={handleFetchMetadata} />
      </AutoFullHeightContainer>
    </Page>
  );
};

export default AutomationControl2;
