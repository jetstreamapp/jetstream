import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Input, Picklist, PicklistRef, Radio, RadioGroup, Spinner, Textarea } from '@jetstream/ui';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { FieldDefinition, FieldDefinitions, FieldValueState, FieldValue, FieldValues } from './create-fields-types';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
  // TODO: use this
  const [loadingValues, setLoadingValues] = useState<boolean>(false);

  useEffect(() => {
    if (typeof field.values === 'function') {
      // TODO: handle errors
      // TODO: figure out what other stuff I need to pass in
      setLoadingValues(true);
      field
        .values(selectedOrg)
        .then((_values) => {
          setValues(_values);
          if (!value && _values.length > 0) {
            onChange(_values[0].value);
            if (picklistRef.current) {
              picklistRef.current.selectItem(_values[0].value);
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

  switch (field.type) {
    case 'picklist':
      return (
        <div className="slds-m-right_medium slds-is-relative">
          {loadingValues && <Spinner size="small" />}
          <Picklist
            ref={picklistRef}
            label={field.label}
            isRequired={field.required}
            helpText={field.helpText}
            labelHelp={field.labelHelp}
            items={values}
            selectedItemIds={value ? [value as string] : undefined}
            allowDeselection={false}
            disabled={disabled}
            scrollLength={10}
            hasError={touched && !!errorMessage}
            errorMessage={errorMessage}
            errorMessageId={`${id}-${field.label}-error`}
            // TODO: do we want the value or the
            onChange={(items) => onChange(items[0].id)}
            onBlur={onBlur}
          />
        </div>
      );
    case 'checkbox':
      return (
        <div className="slds-m-right_medium slds-is-relative">
          {loadingValues && <Spinner size="small" />}
          <Checkbox
            id={`${id}-${field.label}`}
            checked={value as boolean}
            label={field.label}
            isRequired={field.required}
            helpText={field.helpText}
            labelHelp={field.labelHelp}
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
        <div className="slds-m-right_medium slds-is-relative">
          {loadingValues && <Spinner size="small" />}
          <RadioGroup
            idPrefix={id}
            label={field.label}
            required={field.required}
            helpText={field.helpText}
            labelHelp={field.labelHelp}
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
        <div className="slds-m-right_medium slds-is-relative">
          {loadingValues && <Spinner size="small" />}
          <Textarea
            id={`${id}-${field.label}`}
            label={field.label}
            isRequired={field.required}
            helpText={field.helpText}
            labelHelp={field.labelHelp}
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
        <div className="slds-m-right_medium slds-is-relative">
          {loadingValues && <Spinner size="small" />}
          <Input
            label={field.label}
            isRequired={field.required}
            helpText={field.helpText}
            labelHelp={field.labelHelp}
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
