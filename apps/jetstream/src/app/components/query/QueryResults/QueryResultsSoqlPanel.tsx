/** @jsx jsx */
import { jsx } from '@emotion/react';
import { CheckboxToggle, CodeEditor, Icon, Panel, Textarea } from '@jetstream/ui';
import { Editor } from 'codemirror';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

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
  const editorInstance = useRef<Editor>();
  const [userSoql, setUserSoql] = useState<string>(soql);
  const [userTooling, setUserTooling] = useState<boolean>(isTooling);

  useEffect(() => {
    setUserSoql(soql);
  }, [soql]);

  useEffect(() => {
    setUserTooling(isTooling);
  }, [isTooling]);

  function submitQuery() {
    executeQuery(userSoql, userTooling);
  }

  // this appears to get called on every keypress :sob:
  function handleOnEditorInstance(editor: Editor) {
    editorInstance.current = editor;
    if (!editorInstance.current.hasFocus()) {
      editorInstance.current.focus();
      editorInstance.current.setCursor(0, 0);
    }
  }

  return (
    <Panel heading="SOQL Query" isOpen={isOpen} size="lg" fullHeight={false} position="left" onClosed={onClosed}>
      <Textarea id="soql" label="SOQL Query">
        <CodeEditor
          className="CodeMirror-textarea"
          options={{
            extraKeys: {
              'Alt-Enter': submitQuery,
              'Meta-Enter': submitQuery,
            },
          }}
          value={userSoql}
          onChange={setUserSoql}
          onInstance={handleOnEditorInstance}
        />
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
