/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { CheckboxToggle, Grid, Icon, Panel, Textarea, Tooltip } from '@jetstream/ui';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
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
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
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

  function submitQuery(currSoql?: string) {
    currSoql = currSoql || userSoql;
    executeQuery(currSoql, userTooling);
  }

  const handleEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    editorRef.current.addAction({
      id: 'modifier-enter',
      label: 'Submit',
      keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
      run: (currEditor) => {
        submitQuery(currEditor.getValue());
      },
    });
    editorRef.current.addAction({
      id: 'format',
      label: 'Format',
      keybindings: [monaco?.KeyMod.Shift | monaco?.KeyMod.Alt | monaco?.KeyCode.KEY_F],
      contextMenuGroupId: '9_cutcopypaste',
      run: (currEditor) => {
        setUserSoql(formatQuery(currEditor.getValue(), { fieldMaxLineLength: 80 }));
      },
    });
  };

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
        <Editor
          className="slds-border_top slds-border_right slds-border_bottom slds-border_left"
          height="50vh"
          language="soql"
          value={userSoql}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            scrollBeyondLastLine: false,
          }}
          onMount={handleEditorMount}
          onChange={(value) => setUserSoql(value)}
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
