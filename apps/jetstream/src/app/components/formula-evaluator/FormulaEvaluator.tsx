import { css } from '@emotion/react';
import { LOG_LEVELS, TITLES } from '@jetstream/shared/constants';
import { useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Card, Grid, Icon, ViewDocsLink } from '@jetstream/ui';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../app-state';
import { useAmplitude } from '../core/analytics';
import { parse } from 'formulon';
import { logger } from '@jetstream/shared/client-logger';

// TODO: ADD COMPLETIONS - for intellisense

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FormulaEvaluatorProps {}

export const FormulaEvaluator: FunctionComponent<FormulaEvaluatorProps> = () => {
  useTitle(TITLES.FORMULA_EVALUATOR);
  const isMounted = useRef(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [formulaValue, setFormulaValue] = useState('');
  const [loading, setLoading] = useState(false);

  const monaco = useMonaco();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // this is required otherwise the action has stale variables in scope
  useNonInitialEffect(() => {
    if (monaco && editorRef.current) {
      editorRef.current.addAction({
        id: 'modifier-enter',
        label: 'Submit',
        keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
        run: (currEditor) => {
          onSubmit(currEditor.getValue());
        },
      });
    }
  }, [selectedOrg]);

  const onSubmit = useCallback(
    async (value: string) => {
      setLoading(true);
      logger.log('results', parse(value));
      // setResults('');
      try {
        // TODO:
        // trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: result.success });
      } catch (ex) {
        // setResults(`There was a problem submitting the request\n${ex.message}`);
        // trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: false });
      } finally {
        setLoading(false);
      }
    },
    [selectedOrg]
  );

  function handleEditorChange(value, event) {
    setFormulaValue(value);
  }

  const handleApexEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    // this did not run on initial render if used in useEffect
    editorRef.current.addAction({
      id: 'modifier-enter',
      label: 'Submit',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: (currEditor) => {
        onSubmit(currEditor.getValue());
      },
    });
  };

  /**
   * TODO:
   * Allow user to choose an object and field and pull existing formula into editor
   */

  return (
    <AutoFullHeightContainer fillHeight bottomBuffer={10} setHeightAttr className="slds-p-horizontal_x-small slds-scrollable_none">
      <Split
        sizes={[50, 50]}
        minSize={[300, 300]}
        gutterSize={10}
        className="slds-gutters"
        css={css`
          display: flex;
          flex-direction: row;
        `}
      >
        <div className="slds-p-horizontal_x-small">
          <Card
            className="h-100"
            title={
              <Grid vertical>
                <div>Formula Evaluator</div>
                {/* FIXME: */}
                <ViewDocsLink textReset path="/developer/anonymous-apex" />
              </Grid>
            }
            actions={
              <button className="slds-button slds-button_brand" onClick={() => onSubmit(formulaValue)}>
                <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                Test
              </button>
            }
          >
            <Editor
              height="80vh"
              theme="vs-dark"
              defaultLanguage="javascript"
              value={formulaValue}
              options={{}}
              onMount={handleApexEditorMount}
              onChange={handleEditorChange}
            />
          </Card>
        </div>
        <div className="slds-p-horizontal_x-small slds-is-relative">
          <Card
            className="h-100"
            title={
              <div>
                Results
                {/* {resultsStatus.hasResults && (
                  <span className="slds-m-left_small">
                    <Badge type={resultsStatus.success ? 'success' : 'error'}>
                      <span className="slds-badge__icon slds-badge__icon_left slds-badge__icon_inverse">
                        <Icon
                          type="utility"
                          icon={resultsStatus.success ? 'success' : 'error'}
                          containerClassname="slds-icon_container slds-current-color"
                          className="slds-icon slds-icon_xx-small"
                        />
                      </span>
                      {resultsStatus.label}
                    </Badge>
                  </span>
                )} */}
              </div>
            }
            // actions={<CopyToClipboard type="button" content={results} disabled={!results} />}
          >
            {/* {loading && <Spinner />} */}
            {/* <FormulaEvaluatorFilter
              textFilter={textFilter}
              userDebug={userDebug}
              hasResults={!!resultsStatus.hasResults}
              onTextChange={setTextFilter}
              onDebugChange={setUserDebug}
            />
            <Editor
              height="80vh"
              theme="vs-dark"
              defaultLanguage="apex-log"
              options={{
                readOnly: true,
                contextmenu: false,
              }}
              value={visibleResults}
              onMount={handleLogEditorMount}
            /> */}
          </Card>
        </div>
      </Split>
    </AutoFullHeightContainer>
  );
};

export default FormulaEvaluator;
