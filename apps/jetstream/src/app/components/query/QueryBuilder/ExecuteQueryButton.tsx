import { Icon } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';

interface ExecuteQueryButtonProps {
  soql: string;
  isTooling: boolean;
  selectedSObject: DescribeGlobalSObjectResult;
}

export const ExecuteQueryButton: FunctionComponent<ExecuteQueryButtonProps> = ({ soql, isTooling, selectedSObject }) => {
  const match = useRouteMatch();
  return (
    <Fragment>
      {soql && selectedSObject && (
        <Link
          title="ctrl/command + enter"
          className="slds-button slds-button_brand"
          to={{
            pathname: `${match.url}/results`,
            state: {
              soql,
              isTooling,
              sobject: {
                label: selectedSObject.label,
                name: selectedSObject.name,
              },
            },
          }}
        >
          <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
          Execute
        </Link>
      )}
      {!soql && (
        <button className="slds-button slds-button_brand" disabled>
          <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
          Execute
        </button>
      )}
    </Fragment>
  );
};

export default ExecuteQueryButton;
