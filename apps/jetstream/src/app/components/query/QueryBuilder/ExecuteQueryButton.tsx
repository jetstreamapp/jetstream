import { Maybe } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent } from 'react';
import { Link } from 'react-router-dom';

interface ExecuteQueryButtonProps {
  soql: string;
  isTooling: boolean;
  selectedSObject: Maybe<DescribeGlobalSObjectResult>;
}

export const ExecuteQueryButton: FunctionComponent<ExecuteQueryButtonProps> = ({ soql, isTooling, selectedSObject }) => {
  return (
    <Fragment>
      {soql && selectedSObject && (
        <Link
          title="ctrl/command + enter"
          className="slds-button slds-button_brand"
          to="results"
          state={{
            soql,
            isTooling,
            sobject: {
              label: selectedSObject.label,
              name: selectedSObject.name,
            },
          }}
          data-testid="execute-query-button"
        >
          <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
          Execute
        </Link>
      )}
      {!soql && (
        <button className="slds-button slds-button_brand" disabled data-testid="execute-query-button">
          <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
          Execute
        </button>
      )}
    </Fragment>
  );
};

export default ExecuteQueryButton;
