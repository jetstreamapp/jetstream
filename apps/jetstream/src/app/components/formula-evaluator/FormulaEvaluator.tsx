import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { TITLES } from '@jetstream/shared/constants';
import { describeGlobal } from '@jetstream/shared/data';
import { useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  Alert,
  AutoFullHeightContainer,
  Card,
  EmptyState,
  Grid,
  Icon,
  Input,
  Radio,
  RadioButton,
  RadioGroup,
  ScopedNotification,
  GoneFishingIllustration,
  SobjectCombobox,
  SobjectFieldCombobox,
  Spinner,
  ViewDocsLink,
} from '@jetstream/ui';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import * as formulon from 'formulon';
import type { editor } from 'monaco-editor';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../app-state';
import { useAmplitude } from '../core/analytics';
import * as fromFormulaState from './formula-evaluator.state';
import { getFormulaData } from './formula-evaluator.utils';

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
  const [loading, setLoading] = useState(false);
  const [fieldErrorMessage, setFieldErrorMessage] = useState<string>(null);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  // What about letting a user choose an existing formula?
  const [formulaValue, setFormulaValue] = useRecoilState(fromFormulaState.formulaValueState);
  const [selectedSObject, setSelectedSobject] = useRecoilState(fromFormulaState.selectedSObjectState);
  // TODO: reset when object changes
  const [selectedField, setSelectedField] = useRecoilState(fromFormulaState.selectedFieldState);
  const [sourceType, setSourceType] = useRecoilState(fromFormulaState.sourceTypeState);
  const [recordId, setRecordId] = useRecoilState(fromFormulaState.recordIdState);
  const [numberNullBehavior, setNumberNullBehavior] = useRecoilState(fromFormulaState.numberNullBehaviorState);
  const [bannerDismissed, setBannerDismissed] = useRecoilState(fromFormulaState.bannerDismissedState);

  const [results, setResults] = useState<{ formulaFields: formulon.FormulaData; parsedFormula: formulon.FormulaResult } | null>(null);

  const monaco = useMonaco();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (sourceType === 'EXISTING' && selectedField) {
      editorRef.current?.setValue(selectedField.calculatedFormula);
    }
  }, [sourceType, selectedSObject, selectedField]);

  useEffect(() => {
    if (recordId && (recordId.length === 15 || recordId.length === 18)) {
      // TODO: fetch record
      // we also need to fetch related records as well - will need to do after formula is entered
      // extract fields from formula
    }
  }, [recordId]);

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
      try {
        if (!value) {
          return;
        }
        setLoading(true);
        setFieldErrorMessage(null);
        setErrorMessage(null);
        setResults(null);

        const fields = formulon.extract(value);
        const ast = formulon.ast(value);
        logger.log({ fields, ast });
        let formulaFields: formulon.FormulaData = {};

        if (fields.length) {
          if (!recordId) {
            setFieldErrorMessage('Record id is required.');
            return;
          }

          if (recordId.length !== 15 && recordId.length !== 18) {
            setFieldErrorMessage('Record id is not a valid id.');
            return;
          }

          const keyPrefix = recordId.substring(0, 3);
          const describeGlobalResults = await describeGlobal(selectedOrg);
          const sobject = describeGlobalResults.data.sobjects.find((sobject) => sobject.keyPrefix === keyPrefix);
          if (!sobject) {
            setFieldErrorMessage(`An object with the prefix "${keyPrefix}" was not found.`);
            return;
          }

          const response = await getFormulaData({ fields, recordId, selectedOrg, sobjectName: sobject.name, numberNullBehavior });
          if (response.type === 'error') {
            setFieldErrorMessage(response.message);
            return;
          }
          // response.warnings; // TODO:
          formulaFields = response.formulaFields;
        }

        const parsedFormula = formulon.parse(value, formulaFields);
        logger.log('results', parsedFormula);
        setResults({
          formulaFields,
          parsedFormula,
        });
        // TODO:
        // trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: result.success });
      } catch (ex) {
        // setResults(`There was a problem submitting the request\n${ex.message}`);
        // trackEvent(ANALYTICS_KEYS.apex_Submitted, { success: false });
        logger.warn(ex);
        setErrorMessage(ex.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedOrg, recordId]
  );

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
      {!bannerDismissed && (
        <Alert type="info" leadingIcon="info" className="slds-m-bottom_xx-small" allowClose onClose={() => setBannerDismissed(true)}>
          Formulas in Jetstream may evaluate different from Salesforce and not every formula function is supported.
        </Alert>
      )}
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
              <button
                className="slds-button slds-button_brand"
                onClick={() => onSubmit(formulaValue)}
                disabled={!recordId || !formulaValue || loading}
              >
                <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                Submit
              </button>
            }
          >
            <Grid className="slds-m-bottom_x-small">
              <Input
                className="w-100"
                label="Record Id"
                isRequired
                labelHelp="Provide a record id to test the formula against"
                hasError={!loading && !!fieldErrorMessage}
                errorMessage={fieldErrorMessage}
              >
                <input
                  id="formula-id"
                  className="slds-input"
                  value={recordId}
                  disabled={loading}
                  onChange={(event) => setRecordId(event.target.value)}
                />
              </Input>
            </Grid>

            <Grid vertical>
              <RadioGroup label="Formula source" isButtonGroup>
                <RadioButton
                  id="source-new"
                  name="source-new"
                  label="New Formula"
                  value="NEW"
                  checked={sourceType === 'NEW'}
                  onChange={(value) => setSourceType(value as 'NEW')}
                  disabled={loading}
                />
                <RadioButton
                  id="source-existing"
                  name="source-existing"
                  label="From Salesforce Field"
                  value="EXISTING"
                  checked={sourceType === 'EXISTING'}
                  onChange={(value) => setSourceType(value as 'EXISTING')}
                  disabled={loading}
                />
              </RadioGroup>
              {sourceType === 'EXISTING' && (
                <Grid>
                  <SobjectCombobox
                    className="slds-grow"
                    selectedOrg={selectedOrg}
                    selectedSObject={selectedSObject}
                    disabled={loading}
                    onSelectedSObject={setSelectedSobject}
                  />
                  {selectedSObject?.name && (
                    <SobjectFieldCombobox
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
            </Grid>

            <Editor
              className="slds-m-top_small"
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
            title={<div>Results</div>}
            actions={
              // TODO: open modal, show all field options, if new field offer permissions and page layouts
              <button className="slds-button slds-button_neutral" disabled={!results || results.parsedFormula.type !== 'literal'}>
                Deploy to Salesforce
              </button>
            }
          >
            {loading && <Spinner />}
            {errorMessage && (
              <div className="slds-m-around-medium">
                <ScopedNotification theme="error" className="slds-m-top_medium">
                  {errorMessage}
                </ScopedNotification>
              </div>
            )}
            {results && (
              <Grid vertical>
                {results.formulaFields.length && (
                  <>
                    <div className="slds-text-heading_small slds-m-bottom_large">Record Fields</div>
                    {Object.keys(results.formulaFields).map((field) => {
                      const { dataType, value } = results.formulaFields[field];
                      return (
                        <div key={field}>
                          <span className="text-bold">{field}</span>: {String(value)}{' '}
                          <span className="slds-text-color_weak">({dataType})</span>
                        </div>
                      );
                    })}
                  </>
                )}
                <div className="slds-text-heading_small">Formula Results</div>
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
