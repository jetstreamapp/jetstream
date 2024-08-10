import { css } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe } from '@jetstream/types';
import { ComboboxWithItems, Grid, Input, Section, Textarea } from '@jetstream/ui';
import {
  MetadataRow,
  TransformationCriteria,
  TransformationOption,
  startsWithWhereRgx,
  transformationCriteriaListItems,
  transformationOptionListItems,
} from '@jetstream/ui-core';
import { isQueryValid } from '@jetstreamapp/soql-parser-js';
import { FunctionComponent, useEffect, useState } from 'react';

export interface MassUpdateRecordsApplyToAllRowProps {
  commonFields: ListItem[];
  rows: MetadataRow[];
  applyCommonField: (selectedField: string) => void;
  applyCommonOption: (option: TransformationOption, staticValue?: string) => void;
  applyCommonCriteria: (criteria: TransformationCriteria, whereClause?: string) => void;
}

export const MassUpdateRecordsApplyToAllRow: FunctionComponent<MassUpdateRecordsApplyToAllRowProps> = ({
  commonFields,
  rows,
  applyCommonField,
  applyCommonOption,
  applyCommonCriteria,
}) => {
  const [commonField, selectedCommonField] = useState<Maybe<string>>(null);
  const [transformationOption, setTransformationOption] = useState<Maybe<TransformationOption>>();
  const [transformationCriteria, setTransformationCriteria] = useState<Maybe<TransformationCriteria>>();
  const [staticValue, setStaticValue] = useState<string>('');
  const [whereClause, setWhereClause] = useState<string>('');

  const debouncedWhereClause = useDebounce(whereClause, 300);
  const [whereClauseIsValid, setWhereClauseIsValid] = useState(true);

  useEffect(() => {
    if (transformationCriteria === 'custom' && debouncedWhereClause) {
      const whereClause = debouncedWhereClause.replace(startsWithWhereRgx, '');
      setWhereClauseIsValid(isQueryValid(`WHERE ${whereClause}`, { allowPartialQuery: true }));
    }
  }, [transformationCriteria, debouncedWhereClause]);

  useEffect(() => {
    if (commonFields && !commonFields.find((field) => field.id === commonField)) {
      selectedCommonField(null);
    }
  }, [commonField, commonFields]);

  function handleApplyCommonField() {
    commonField && applyCommonField(commonField);
    selectedCommonField(null);
  }

  function handleApplyCommonOption() {
    transformationOption && applyCommonOption(transformationOption, staticValue);
    setTransformationOption(null);
    setStaticValue('');
  }

  function handleApplyCommonCriteria() {
    transformationCriteria && applyCommonCriteria(transformationCriteria, whereClause);
    setTransformationCriteria(null);
    setWhereClause('');
  }

  const hasCommonFields = !!commonFields.length;

  if (rows.length <= 1) {
    return null;
  }

  return (
    <Section id="mass-update-apply-to-all-section" label="Apply to All" className="border-color-brand-dark">
      <div className="slds-p-horizontal_xx-small slds-text-body_small">Set configuration for all selected objects at once.</div>
      <div className="slds-p-around_xx-small">
        <Grid>
          <Grid
            className="slds-m-right_small"
            css={css`
              width: 240px;
            `}
          >
            <div className="slds-grow">
              <ComboboxWithItems
                comboboxProps={{
                  label: 'Select field for all objects',
                  itemLength: 10,
                  disabled: !hasCommonFields,
                  labelHelp:
                    'If every selected object has a field with the same API name, you can select it here to apply the change to every object.',
                }}
                items={commonFields}
                selectedItemId={commonField}
                onSelected={(item) => selectedCommonField(item.id)}
              />
              <div>
                <button
                  className="slds-button slds-button_neutral slds-m-top_x-small"
                  disabled={!commonField || !hasCommonFields}
                  onClick={handleApplyCommonField}
                >
                  Apply
                </button>
              </div>
            </div>
          </Grid>
          <Grid
            className="slds-m-right_small"
            css={css`
              width: 240px;
            `}
          >
            <div className="slds-grow">
              <ComboboxWithItems
                comboboxProps={{
                  label: 'Record update for all objects',
                  itemLength: 10,
                }}
                items={transformationOptionListItems}
                selectedItemId={transformationOption}
                onSelected={(item) => setTransformationOption(item.id as TransformationOption)}
              />
              {transformationOption === 'staticValue' && (
                <Input id={`static-value-option`} label="Provided Value" isRequired>
                  <input
                    id={`static-value-option`}
                    className="slds-input"
                    value={staticValue}
                    onChange={(event) => setStaticValue(event.target.value)}
                  />
                </Input>
              )}
              <button
                className="slds-button slds-button_neutral slds-m-top_x-small"
                onClick={handleApplyCommonOption}
                disabled={!transformationOption || (transformationOption === 'staticValue' && !staticValue)}
              >
                Apply
              </button>
            </div>
          </Grid>
          <Grid
            css={css`
              width: 240px;
            `}
          >
            <div className="slds-grow">
              <ComboboxWithItems
                comboboxProps={{
                  label: 'Which records should be updated?',
                  itemLength: 10,
                }}
                items={transformationCriteriaListItems}
                selectedItemId={transformationCriteria}
                onSelected={(item) => setTransformationCriteria(item.id as TransformationCriteria)}
              />
              {transformationCriteria === 'custom' && (
                <Textarea
                  id={`all-records-criteria`}
                  label="Custom WHERE clause"
                  isRequired
                  labelHelp="Provide a custom SOQL WHERE clause to target the specific records that you would like to update"
                  hasError={!whereClauseIsValid}
                  errorMessage="Not a valid WHERE clause"
                  errorMessageId={`all-records-criteria-error`}
                >
                  <textarea
                    id={`all-records-criteria`}
                    className="slds-textarea"
                    placeholder="CreatedDate >= THIS_WEEK AND Type__c != 'Account'"
                    rows={2}
                    value={whereClause}
                    onChange={(event) => setWhereClause(event.target.value)}
                  />
                </Textarea>
              )}
              <button
                className="slds-button slds-button_neutral slds-m-top_x-small"
                onClick={handleApplyCommonCriteria}
                disabled={!transformationCriteria || (transformationCriteria === 'custom' && (!whereClause || !whereClauseIsValid))}
              >
                Apply
              </button>
            </div>
          </Grid>
        </Grid>
      </div>
    </Section>
  );
};

export default MassUpdateRecordsApplyToAllRow;
