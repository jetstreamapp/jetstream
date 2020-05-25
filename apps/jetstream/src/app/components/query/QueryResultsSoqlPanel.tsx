/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent, useEffect, useState } from 'react';
import { Panel } from '@silverthorn/ui';
import { Textarea } from '@silverthorn/ui';
import { useHotkeys } from 'react-hotkeys-hook';
import { Icon } from '@silverthorn/ui';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsSoqlPanelProps {
  soql: string;
  isOpen: boolean;
  onClosed: () => void;
  executeQuery: (soql: string) => void;
}

export const QueryResultsSoqlPanel: FunctionComponent<QueryResultsSoqlPanelProps> = ({ soql, isOpen, onClosed, executeQuery }) => {
  const [userSoql, setUserSoql] = useState<string>(soql);
  useHotkeys('ctrl+enter, cmd+enter', submitQuery, { enableOnTags: ['TEXTAREA'] }, [soql, userSoql]);

  useEffect(() => {
    setUserSoql(soql);
  }, [soql]);

  function submitQuery() {
    executeQuery(userSoql);
  }

  return (
    <Panel heading="SOQL Query" isOpen={isOpen} size="lg" fullHeight={false} position="left" onClosed={onClosed}>
      <Textarea id="soql" label="SOQL Query">
        <textarea className="slds-textarea" rows={15} value={userSoql} onChange={(event) => setUserSoql(event.target.value)} />
      </Textarea>
      <div className="slds-grid slds-grid_align-end">
        <button type="submit" className="slds-button slds-button_brand" onClick={() => submitQuery()}>
          <Icon type="utility" icon="play" className="slds-button__icon slds-button__icon_left" omitContainer />
          Execute Query
        </button>
      </div>
    </Panel>
  );
};

export default QueryResultsSoqlPanel;
