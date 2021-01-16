/** @jsx jsx */
import { jsx } from '@emotion/react';
import { CheckboxToggle, CodeEditor, Icon, Panel, Textarea } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsSoqlPanelProps {
  soql: string;
  isTooling: boolean;
  isOpen: boolean;
  onClosed: () => void;
  executeQuery: (soql: string, isTooling: boolean) => void;
}

export const QueryResultsSoqlPanel: FunctionComponent<QueryResultsSoqlPanelProps> = ({
  soql,
  isTooling,
  isOpen,
  onClosed,
  executeQuery,
}) => {
  const [userSoql, setUserSoql] = useState<string>(soql);
  const [userTooling, setUserTooling] = useState<boolean>(isTooling);
  useHotkeys('ctrl+enter, cmd+enter', submitQuery, { enableOnTags: ['TEXTAREA'] }, [soql, userSoql]);

  useEffect(() => {
    setUserSoql(soql);
  }, [soql]);

  useEffect(() => {
    setUserTooling(isTooling);
  }, [isTooling]);

  function submitQuery() {
    executeQuery(userSoql, userTooling);
  }

  return (
    <Panel heading="SOQL Query" isOpen={isOpen} size="lg" fullHeight={false} position="left" onClosed={onClosed}>
      <Textarea id="soql" label="SOQL Query">
        <CodeEditor className="CodeMirror-textarea" value={userSoql} onChange={setUserSoql} />
      </Textarea>
      <div className="slds-grid slds-grid_align-spread slds-m-top--small">
        <CheckboxToggle
          id="is-tooling-user-soql"
          label="Query Type"
          onText="Metadata Query"
          offText="Object Query"
          hideLabel
          checked={userTooling}
          onChange={setUserTooling}
        />
        <button type="submit" className="slds-button slds-button_brand" onClick={() => submitQuery()}>
          <Icon type="utility" icon="play" className="slds-button__icon slds-button__icon_left" omitContainer />
          Execute Query
        </button>
      </div>
    </Panel>
  );
};

export default QueryResultsSoqlPanel;
