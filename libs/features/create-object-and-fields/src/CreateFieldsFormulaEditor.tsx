import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { Field, FieldType, Maybe, NullNumberBehavior, SalesforceOrgUi } from '@jetstream/types';
import { Grid, KeyboardShortcut, Modal, Spinner, Tabs, Textarea } from '@jetstream/ui';
import {
  FieldDefinition,
  FieldValue,
  FieldValueState,
  FieldValues,
  FormulaEvaluatorRecordSearch,
  FormulaEvaluatorResults,
  FormulaEvaluatorUserSearch,
  ManualFormulaRecord,
  SalesforceFieldType,
  getFormulaData,
  registerCompletions,
  useAmplitude,
} from '@jetstream/ui-core';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import * as formulon from 'formulon';
import type { editor } from 'monaco-editor';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import CreateFieldsFormulaEditorManualField from './CreateFieldsFormulaEditorManualField';

export interface CreateFieldsFormulaEditorProps {
  id: string;
  selectedOrg: SalesforceOrgUi;
  selectedSObjects: string[];
  field: FieldDefinition;
  disabled: Maybe<boolean>;
  allValues: FieldValues;
  rows: FieldValues[];
  valueState: FieldValueState;
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
}

export const CreateFieldsFormulaEditor = forwardRef<unknown, CreateFieldsFormulaEditorProps>(
  ({ id, selectedOrg, selectedSObjects = [], allValues, field, valueState, disabled = false, rows, onChange, onBlur }, ref) => {
    const { value, touched, errorMessage } = valueState;
    const isMounted = useRef(true);
    const editorRef = useRef<editor.IStandaloneCodeEditor>();
    const { trackEvent } = useAmplitude();

    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [fieldErrorMessage, setFieldErrorMessage] = useState<string | null>(null);
    const [formulaErrorMessage, setFormulaErrorMessage] = useState<string | null>(null);
    const [formulaValue, setFormulaValue] = useState((value as string) || '');
    const [additionalFieldMetadata, setAdditionalFieldMetadata] = useState<Partial<Field>[]>([]);

    const [testMethod, setTestMethod] = useState<'RECORD' | 'MANUAL'>('RECORD');
    const [formulaFields, setFormulaFields] = useState<string[]>([]);
    const [formulaFieldValues, setFormulaFieldValues] = useState<ManualFormulaRecord>({});

    const [results, setResults] = useState<{ formulaFields: formulon.FormulaData; parsedFormula: formulon.FormulaResult } | null>(null);

    const [selectedUserId, setSelectedUserId] = useState('');
    const [recordId, setRecordId] = useState('');

    const monaco = useMonaco();

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useEffect(() => {
      monaco && registerCompletions(monaco, selectedOrg, selectedSObjects[0], additionalFieldMetadata);
    }, [monaco, selectedOrg, additionalFieldMetadata, selectedSObjects]);

    /** Reset Results */
    useEffect(() => {
      setResults(null);
    }, [testMethod]);

    useEffect(() => {
      setFormulaFields((prevValue) => {
        try {
          const fields = formulon.extract(formulaValue || '');
          return fields;
        } catch (ex) {
          return prevValue;
        }
      });
    }, [formulaValue]);

    useEffect(() => {
      if (isOpen) {
        setTestMethod('RECORD');
        setFormulaFields([]);
        setFormulaFieldValues({});
        setResults(null);
        setFormulaValue((value as string) || '');
        setAdditionalFieldMetadata(
          rows
            .filter((row) => row.fullName.value && allValues.fullName.value !== row.fullName.value)
            .map((row): Partial<Field> => {
              return {
                name: (row.fullName.value as string) || '',
                label: `${(row.label.value as string) || ''} (NEW FIELD)`,
                type: row.type.value as FieldType,
                relationshipName: (row.relationshipName.value as string) || null,
                referenceTo: row.referenceTo.value ? [row.referenceTo.value as string] : [],
              };
            })
        );
      }
    }, [allValues.fullName.value, isOpen, rows, value]);

    const handleTestFormula = useCallback(
      async (value: string) => {
        try {
          setLoading(true);
          setFieldErrorMessage(null);
          setFormulaErrorMessage(null);
          setResults(null);

          let formulaFieldResults: formulon.FormulaData = {};
          if (formulaFields.length) {
            let payload: Parameters<typeof getFormulaData>[0] = {
              fields: formulaFields,
              recordId,
              selectedOrg,
              selectedUserId,
              sobjectName: selectedSObjects[0] || '',
              numberNullBehavior: (allValues.formulaTreatBlanksAs.value as NullNumberBehavior) || 'BLANK',
            };

            if (testMethod === 'MANUAL' || !recordId) {
              // ensure all fields are included in record
              const record = {
                ...formulaFieldValues,
              };
              formulaFields.forEach((field) => {
                if (!record[field]) {
                  record[field] = {
                    type: 'string',
                    value: null,
                  };
                }
              });
              payload = {
                fields: formulaFields,
                type: 'PROVIDED_RECORD',
                record,
                selectedOrg,
                selectedUserId,
                sobjectName: selectedSObjects[0] || '',
                numberNullBehavior: (allValues.formulaTreatBlanksAs.value as NullNumberBehavior) || 'BLANK',
              };
            }

            const response = await getFormulaData(payload);
            if (response.type === 'error') {
              setFieldErrorMessage(response.message);
              return;
            }
            formulaFieldResults = response.formulaFields;
          }
          const parsedFormula = formulon.parse(value, formulaFieldResults);
          logger.log('results', parsedFormula);
          setResults({
            formulaFields: formulaFieldResults,
            parsedFormula,
          });
          trackEvent(ANALYTICS_KEYS.sobj_create_field_formula_execute, { success: true, fieldCount: formulaFields.length, testMethod });
        } catch (ex) {
          logger.warn(ex);
          setFormulaErrorMessage(getErrorMessage(ex));
          trackEvent(ANALYTICS_KEYS.sobj_create_field_formula_execute, { success: false, ...getErrorMessageAndStackObj(ex) });
        } finally {
          setLoading(false);
        }
      },
      [
        allValues.formulaTreatBlanksAs.value,
        formulaFieldValues,
        formulaFields,
        recordId,
        selectedOrg,
        selectedSObjects,
        selectedUserId,
        testMethod,
        trackEvent,
      ]
    );

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

    function handleClose() {
      onChange(formulaValue);
      setIsOpen(false);
    }

    return (
      <div>
        <Textarea
          id={`${id}-${field.label}`}
          label={field.label}
          isRequired={field.required}
          helpText={typeof field.helpText === 'function' ? field.helpText(allValues.type.value as SalesforceFieldType) : field.helpText}
          labelHelp={typeof field.labelHelp === 'function' ? field.labelHelp(allValues.type.value as SalesforceFieldType) : field.labelHelp}
          hasError={touched && !!errorMessage}
          errorMessage={errorMessage}
        >
          <textarea
            id={`${id}-${field.label}`}
            className="slds-textarea"
            placeholder={field.placeholder}
            value={value as string}
            disabled
            rows={1}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
          />
        </Textarea>
        <button
          type="button"
          className="slds-button slds-button_neutral slds-button_stretch"
          onClick={() => setIsOpen(true)}
          disabled={!!disabled}
        >
          Edit Formula
        </button>
        {isOpen && (
          <Modal
            header="Formula Editor"
            size="lg"
            closeOnEsc={false}
            footer={
              <Grid align="end">
                <button className="slds-button slds-button_brand" onClick={handleClose}>
                  Close
                </button>
              </Grid>
            }
            onClose={handleClose}
          >
            <div
              className="slds-is-relative"
              css={css`
                height: 75vh;
                min-height: 75vh;
                max-height: 75vh;
              `}
            >
              {loading && <Spinner size="small" />}
              <Grid align="spread">
                <KeyboardShortcut keys={['ctrl', 'space']} postContent="to open the auto-complete menu in the editor." />
              </Grid>
              <Split
                sizes={[70, 30]}
                minSize={[300, 300]}
                gutterSize={10}
                className="slds-gutters slds-is-relative slds-m-top_x-small"
                css={css`
                  display: flex;
                  flex-direction: row;
                `}
              >
                <div
                  className=""
                  css={css`
                    height: 75vh;
                  `}
                >
                  <Editor
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
                </div>
                <Grid vertical className="slds-p-horizontal_small">
                  <h3 className="slds-text-heading_small" title="Test Formula">
                    Test Formula
                  </h3>
                  <Tabs
                    onChange={(value) => setTestMethod(value as 'RECORD' | 'MANUAL')}
                    initialActiveId={testMethod}
                    tabs={[
                      {
                        id: 'RECORD',
                        title: 'Use Record',
                        content: (
                          <FormulaEvaluatorRecordSearch
                            selectedOrg={selectedOrg}
                            selectedSObject={selectedSObjects[0]}
                            disabled={!!loading || !selectedSObjects[0]}
                            fieldErrorMessage={fieldErrorMessage}
                            onSelectedRecord={setRecordId}
                          />
                        ),
                      },
                      {
                        id: 'MANUAL',
                        title: 'Use Manual Values',
                        content: (
                          <Grid vertical className="slds-p-horizontal_small">
                            {!formulaFields.length && <p>There are no record fields in your formula.</p>}
                            {formulaFields.map((field) => (
                              <CreateFieldsFormulaEditorManualField
                                key={field}
                                field={field}
                                fieldType={formulaFieldValues[field]?.type || 'string'}
                                fieldValue={formulaFieldValues[field]?.value || ''}
                                disabled={loading}
                                onChange={(type, value) => {
                                  setFormulaFieldValues((prevValue) => ({
                                    ...prevValue,
                                    [field]: {
                                      type,
                                      value,
                                    },
                                  }));
                                }}
                              />
                            ))}
                          </Grid>
                        ),
                      },
                    ]}
                  ></Tabs>
                  <hr className="slds-m-vertical_small" />
                  <FormulaEvaluatorUserSearch selectedOrg={selectedOrg} disabled={loading} onSelectedRecord={setSelectedUserId} />
                  <button className="slds-button slds-button_brand" onClick={() => handleTestFormula(formulaValue)}>
                    Test Formula
                  </button>
                  <FormulaEvaluatorResults errorMessage={formulaErrorMessage} results={results} />
                </Grid>
              </Split>
            </div>
          </Modal>
        )}
      </div>
    );
  }
);

export default CreateFieldsFormulaEditor;
