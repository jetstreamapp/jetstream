import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { hasModifierKey, isEnterKey, useGlobalEventHandler, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  Alert,
  AutoFullHeightContainer,
  Card,
  EmptyState,
  GoneFishingIllustration,
  Grid,
  KeyboardShortcut,
  Radio,
  RadioButton,
  RadioGroup,
  ScopedNotification,
  SobjectCombobox,
  SobjectComboboxRef,
  SobjectFieldCombobox,
  SobjectFieldComboboxRef,
  Spinner,
  ViewDocsLink,
} from '@jetstream/ui';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import * as formulon from 'formulon';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import type { editor } from 'monaco-editor';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import { useAmplitude } from '../core/analytics';
import { registerCompletions } from './formula-evaluator.editor-utils';
import * as fromFormulaState from './formula-evaluator.state';
import { getFormulaData } from './formula-evaluator.utils';
import FormulaEvaluatorRecordSearch from './FormulaEvaluatorRecordSearch';
import FormulaEvaluatorRefreshCachePopover from './FormulaEvaluatorRefreshCachePopover';

window.addEventListener('unhandledrejection', function (event) {
  console.log('unhandledrejection', event);
});

export function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
  return (
    sobject.triggerable &&
    !sobject.deprecatedAndHidden &&
    !sobject.customSetting &&
    !sobject.name.endsWith('ChangeEvent') &&
    !sobject.name.endsWith('ChgEvent') &&
    !sobject.name.endsWith('__History') &&
    !sobject.name.endsWith('__Tag') &&
    !sobject.name.endsWith('__Share')
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FormulaEvaluatorProps {}

export const FormulaEvaluator: FunctionComponent<FormulaEvaluatorProps> = () => {
  useTitle(TITLES.FORMULA_EVALUATOR);
  const isMounted = useRef(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const sobjectComboRef = useRef<SobjectComboboxRef>(null);
  const fieldsComboRef = useRef<SobjectFieldComboboxRef>(null);
  const { trackEvent } = useAmplitude();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [fieldErrorMessage, setFieldErrorMessage] = useState<string>(null);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [formulaValue, setFormulaValue] = useRecoilState(fromFormulaState.formulaValueState);
  const [selectedSObject, setSelectedSobject] = useRecoilState(fromFormulaState.selectedSObjectState);
  const [selectedField, setSelectedField] = useRecoilState(fromFormulaState.selectedFieldState);
  const [sourceType, setSourceType] = useRecoilState(fromFormulaState.sourceTypeState);
  const [recordId, setRecordId] = useRecoilState(fromFormulaState.recordIdState);
  const [numberNullBehavior, setNumberNullBehavior] = useRecoilState(fromFormulaState.numberNullBehaviorState);
  const [bannerDismissed, setBannerDismissed] = useRecoilState(fromFormulaState.bannerDismissedState);

  const [results, setResults] = useState<{ formulaFields: formulon.FormulaData; parsedFormula: formulon.FormulaResult } | null>(null);

  const testFormulaDisabled = loading || !selectedSObject || !recordId || !formulaValue;

  const monaco = useMonaco();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    registerCompletions(monaco, selectedOrg, selectedSObject?.name);
  }, [monaco, selectedOrg, selectedSObject?.name]);

  useEffect(() => {
    if (sourceType === 'EXISTING' && selectedField) {
      editorRef.current?.setValue(selectedField.calculatedFormula);
    }
  }, [sourceType, selectedSObject, selectedField]);

  const handleTestFormula = useCallback(
    async (value: string) => {
      try {
        if (!value) {
          return;
        }

        setLoading(true);
        setFieldErrorMessage(null);
        setErrorMessage(null);
        setResults(null);

        const fields = formulon.extract(value);
        let formulaFields: formulon.FormulaData = {};

        if (fields.length) {
          const response = await getFormulaData({ fields, recordId, selectedOrg, sobjectName: selectedSObject.name, numberNullBehavior });
          if (response.type === 'error') {
            setFieldErrorMessage(response.message);
            return;
          }
          formulaFields = response.formulaFields;
        }

        const parsedFormula = formulon.parse(value, formulaFields);
        logger.log('results', parsedFormula);
        setResults({
          formulaFields,
          parsedFormula,
        });
        trackEvent(ANALYTICS_KEYS.formula_execute, { success: true, fieldCount: fields.length, objectPrefix: recordId.substring(0, 3) });
      } catch (ex) {
        logger.warn(ex);
        setErrorMessage(ex.message);
        trackEvent(ANALYTICS_KEYS.formula_execute, { success: false, message: ex.message, stack: ex.stack });
      } finally {
        setLoading(false);
      }
    },
    [recordId, trackEvent, selectedOrg, selectedSObject, numberNullBehavior]
  );

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (!testFormulaDisabled && hasModifierKey(event as any) && isEnterKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        handleTestFormula(formulaValue);
      }
    },
    [formulaValue, handleTestFormula, testFormulaDisabled]
  );

  useGlobalEventHandler('keydown', onKeydown);

  // this is required otherwise the action has stale variables in scope
  useNonInitialEffect(() => {
    if (monaco && editorRef.current) {
      editorRef.current.addAction({
        id: 'modifier-enter',
        label: 'Submit',
        keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
        run: (currEditor) => {
          handleTestFormula(currEditor.getValue());
        },
      });
    }
  }, [handleTestFormula, monaco, selectedOrg]);

  function handleEditorChange(value, event) {
    setFormulaValue(value);
  }

  const handleApexEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    if (sourceType === 'EXISTING' && selectedField) {
      editorRef.current?.setValue(selectedField.calculatedFormula);
    }
    // this did not run on initial render if used in useEffect
    editorRef.current.addAction({
      id: 'modifier-enter',
      label: 'Submit',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: (currEditor) => {
        handleTestFormula(currEditor.getValue());
      },
    });
  };

  const handleRefreshMetadata = async () => {
    setRefreshLoading(true);
    await clearCacheForOrg(selectedOrg);
    sobjectComboRef.current.reload();
    fieldsComboRef.current.reload();
    setRefreshLoading(false);
  };

  return (
    <AutoFullHeightContainer fillHeight bottomBuffer={10} className="slds-p-horizontal_x-small slds-scrollable_none">
      {!bannerDismissed && (
        <Alert type="info" leadingIcon="info" className="slds-m-bottom_xx-small" allowClose onClose={() => setBannerDismissed(true)}>
          Formulas in Jetstream may evaluate different from Salesforce and not every formula function is supported.
        </Alert>
      )}
      <Split
        sizes={[60, 40]}
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
                <ViewDocsLink textReset path="/deploy/formula-evaluator" />
              </Grid>
            }
            actions={<FormulaEvaluatorRefreshCachePopover org={selectedOrg} loading={refreshLoading} onReload={handleRefreshMetadata} />}
          >
            <Grid vertical>
              <SobjectCombobox
                ref={sobjectComboRef}
                className="slds-grow"
                isRequired
                label="Select an Object"
                selectedOrg={selectedOrg}
                selectedSObject={selectedSObject}
                disabled={loading}
                filterFn={filterSobjectFn}
                onSelectedSObject={setSelectedSobject}
              />
              <RadioGroup label="How to handle null values for numbers" formControlClassName="slds-grid">
                <Radio
                  id="null-zero"
                  name="null-zero"
                  label="Treat as zero"
                  value="ZERO"
                  checked={numberNullBehavior === 'ZERO'}
                  onChange={(value) => setNumberNullBehavior(value as 'ZERO')}
                  disabled={loading}
                />
                <Radio
                  id="null-blank"
                  name="null-blank"
                  label="Treat as blank"
                  value="BLANK"
                  checked={numberNullBehavior === 'BLANK'}
                  onChange={(value) => setNumberNullBehavior(value as 'BLANK')}
                  disabled={loading}
                />
              </RadioGroup>
              <RadioGroup label="Formula source" isButtonGroup>
                <RadioButton
                  id="source-new"
                  name="source-new"
                  label="New Formula"
                  value="NEW"
                  checked={sourceType === 'NEW'}
                  onChange={(value) => setSourceType(value as 'NEW')}
                  disabled={loading || !selectedSObject}
                />
                <RadioButton
                  id="source-existing"
                  name="source-existing"
                  label="From Salesforce Field"
                  value="EXISTING"
                  checked={sourceType === 'EXISTING'}
                  onChange={(value) => setSourceType(value as 'EXISTING')}
                  disabled={loading || !selectedSObject}
                />
              </RadioGroup>
              {sourceType === 'EXISTING' && (
                <Grid>
                  {selectedSObject?.name && (
                    <SobjectFieldCombobox
                      ref={fieldsComboRef}
                      className="slds-grow slds-m-left_small"
                      label="Formula Fields"
                      selectedOrg={selectedOrg}
                      selectedSObject={selectedSObject.name}
                      selectedField={selectedField}
                      disabled={loading}
                      filterFn={(field) => !!field.calculatedFormula}
                      onSelectField={setSelectedField}
                    />
                  )}
                </Grid>
              )}
            </Grid>

            <Grid className="slds-m-top_x-small">
              <KeyboardShortcut keys={['ctrl', 'space']} postContent="to open the auto-complete menu in the editor." />
            </Grid>

            <AutoFullHeightContainer
              fillHeight
              bottomBuffer={sourceType === 'EXISTING' ? 80 : 25}
              setHeightAttr
              className="slds-p-horizontal_x-small slds-scrollable_none"
            >
              <Editor
                className="slds-m-top_small"
                height="95%"
                theme="vs-dark"
                defaultLanguage="sfdc-formula"
                value={formulaValue}
                options={{
                  acceptSuggestionOnEnter: 'smart',
                  minimap: { enabled: false },
                  suggest: {
                    showKeywords: true,
                  },
                }}
                onMount={handleApexEditorMount}
                onChange={handleEditorChange}
              />
            </AutoFullHeightContainer>
          </Card>
        </div>
        <div className="slds-p-horizontal_x-small slds-is-relative">
          <Card
            className="h-100"
            title={<div>Results</div>}
            actions={
              // TODO: Allow user to deploy formula field (maybe we can allow a dry-run as well)
              <button
                className="slds-button slds-button_brand"
                disabled={testFormulaDisabled}
                onClick={() => handleTestFormula(formulaValue)}
              >
                Test Formula
              </button>
            }
          >
            {loading && <Spinner />}

            <FormulaEvaluatorRecordSearch
              selectedOrg={selectedOrg}
              selectedSObject={selectedSObject?.name || ''}
              disabled={!!loading || !selectedSObject}
              fieldErrorMessage={fieldErrorMessage}
              onSelectedRecord={setRecordId}
            />
            {errorMessage && (
              <div className="slds-m-around-medium">
                <ScopedNotification theme="error" className="slds-m-top_medium">
                  {errorMessage}
                </ScopedNotification>
              </div>
            )}
            {results && (
              <Grid vertical>
                {!!Object.keys(results.formulaFields).length && (
                  <>
                    <div className="slds-text-heading_small">Record Fields</div>
                    <div className="slds-m-top_xx-small slds-m-bottom_small slds-p-left_small">
                      {Object.keys(results.formulaFields).map((field) => {
                        const { value } = results.formulaFields[field];
                        return (
                          <div key={field}>
                            <span className="text-bold">{field}</span>: {String(value) || '<blank>'}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="slds-text-heading_small">Formula Results</div>
                <div className="slds-m-top_xx-small slds-m-bottom_small slds-p-left_small">
                  {results.parsedFormula.type === 'error' ? (
                    <Grid vertical className="slds-text-color_error">
                      <div>{results.parsedFormula.errorType}</div>
                      <div>{results.parsedFormula.message}</div>
                      {results.parsedFormula.errorType === 'NotImplementedError' && results.parsedFormula.name === 'isnull' && (
                        <div>Use ISBLANK instead</div>
                      )}
                    </Grid>
                  ) : (
                    <div className="slds-text-color_success">{String(results.parsedFormula.value)}</div>
                  )}
                </div>
              </Grid>
            )}
            {!errorMessage && !results && (
              <EmptyState
                headline="Test out a formula, the results will be shown here"
                illustration={<GoneFishingIllustration />}
              ></EmptyState>
            )}
          </Card>
        </div>
      </Split>
    </AutoFullHeightContainer>
  );
};

export default FormulaEvaluator;
