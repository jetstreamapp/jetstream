import { css } from '@emotion/react';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, ComboboxWithItems, Input, PicklistRef, Radio, RadioGroup, Spinner, Textarea } from '@jetstream/ui';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { FieldDefinition, FieldDefinitions, FieldValue, FieldValues, FieldValueState, SalesforceFieldType } from './create-fields-types';

export interface CreateFieldsRowFieldProps {
  selectedOrg: SalesforceOrgUi;
  id: string;
  fieldDefinitions: FieldDefinitions;
  field: FieldDefinition;
  allValues: FieldValues;
  valueState: FieldValueState;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
}

export const CreateFieldsRowField: FunctionComponent<CreateFieldsRowFieldProps> = ({
  selectedOrg,
  id,
  fieldDefinitions,
  field,
  allValues,
  valueState,
  disabled: _disabled,
  onChange,
  onBlur,
}) => {
  const { value, touched, isValid, errorMessage } = valueState;
  const disabled = _disabled || field?.disabled?.(allValues);
  const [values, setValues] = useState<ListItem[]>([]);
  const picklistRef = useRef<PicklistRef>();
  const [loadingValues, setLoadingValues] = useState<boolean>(false);

  useEffect(() => {
    if (typeof field.values === 'function') {
      setLoadingValues(true);
      field
        .values(selectedOrg)
        .then((_values) => {
          setValues(_values);
          if (!value && _values.length > 0) {
            onChange(_values[0].value);
            if (picklistRef.current) {
              // picklistRef.current.selectItem(_values[0].value);
              onChange(_values[0].value);
            }
          }
        })
        .catch((error) => {
          // TODO:
        })
        .finally(() => setLoadingValues(false));
    } else if (Array.isArray(field.values)) {
      setValues(field.values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.values]);

  const type = typeof field.type === 'function' ? field.type(allValues.type.value as SalesforceFieldType) : field.type;

  switch (type) {
    case 'picklist':
      return (
        <div className="slds-m-right_medium slds-is-relative">
          {loadingValues && <Spinner size="small" />}
          <ComboboxWithItems
            comboboxProps={{
              label: field.label,
              helpText: typeof field.helpText === 'function' ? field.helpText(allValues.type.value as SalesforceFieldType) : field.helpText,
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
        </div>
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
              className="slds-input"
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
};

export default CreateFieldsRowField;
