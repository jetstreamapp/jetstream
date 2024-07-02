import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { CheckboxToggle, Grid, Icon, Panel, Textarea, Tooltip } from '@jetstream/ui';
import { fromQueryHistoryState } from '@jetstream/ui-core';
import { formatQuery, parseQuery } from '@jetstreamapp/soql-parser-js';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { FunctionComponent, useEffect, useReducer, useRef, useState } from 'react';
import SaveFavoriteSoql from '../QueryOptions/SaveFavoriteSoql';

type Action =
  | { type: 'VALIDATE_SOQL'; payload: { soql: string } }
  | { type: 'FORMAT_SOQL'; payload: { soql: string } }
  | { type: 'RESET_FORMAT' };

interface State {
  formattedSoql?: string;
  isValid: boolean;
  sobjectName: string | null;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'VALIDATE_SOQL':
      if (action.payload.soql) {
        try {
          const parsedQuery = parseQuery(action.payload.soql);
          if (parsedQuery.sObject) {
            return { ...state, isValid: true, sobjectName: parsedQuery.sObject };
          }
          return { ...state, isValid: false, sobjectName: null };
        } catch (ex) {
          return { ...state, isValid: false, sobjectName: null };
        }
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
      return { isValid: state.isValid, sobjectName: null };
    default:
      throw new Error('Invalid action');
  }
}

export interface QueryResultsSoqlPanelProps {
  soql: string;
  isTooling: boolean;
  isOpen: boolean;
  selectedOrg: SalesforceOrgUi;
  sObject: string;
  onClosed: () => void;
  executeQuery: (soql: string, isTooling: boolean) => void;
  onOpenHistory: (type: fromQueryHistoryState.QueryHistoryType) => void;
}

export const QueryResultsSoqlPanel: FunctionComponent<QueryResultsSoqlPanelProps> = ({
  soql,
  isTooling,
  isOpen,
  selectedOrg,
  sObject,
  onClosed,
  executeQuery,
  onOpenHistory,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const [userSoql, setUserSoql] = useState<string>(soql);
  const [userTooling, setUserTooling] = useState<boolean>(isTooling);
  const [{ formattedSoql, isValid, sobjectName }, dispatch] = useReducer(reducer, {
    formattedSoql: soql,
    isValid: true,
    sobjectName: sObject,
  });

  const monaco = useMonaco();
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

  // this is required otherwise the action has stale variables in scope
  useNonInitialEffect(() => {
    if (monaco && editorRef.current) {
      editorRef.current.addAction({
        id: 'modifier-enter',
        label: 'Submit',
        keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
        run: (currEditor) => {
          submitQuery(currEditor.getValue());
        },
      });
    }
  }, [executeQuery]);

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
      keybindings: [monaco?.KeyMod.Shift | monaco?.KeyMod.Alt | monaco?.KeyCode.KeyF],
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
          onChange={(value) => setUserSoql(value || '')}
        />
      </Textarea>
      <Grid align="spread" className="slds-m-top--small">
        <CheckboxToggle
          id="is-tooling-user-soql"
          label="Query Type"
          onText="Metadata Query"
          offText="Object Query"
          hideLabel
          checked={userTooling}
          onChange={setUserTooling}
        />
        <Grid>
          <SaveFavoriteSoql
            className="slds-m-right_x-small"
            isTooling={isTooling}
            selectedOrg={selectedOrg}
            sObject={sobjectName}
            sObjectLabel={sobjectName}
            soql={userSoql}
            disabled={!isValid}
            onOpenHistory={onOpenHistory}
          />
          <div>
            <button type="submit" className="slds-button slds-button_brand" onClick={() => submitQuery()}>
              <Icon type="utility" icon="play" className="slds-button__icon slds-button__icon_left" omitContainer />
              Execute Query
            </button>
          </div>
        </Grid>
      </Grid>
    </Panel>
  );
};

export default QueryResultsSoqlPanel;
