import { css } from '@emotion/react';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, ComboboxWithItems, Grid, Icon, Input, Radio, RadioGroup, Spinner, Textarea, Tooltip } from '@jetstream/ui';
import { FieldDefinition, FieldDefinitions, FieldValue, FieldValueState, FieldValues, SalesforceFieldType } from '@jetstream/ui-core';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import CreateFieldsFormulaEditor from './CreateFieldsFormulaEditor';

export interface CreateFieldsRowFieldProps {
  selectedOrg: SalesforceOrgUi;
  id: string;
  selectedSObjects: string[];
  fieldDefinitions: FieldDefinitions; // TODO: unused, remove
  field: FieldDefinition;
  allValues: FieldValues;
  valueState: FieldValueState;
  disabled: boolean;
  rows: FieldValues[];
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
}

export const CreateFieldsRowField = forwardRef<unknown, CreateFieldsRowFieldProps>(
  ({ selectedOrg, id, selectedSObjects, field, allValues, valueState, disabled: _disabled, rows, onChange, onBlur }, ref) => {
    const { value, touched, errorMessage } = valueState;
    const disabled = _disabled || field?.disabled?.(allValues);
    const [values, setValues] = useState<ListItem[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [loadingValues, setLoadingValues] = useState<boolean>(false);

    const fetchValues = async (newValue?: string | null, skipCache = false) => {
      if (typeof field.values === 'function') {
        setLoadingValues(true);
        setFetchError(null);
        field
          .values(selectedOrg, skipCache)
          .then((_values) => {
            setValues(_values);
            if (newValue && _values.length > 0 && _values.find((item) => item.id === newValue)) {
              const value = _values.find((item) => item.id === newValue)?.value;
              value && onChange(value);
            } else if (!value && _values.length > 0) {
              onChange(_values[0].value);
            }
          })
          .catch((error) => {
            setFetchError('There was a problem getting values from Salesforce');
          })
          .finally(() => setLoadingValues(false));
      } else if (Array.isArray(field.values)) {
        setValues(field.values);
      }
    };

    useImperativeHandle(ref, () => {
      return {
        fetchValues,
      };
    });

    useEffect(() => {
      fetchValues();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [field.values]);

    const type = typeof field.type === 'function' ? field.type(allValues.type.value as SalesforceFieldType) : field.type;

    switch (type) {
      case 'picklist':
        return (
          <Grid className="slds-m-right_medium slds-is-relative">
            {loadingValues && <Spinner size="small" />}
            <ComboboxWithItems
              comboboxProps={{
                label: field.label,
                helpText:
                  typeof field.helpText === 'function' ? field.helpText(allValues.type.value as SalesforceFieldType) : field.helpText,
                errorMessage: fetchError || errorMessage,
                hasError: !!fetchError || !!errorMessage,
                labelHelp:
                  typeof field.labelHelp === 'function' ? field.labelHelp(allValues.type.value as SalesforceFieldType) : field.labelHelp,
                isRequired: field.required,
                disabled: disabled,
                itemLength: 10,
              }}
              items={values}
              selectedItemId={value as string}
              onSelected={(item) => onChange(item.id)}
            />
            {!!field.allowRefreshValues && (
              <Grid vertical verticalStretch align={fetchError ? 'center' : 'end'}>
                <Tooltip content={'Refresh values from Salesforce'}>
                  <button className="slds-button slds-button_icon slds-button_icon-container" onClick={() => fetchValues(null, true)}>
                    <Icon type="utility" icon="refresh" className="slds-button__icon" omitContainer />
                  </button>
                </Tooltip>
              </Grid>
            )}
          </Grid>
        );
      case 'checkbox':
        return (
          <div
            className="slds-m-right_medium slds-is-relative"
            css={css`
              max-width: 175px;
            `}
          >
            {loadingValues && <Spinner size="small" />}
            <Checkbox
              id={`${id}-${field.label}`}
              checked={value as boolean}
              label={field.label}
              isRequired={field.required}
              helpText={typeof field.helpText === 'function' ? field.helpText(allValues.type.value as SalesforceFieldType) : field.helpText}
              labelHelp={
                typeof field.labelHelp === 'function' ? field.labelHelp(allValues.type.value as SalesforceFieldType) : field.labelHelp
              }
              isStandAlone
              hasError={touched && !!errorMessage}
              errorMessage={errorMessage}
              disabled={disabled}
              onChange={onChange}
              onBlur={onBlur}
            />
          </div>
        );
      case 'radio':
        return (
          <div
            className="slds-m-right_medium slds-is-relative"
            css={css`
              max-width: 175px;
            `}
          >
            {loadingValues && <Spinner size="small" />}
            <RadioGroup
              idPrefix={id}
              label={field.label}
              required={field.required}
              helpText={typeof field.helpText === 'function' ? field.helpText(allValues.type.value as SalesforceFieldType) : field.helpText}
              labelHelp={
                typeof field.labelHelp === 'function' ? field.labelHelp(allValues.type.value as SalesforceFieldType) : field.labelHelp
              }
              hasError={touched && !!errorMessage}
              errorMessage={errorMessage}
            >
              {values.map((_value) => (
                <Radio
                  idPrefix={id}
                  id={`${id}-${_value.id}`}
                  name={field.label}
                  label={_value.label}
                  value={_value.value}
                  checked={_value.value === value}
                  disabled={disabled}
                  onChange={onChange}
                />
              ))}
            </RadioGroup>
          </div>
        );
      case 'textarea':
        return (
          <div
            className="slds-m-right_medium slds-is-relative"
            css={css`
              max-width: 250px;
            `}
          >
            {loadingValues && <Spinner size="small" />}
            <Textarea
              id={`${id}-${field.label}`}
              label={field.label}
              isRequired={field.required}
              helpText={typeof field.helpText === 'function' ? field.helpText(allValues.type.value as SalesforceFieldType) : field.helpText}
              labelHelp={
                typeof field.labelHelp === 'function' ? field.labelHelp(allValues.type.value as SalesforceFieldType) : field.labelHelp
              }
              hasError={touched && !!errorMessage}
              errorMessage={errorMessage}
            >
              <textarea
                id={`${id}-${field.label}`}
                className="slds-textarea"
                placeholder={field.placeholder}
                value={value as string}
                disabled={disabled}
                rows={1}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
              />
            </Textarea>
          </div>
        );
      case 'textarea-with-formula':
        return (
          <div
            className="slds-m-right_medium slds-is-relative"
            css={css`
              max-width: 250px;
            `}
          >
            {loadingValues && <Spinner size="small" />}
            <CreateFieldsFormulaEditor
              id={id}
              selectedSObjects={selectedSObjects}
              disabled={disabled}
              rows={rows}
              selectedOrg={selectedOrg}
              allValues={allValues}
              field={field}
              valueState={valueState}
              onChange={onChange}
              onBlur={onBlur}
            />
          </div>
        );
      case 'text':
      default:
        return (
          <div
            className="slds-m-right_medium slds-is-relative"
            css={css`
              max-width: 175px;
            `}
          >
            {loadingValues && <Spinner size="small" />}
            <Input
              label={field.label}
              isRequired={field.required}
              helpText={typeof field.helpText === 'function' ? field.helpText(allValues.type.value as SalesforceFieldType) : field.helpText}
              labelHelp={
                typeof field.labelHelp === 'function' ? field.labelHelp(allValues.type.value as SalesforceFieldType) : field.labelHelp
              }
              hasError={touched && !!errorMessage}
              errorMessage={errorMessage}
            >
              <input
                id={`${id}-${field.label}`}
                className="slds-input"
                value={value as string}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
              />
            </Input>
          </div>
        );
    }
  }
);

export default CreateFieldsRowField;
