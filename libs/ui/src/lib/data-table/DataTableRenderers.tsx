/** @jsx jsx */
import { jsx } from '@emotion/core';
import { ICellRendererParams, IFilter, IFilterComp, IFilterParams } from 'ag-grid-community';
import { forwardRef, FunctionComponent, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SalesforceOrgUi } from '@jetstream/types';
import Icon from '../widgets/Icon';
import SalesforceLogin from '../widgets/SalesforceLogin';
import './data-table-styles.scss';
import Checkbox from '../form/checkbox/Checkbox';
import CheckboxToggle from '../form/checkbox-toggle/CheckboxToggle';

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

export const SubqueryRenderer: FunctionComponent<ICellRendererParams> = ({ value }) => {
  if (!Array.isArray(value) || value.length === 0) {
    return <div />;
  }
  return (
    <div>
      <button className="slds-button">
        <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
        View Data
      </button>
    </div>
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
