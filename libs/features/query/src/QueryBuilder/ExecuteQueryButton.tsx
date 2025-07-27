import { DescribeGlobalSObjectResult, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Icon, KeyboardShortcut, Tooltip, getModifierKey } from '@jetstream/ui';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';

interface ExecuteQueryButtonProps {
  soql: string;
  isTooling: boolean;
  selectedSObject: Maybe<DescribeGlobalSObjectResult>;
  selectedOrg: SalesforceOrgUi;
}

export const ExecuteQueryButton: FunctionComponent<ExecuteQueryButtonProps> = ({ soql, isTooling, selectedOrg, selectedSObject }) => {
  function handleClick() {
    if (!selectedSObject) {
      return;
    }
    recentHistoryItemsDb.addItemToRecentHistoryItems(selectedOrg.uniqueId, 'sobject', [selectedSObject.name]);
  }

  return (
    <>
      {soql && selectedSObject && (
        <Tooltip
          openDelay={300}
          content={
            <div className="slds-p-bottom_small">
              <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
            </div>
          }
        >
          <Link
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
            onClick={handleClick}
          >
            <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
            Execute
          </Link>
        </Tooltip>
      )}
      {!soql && (
        <button className="slds-button slds-button_brand" disabled data-testid="execute-query-button">
          <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
          Execute
        </button>
      )}
    </>
  );
};

export default ExecuteQueryButton;
