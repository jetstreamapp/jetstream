/** @jsx jsx */
import { ICellRendererParams, IFilter, IFilterParams, IFloatingFilter, IFloatingFilterParams } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { queryMore } from '@jetstream/shared/data';
import { formatNumber, transformTabularDataToExcelStr } from '@jetstream/shared/ui-utils';
import { flattenRecords } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import copyToClipboard from 'copy-to-clipboard';
import { QueryResult } from 'jsforce';
import Grid from 'libs/ui/src/lib/grid/Grid';
import Spinner from 'libs/ui/src/lib/widgets/Spinner';
import { isFunction, uniqueId } from 'lodash';
import { forwardRef, Fragment, FunctionComponent, MouseEvent, useEffect, useImperativeHandle, useRef, useState } from 'react';
import RecordDownloadModal from '../file-download-modal/RecordDownloadModal';
import CheckboxToggle from '../form/checkbox-toggle/CheckboxToggle';
import Checkbox from '../form/checkbox/Checkbox';
import Input from '../form/input/Input';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Modal from '../modal/Modal';
import CopyToClipboard from '../widgets/CopyToClipboard';
import Icon from '../widgets/Icon';
import SalesforceLogin from '../widgets/SalesforceLogin';
import './data-table-styles.scss';
import {
  DataTableContext,
  getSfdcRetUrl,
  getSubqueryModalTagline,
  SalesforceQueryColumnDefinition,
  TableContext,
} from './data-table-utils';
import DataTable from './DataTable';

// CONFIGURATION

let _serverUrl: string;
let _org: SalesforceOrgUi;

export function configIdLinkRenderer(serverUrl: string, org: SalesforceOrgUi) {
  if (_serverUrl !== serverUrl) {
    _serverUrl = serverUrl;
  }
  if (_org !== org) {
    _org = org;
  }
}

// CELL RENDERERS
export const SubqueryRenderer: FunctionComponent<ICellRendererParams> = ({ colDef, data, value }) => {
  const isMounted = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [modalTagline, setModalTagline] = useState<string>();
  const [downloadModalIsActive, setDownloadModalIsActive] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [{ records, done, nextRecordsUrl, totalSize }, setQueryResults] = useState<QueryResult<unknown>>(data[colDef.field] || {});

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  // const {serverUrl, org, columnsDefinition} = context as DataTableContextValue;

  function handleViewData() {
    if (isActive) {
      setIsActive(false);
    } else {
      if (!modalTagline) {
        setModalTagline(getSubqueryModalTagline(data));
      }
      setIsActive(true);
    }
  }

  function getColumns(columnDefinitions: SalesforceQueryColumnDefinition) {
    return columnDefinitions.subqueryColumns[colDef.field];
  }

  function getFields(columnDefinitions: SalesforceQueryColumnDefinition) {
    return getColumns(columnDefinitions)
      .filter((column) => column.field)
      .map((column) => column.field);
  }

  function handleCloseModal(cancelled?: boolean) {
    if (typeof cancelled === 'boolean' && cancelled) {
      setIsActive(true);
      setDownloadModalIsActive(false);
    } else {
      setIsActive(false);
      setDownloadModalIsActive(false);
    }
  }

  function openDownloadModal() {
    setIsActive(false);
    setDownloadModalIsActive(true);
  }

  function handleCopyToClipboard(columnDefinitions: SalesforceQueryColumnDefinition) {
    const fields = getFields(columnDefinitions);
    const flattenedData = flattenRecords(records, fields);
    copyToClipboard(transformTabularDataToExcelStr(flattenedData, fields), { format: 'text/plain' });
  }

  async function loadMore(org: SalesforceOrgUi, isTooling: boolean) {
    try {
      setIsLoadingMore(true);
      const results = await queryMore(org, nextRecordsUrl, isTooling);
      if (!isMounted.current) {
        return;
      }
      results.queryResults.records = records.concat(results.queryResults.records);
      setQueryResults(results.queryResults);
      setIsLoadingMore(false);
    } catch (ex) {
      if (!isMounted.current) {
        return;
      }
      setIsLoadingMore(false);
    }
  }

  function getRowNodeId(data: any): string {
    if (data?.attributes?.type === 'AggregateResult') {
      return uniqueId('query-results-node-id');
    }
    let nodeId = data?.attributes?.url || data.Id;
    if (!nodeId) {
      nodeId = uniqueId('query-results-node-id');
    }
    return nodeId;
  }

  if (!Array.isArray(value) || value.length === 0) {
    return <div />;
  }

  return (
    <DataTableContext.Consumer>
      {({ serverUrl, org, columnDefinitions, isTooling }) => (
        <div>
          {isActive && (
            <Modal
              size="lg"
              header={colDef.field}
              tagline={modalTagline}
              closeOnBackdropClick
              onClose={handleCloseModal}
              footerClassName="slds-is-relative"
              footer={
                <Grid align="spread" verticalAlign="end">
                  <Grid verticalAlign="end">
                    <span className="slds-m-right_small">
                      Showing {formatNumber(records.length)} of {formatNumber(totalSize)} records
                    </span>
                    {!done && (
                      <button className="slds-button slds-button_neutral" onClick={() => loadMore(org, isTooling)}>
                        Load More
                      </button>
                    )}
                    {isLoadingMore && <Spinner />}
                  </Grid>
                  <div>
                    <button
                      className="slds-button slds-button_neutral"
                      onClick={() => handleCopyToClipboard(columnDefinitions)}
                      title="Copy the queried records to the clipboard. The records can then be pasted into a spreadsheet."
                    >
                      <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Copy to Clipboard
                    </button>
                    <button className="slds-button slds-button_brand" onClick={openDownloadModal}>
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Download Records
                    </button>
                  </div>
                </Grid>
              }
            >
              <div className="slds-scrollable_x">
                <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
                  <DataTable
                    serverUrl={serverUrl}
                    org={org}
                    columns={getColumns(columnDefinitions)}
                    data={records}
                    agGridProps={{
                      rowSelection: null,
                      immutableData: true,
                      getRowNodeId: (data) => getRowNodeId(data),
                      suppressMenuHide: true,
                      headerHeight: 25,
                      gridOptions: {
                        defaultColDef: {
                          filter: true,
                          sortable: true,
                          resizable: true,
                        },
                      },
                    }}
                  />
                </AutoFullHeightContainer>
              </div>
            </Modal>
          )}
          {downloadModalIsActive && (
            <RecordDownloadModal
              org={org}
              downloadModalOpen
              fields={getFields(columnDefinitions)}
              records={records}
              onModalClose={handleCloseModal}
            />
          )}
          <button className="slds-button" onClick={handleViewData}>
            <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
            View Data
          </button>
        </div>
      )}
    </DataTableContext.Consumer>
  );
};

export const ComplexDataRenderer: FunctionComponent<ICellRendererParams> = ({ value, colDef, data }) => {
  const [isActive, setIsActive] = useState(false);
  const [jsonValue] = useState(JSON.stringify(value || '', null, 2));

  function handleViewData() {
    if (isActive) {
      setIsActive(false);
    } else {
      setIsActive(true);
    }
  }

  function handleCloseModal(cancelled?: boolean) {
    if (typeof cancelled === 'boolean' && cancelled) {
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }

  return (
    <div>
      {isActive && (
        <Modal
          size="lg"
          header={colDef.field}
          closeOnBackdropClick
          onClose={handleCloseModal}
          footer={<CopyToClipboard type="button" className="slds-button_neutral" content={jsonValue} />}
        >
          <pre>
            <code>{jsonValue}</code>
          </pre>
        </Modal>
      )}
      <button className="slds-button" onClick={handleViewData}>
        <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
        View Data
      </button>
    </div>
  );
};

export const IdLinkRenderer: FunctionComponent<ICellRendererParams> = ({ value, data, colDef }) => {
  const { skipFrontDoorAuth, url } = colDef.field === 'Id' ? getSfdcRetUrl(value, data) : { skipFrontDoorAuth: false, url: `/${value}` };
  return (
    <div className="slds-truncate" title={`${value}`}>
      <SalesforceLogin serverUrl={_serverUrl} org={_org} returnUrl={url} skipFrontDoorAuth={skipFrontDoorAuth} omitIcon>
        {value}
      </SalesforceLogin>
    </div>
  );
};

export const ActionRenderer: FunctionComponent<ICellRendererParams> = ({ node, context }) => {
  const { actions } = context as TableContext;
  return (
    <Fragment>
      <button className="slds-button slds-button_icon" title="View Full Record" onClick={() => actions.view(node.data)}>
        <Icon type="utility" icon="preview" className="slds-button__icon " omitContainer />
      </button>
      <button className="slds-button slds-button_icon" title="Edit Record" onClick={() => actions.edit(node.data)}>
        <Icon type="utility" icon="edit" className="slds-button__icon " omitContainer />
      </button>
      <button className="slds-button slds-button_icon" title="Clone Record" onClick={() => actions.clone(node.data)}>
        <Icon type="utility" icon="copy" className="slds-button__icon " omitContainer />
      </button>
    </Fragment>
  );
};

export const BooleanRenderer: FunctionComponent<ICellRendererParams> = ({ value, node, column, colDef }) => {
  return (
    <Checkbox className="slds-align_absolute-center" id={`${colDef.field}-${node.id}`} checked={value} label="value" hideLabel readOnly />
  );
};

/**
 * This component shows an optional additional component
 */
export const BooleanEditableRenderer: FunctionComponent<ICellRendererParams> = ({ value, node, column, colDef, context }) => {
  let isReadOnly = false;
  let additionalComponent;
  if (isFunction(context.isReadOnly)) {
    isReadOnly = context.isReadOnly({ value, node, column, colDef });
  }
  if (isFunction(context.additionalComponent)) {
    additionalComponent = context.additionalComponent({ value, node, column, colDef });
  }
  const colId = column.getColId();
  function setValue(event: MouseEvent<HTMLDivElement>) {
    if (!isReadOnly) {
      event.preventDefault();
      event.stopPropagation();
      node.setDataValue(colId, !value);
    }
  }

  return (
    <div className="slds-align_absolute-center" onClick={setValue}>
      <Checkbox id={`${node.id}-${colId}`} checked={value} label="value" hideLabel readOnly={isReadOnly} />
      {additionalComponent && additionalComponent}
    </div>
  );
};

// value is blank, so this is pretty specific for the use-case
export const FullWidthRenderer: FunctionComponent<ICellRendererParams> = ({ value, node, column, colDef }) => {
  return <div className="slds-align_absolute-center slds-text-heading_medium bg-background-selection">{node.data.label}</div>;
};

// FILTER RENDERERS

interface FilterWithFloatingFilterCallback extends IFilter {
  onFloatingFilterValueChanged(value: string): void;
}

export const BasicTextFilterRenderer = forwardRef<any, IFilterParams>(({ filterChangedCallback, valueGetter }, ref) => {
  const [value, setValue] = useState('');
  useEffect(() => {
    filterChangedCallback();
  }, [value]);
  useImperativeHandle(ref, () => {
    const filterComp: FilterWithFloatingFilterCallback = {
      onFloatingFilterValueChanged(currValue: string) {
        setValue(currValue || '');
      },

      isFilterActive() {
        return !!value;
      },

      doesFilterPass({ node }) {
        return (
          node.isFullWidthCell() ||
          value
            .toLowerCase()
            .split(' ')
            .every((word) => `${valueGetter(node)}`.toLowerCase().includes(word))
        );
      },

      getModel() {
        return { value };
      },

      setModel(model) {
        setValue(model ? model.value : '');
      },
    };
    return filterComp;
  });

  return (
    <div>
      <div className="slds-m-around_x-small">
        <Input>
          <input className="slds-input" placeholder="Filter..." value={value || ''} onChange={(event) => setValue(event.target.value)} />
        </Input>
      </div>
      <hr className="slds-m-vertical_none" />
      <div className="slds-grid slds-grid_align-end">
        <button className="slds-button slds-button_neutral slds-m-around_x-small" onClick={() => setValue('')}>
          Reset
        </button>
      </div>
    </div>
  );
});

/**
 * This requires BasicTextFilterRenderer to be set as the normal filter for the row
 */
export const BasicTextFloatingFilterRenderer = forwardRef<any, IFloatingFilterParams>(({ parentFilterInstance }, ref) => {
  const [value, setValue] = useState('');
  useEffect(() => {
    parentFilterInstance((instance) => {
      instance.getFrameworkComponentInstance().onFloatingFilterValueChanged(value);
    });
  }, [value]);
  useImperativeHandle(ref, () => {
    const filterComp: IFloatingFilter = {
      onParentModelChanged(parentModel) {
        setValue(parentModel?.value || '');
      },
    };
    return filterComp;
  });

  return (
    <div className="slds-m-around_x-small">
      <Input clearButton={!!value} onClear={() => setValue('')}>
        <input className="slds-input" placeholder="Filter..." value={value} onChange={(event) => setValue(event.target.value)} />
      </Input>
    </div>
  );
});

export const BooleanFilterRenderer = forwardRef<any, IFilterParams>(({ filterChangedCallback, valueGetter, colDef }, ref) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [value, setValue] = useState(true);
  useEffect(() => {
    filterChangedCallback();
  }, [isEnabled, value]);

  useImperativeHandle(ref, () => {
    const filterComp: IFilter = {
      isFilterActive() {
        return isEnabled;
      },

      doesFilterPass(params) {
        return valueGetter(params.node) === value;
      },

      getModel() {
        return { value };
      },

      setModel(model) {
        setValue(model ? model.value : true);
      },
    };
    return filterComp;
  });

  return (
    <div className="slds-p-around_x-small">
      <CheckboxToggle
        id={`filter-enabled-${colDef.field}`}
        label="Enable Filter"
        onText="Enabled"
        offText="Disabled"
        labelPosition="right"
        checked={isEnabled}
        onChange={setIsEnabled}
      />
      <Checkbox id={`filter-${colDef.field}`} checked={value} label="Filter by Values" disabled={!isEnabled} onChange={setValue} />
    </div>
  );
});
