/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { CheckboxToggle, CodeEditor, Grid, Icon, Panel, Textarea, Tooltip } from '@jetstream/ui';
import { Editor } from 'codemirror';
import { FunctionComponent, useEffect, useReducer, useRef, useState } from 'react';
import { formatQuery, isQueryValid } from 'soql-parser-js';

type Action =
  | { type: 'VALIDATE_SOQL'; payload: { soql: string } }
  | { type: 'FORMAT_SOQL'; payload: { soql: string } }
  | { type: 'RESET_FORMAT' };

interface State {
  formattedSoql?: string;
  isValid: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'VALIDATE_SOQL':
      if (action.payload.soql) {
        return { ...state, isValid: isQueryValid(action.payload.soql) };
      }
      return { ...state, isValid: true };
    case 'FORMAT_SOQL':
      if (action.payload.soql) {
        try {
          return { ...state, formattedSoql: formatQuery(action.payload.soql, { fieldMaxLineLength: 80 }) };
        } catch (ex) {
          return { ...state, isValid: false };
        }
      }
      return { ...state, formattedSoql: action.payload.soql };
    case 'RESET_FORMAT':
      return { isValid: state.isValid };
    default:
      throw new Error('Invalid action');
  }
}

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
  const [{ formattedSoql, isValid }, dispatch] = useReducer(reducer, { formattedSoql: soql, isValid: true });

  const debouncedSoql = useDebounce(userSoql);

  useEffect(() => {
    setUserSoql(soql);
  }, [soql]);

  useEffect(() => {
    dispatch({ type: 'VALIDATE_SOQL', payload: { soql: debouncedSoql } });
  }, [debouncedSoql]);

  useEffect(() => {
    if (formattedSoql) {
      setUserSoql(formattedSoql);
      dispatch({ type: 'RESET_FORMAT' });
    }
  }, [formattedSoql]);

  useEffect(() => {
    setUserTooling(isTooling);
  }, [isTooling]);

  function handleFormat() {
    dispatch({ type: 'FORMAT_SOQL', payload: { soql: userSoql } });
  }

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
      <Textarea
        id="soql"
        labelClassName="w-100"
        label={
          <Grid align="spread">
            <div>
              <span>SOQL Query</span>
              {!isValid && (
                <Tooltip id="tooltip-query-error" content="Your query does not appear to be valid.">
                  <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small slds-m-left_small" />
                </Tooltip>
              )}
            </div>
            <span>
              <button
                className="slds-button slds-text-link_reset slds-text-link"
                title="Format soql query"
                disabled={!isValid}
                onClick={handleFormat}
              >
                format
              </button>
            </span>
          </Grid>
        }
      >
        <CodeEditor
          className="CodeMirror-textarea"
          options={{
            tabSize: 2,
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
