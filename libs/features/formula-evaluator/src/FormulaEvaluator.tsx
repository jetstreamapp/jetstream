import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { hasModifierKey, isEnterKey, useGlobalEventHandler, useNonInitialEffect, useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { DescribeGlobalSObjectResult, SalesforceOrgUi } from '@jetstream/types';
import {
  Alert,
  AutoFullHeightContainer,
  Card,
  EmptyState,
  GoneFishingIllustration,
  Grid,
  KeyboardShortcut,
  NotSeeingRecentMetadataPopover,
  Radio,
  RadioButton,
  RadioGroup,
  SobjectCombobox,
  SobjectComboboxRef,
  SobjectFieldCombobox,
  SobjectFieldComboboxRef,
  Spinner,
  ViewDocsLink,
} from '@jetstream/ui';
import {
  FormulaEvaluatorRecordSearch,
  FormulaEvaluatorResults,
  FormulaEvaluatorUserSearch,
  applicationCookieState,
  fromFormulaState,
  getFormulaData,
  registerCompletions,
  selectedOrgState,
  useAmplitude,
} from '@jetstream/ui-core';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import * as formulon from 'formulon';
import type { editor } from 'monaco-editor';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import FormulaEvaluatorDeployModal from './deploy/FormulaEvaluatorDeployModal';

// Lazy import
const prettier = import('prettier/standalone');
const prettierBabelParser = import('prettier/parser-babel');

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
  const isMounted = useRef(true);
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const sobjectComboRef = useRef<SobjectComboboxRef>(null);
  const fieldsComboRef = useRef<SobjectFieldComboboxRef>(null);
  const { trackEvent } = useAmplitude();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [fieldErrorMessage, setFieldErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formulaValue, setFormulaValue] = useRecoilState(fromFormulaState.formulaValueState);
  const [selectedSObject, setSelectedSobject] = useRecoilState(fromFormulaState.selectedSObjectState);
  const [selectedUserId, setSelectedUserId] = useRecoilState(fromFormulaState.selectedUserState);
  const [selectedField, setSelectedField] = useRecoilState(fromFormulaState.selectedFieldState);
  const [sourceType, setSourceType] = useRecoilState(fromFormulaState.sourceTypeState);
  const [recordId, setRecordId] = useRecoilState(fromFormulaState.recordIdState);
  const [numberNullBehavior, setNumberNullBehavior] = useRecoilState(fromFormulaState.numberNullBehaviorState);
  const [bannerDismissed, setBannerDismissed] = useRecoilState(fromFormulaState.bannerDismissedState);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);

  const [results, setResults] = useState<{ formulaFields: formulon.FormulaData; parsedFormula: formulon.FormulaResult } | null>(null);

  const deployFormulaDisabled = loading || !selectedSObject || !formulaValue;
  const testFormulaDisabled = loading || !selectedSObject || !selectedUserId || !recordId || !formulaValue;

  const monaco = useMonaco();

  useEffect(() => {
    setSelectedUserId(selectedOrg.userId);
  }, [selectedOrg.userId, setSelectedUserId]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    monaco && registerCompletions(monaco, selectedOrg, selectedSObject?.name);
  }, [monaco, selectedOrg, selectedSObject?.name]);

  useEffect(() => {
    if (sourceType === 'EXISTING' && selectedField) {
      editorRef.current?.setValue(selectedField.calculatedFormula || '');
    }
  }, [sourceType, selectedSObject, selectedField]);

  const handleTestFormula = useCallback(
    async (value: string) => {
      try {
        if (testFormulaDisabled) {
          return;
        }

        setLoading(true);
        setFieldErrorMessage(null);
        setErrorMessage(null);
        setResults(null);

        const fields = formulon.extract(value);
        let formulaFields: formulon.FormulaData = {};

        if (fields.length) {
          const response = await getFormulaData({
            fields,
            recordId,
            selectedOrg,
            selectedUserId,
            sobjectName: selectedSObject?.name || '',
            numberNullBehavior,
          });
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
        logger.error(ex);
        setErrorMessage(getErrorMessage(ex));
        trackEvent(ANALYTICS_KEYS.formula_execute, { success: false, ...getErrorMessageAndStackObj(ex) });
      } finally {
        setLoading(false);
      }
    },
    [testFormulaDisabled, trackEvent, recordId, selectedOrg, selectedSObject?.name, numberNullBehavior]
  );

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  function handleEditorChange(value?: string, event?: unknown) {
    setFormulaValue(value || '');
  }

  const handleApexEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    if (sourceType === 'EXISTING' && selectedField) {
      editorRef.current?.setValue(selectedField.calculatedFormula || '');
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
    editorRef.current.addAction({
      id: 'format',
      label: 'Format',
      contextMenuGroupId: '9_cutcopypaste',
      run: (currEditor) => {
        handleFormat(currEditor.getValue());
      },
    });
  };

  const handleRefreshMetadata = async () => {
    setRefreshLoading(true);
    await clearCacheForOrg(selectedOrg);
    sobjectComboRef.current?.reload();
    fieldsComboRef.current?.reload();
    setRefreshLoading(false);
  };

  const handleFormat = async (value = formulaValue) => {
    try {
      if (!editorRef.current || !formulaValue) {
        return;
      }
      editorRef.current.setValue(
        (await prettier).format(formulaValue, {
          parser: 'babel',
          plugins: [await prettierBabelParser],
          bracketSpacing: false,
          semi: false,
          singleQuote: true,
          trailingComma: 'none',
          useTabs: false,
          tabWidth: 2,
        })
      );
    } catch (ex) {
      logger.warn('failed to format', ex);
    }
  };

  const handleDeployModalClose = () => {
    setDeployModalOpen(false);
  };

  return (
    <>
      {deployModalOpen && selectedSObject && (
        <FormulaEvaluatorDeployModal
          selectedOrg={selectedOrg}
          sobject={selectedSObject.name}
          selectedField={sourceType === 'EXISTING' ? selectedField : null}
          formula={formulaValue}
          numberNullBehaviorState={numberNullBehavior}
          onClose={handleDeployModalClose}
        />
      )}

      <AutoFullHeightContainer
        fillHeight
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        key={selectedOrg.uniqueId}
      >
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
              icon={{ type: 'standard', icon: 'formula' }}
              title={
                <Grid vertical>
                  <div>Formula Evaluator</div>
                  <ViewDocsLink textReset path="/deploy/formula-evaluator" />
                </Grid>
              }
              actions={
                <NotSeeingRecentMetadataPopover
                  org={selectedOrg}
                  loading={refreshLoading}
                  serverUrl={serverUrl}
                  onReload={handleRefreshMetadata}
                />
              }
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
                <FormulaEvaluatorUserSearch selectedOrg={selectedOrg} disabled={loading} onSelectedRecord={setSelectedUserId} />
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

              <Grid className="slds-m-top_x-small" align="spread">
                <KeyboardShortcut keys={['ctrl', 'space']} postContent="to open the auto-complete menu in the editor." />
                {formulaValue && (
                  <button
                    className="slds-button slds-text-link_reset slds-text-link"
                    title="Format soql query"
                    onClick={() => handleFormat()}
                  >
                    format
                  </button>
                )}
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
              icon={{ type: 'standard', icon: 'outcome' }}
              title={<div>Results</div>}
              actions={
                <>
                  <button
                    className="slds-button slds-button_neutral"
                    disabled={deployFormulaDisabled}
                    onClick={() => setDeployModalOpen(true)}
                  >
                    Deploy
                  </button>
                  <button
                    className="slds-button slds-button_brand"
                    disabled={testFormulaDisabled}
                    onClick={() => handleTestFormula(formulaValue)}
                  >
                    Test
                  </button>
                </>
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
              <FormulaEvaluatorResults errorMessage={errorMessage} results={results} />
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
    </>
  );
};

export default FormulaEvaluator;
