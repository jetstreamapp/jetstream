/** @jsx jsx */
import { ICellRendererParams, IFilter, IFilterParams } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { forwardRef, Fragment, FunctionComponent, useEffect, useImperativeHandle, useRef, useState } from 'react';
import RecordDownloadModal from '../file-download-modal/RecordDownloadModal';
import CheckboxToggle from '../form/checkbox-toggle/CheckboxToggle';
import Checkbox from '../form/checkbox/Checkbox';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Modal from '../modal/Modal';
import Icon from '../widgets/Icon';
import SalesforceLogin from '../widgets/SalesforceLogin';
import './data-table-styles.scss';
import { DataTableContext, getSubqueryModalTagline, SalesforceQueryColumnDefinition, TableContext } from './data-table-utils';
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
export const SubqueryRenderer: FunctionComponent<ICellRendererParams> = ({ value, colDef, data }) => {
  const [isActive, setIsActive] = useState(false);
  const [modalTagline, setModalTagline] = useState<string>();
  const [downloadModalIsActive, setDownloadModalIsActive] = useState(false);

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

  function getRecords() {
    return value;
    // return (value as QueryResult<any>).records;
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

  if (!Array.isArray(value) || value.length === 0) {
    return <div />;
  }

  return (
    <DataTableContext.Consumer>
      {({ serverUrl, org, columnDefinitions }) => (
        <div>
          {isActive && (
            <Modal
              size="lg"
              header={colDef.field}
              tagline={modalTagline}
              closeOnBackdropClick
              onClose={handleCloseModal}
              footer={
                <button className="slds-button slds-button_brand" onClick={openDownloadModal}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Records
                </button>
              }
            >
              <div className="slds-scrollable_x">
                <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
                  <DataTable
                    serverUrl={serverUrl}
                    org={org}
                    columns={getColumns(columnDefinitions)}
                    data={getRecords()}
                    agGridProps={{
                      rowSelection: null,
                      immutableData: true,
                      // getRowNodeId, // TODO: get attributes fom child record // return data?.attributes?.url || data.Id || Object.keys(data)[0];
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
              records={value}
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

export const IdLinkRenderer: FunctionComponent<ICellRendererParams> = ({ value }) => {
  return (
    <div className="slds-truncate" title={`${value}`}>
      <SalesforceLogin serverUrl={_serverUrl} org={_org} returnUrl={`/${value}`} omitIcon>
        {value}
      </SalesforceLogin>
    </div>
  );
};

export const ActionRenderer: FunctionComponent<ICellRendererParams> = ({ node, context }) => {
  const { actions } = context as TableContext;
  return (
    <Fragment>
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
  return <Checkbox id={`${colDef.field}-${node.id}`} checked={value} label="value" hideLabel readOnly />;
};

// FILTER RENDERERS

export const BooleanFilterRenderer = forwardRef<any, IFilterParams>(({ filterChangedCallback, valueGetter, colDef }, ref) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [value, setValue] = useState(true);
  const refInput = useRef(null);
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
