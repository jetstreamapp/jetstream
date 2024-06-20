import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { polyfillFieldDefinition } from '@jetstream/shared/ui-utils';
import { Field, ListItem, Maybe, PicklistFieldValueItem, RecordAttributes } from '@jetstream/types';
import { Checkbox, DatePicker, DateTime, Grid, Icon, Input, Picklist, ReadOnlyFormElement, Textarea, TimePicker } from '@jetstream/ui';
import classNames from 'classnames';
import { formatISO } from 'date-fns/formatISO';
import { parseISO } from 'date-fns/parseISO';
import { roundToNearestMinutes } from 'date-fns/roundToNearestMinutes';
import { startOfDay } from 'date-fns/startOfDay';
import uniqueId from 'lodash/uniqueId';
import { Fragment, FunctionComponent, ReactNode, SyntheticEvent, useEffect, useState } from 'react';
import { EditableFields } from './ui-record-form-types';
import { isCheckbox, isDate, isDateTime, isInput, isPicklist, isTextarea, isTime } from './ui-record-form-utils';

const REPLACE_NON_NUMERIC = /[^\d.-]/g;

function getInitialValue(initialValue: string | boolean | null, field: EditableFields): string | string[] | boolean | null {
  if (initialValue) {
    const { metadata } = field;
    if (metadata.type === 'date') {
      try {
        return formatISO(startOfDay(parseISO(initialValue as string)));
      } catch (ex) {
        logger.warn('Error parsing date value', ex);
      }
    } else if (metadata.type === 'datetime') {
      try {
        return formatISO(roundToNearestMinutes(parseISO(initialValue as string)));
      } catch (ex) {
        logger.warn('Error parsing datetime value', ex);
      }
    } else if (metadata.type === 'picklist') {
      return [initialValue as string];
    } else if (metadata.type === 'multipicklist') {
      return (initialValue as string).split(';').sort();
    }
  } else if (initialValue == null && (isInput(field) || isTextarea(field))) {
    return '';
  }
  return initialValue;
}

function getInitialModifiedValue(
  modifiedValue: string | boolean | null,
  initialValue: string | boolean | string[] | null,
  field: EditableFields
) {
  if (modifiedValue !== null && modifiedValue !== undefined) {
    return getInitialValue(modifiedValue, field);
  }
  return initialValue;
}

export interface UiRecordFormFieldProps {
  field: EditableFields;
  saveError?: string;
  disabled?: boolean;
  initialValue: string | boolean | null;
  modifiedValue: string | boolean | null;
  relatedRecord?: Maybe<{ attributes: RecordAttributes; Name: string }>;
  showFieldTypes: boolean;
  omitUndoIndicator?: boolean;
  hideLabel?: boolean;
  usePortal?: boolean;
  // picklist values are converted to strings prior to emitting
  onChange: (field: EditableFields, value: string | boolean | null, isDirty: boolean) => void;
  viewRelatedRecord?: (recordId: string, metadata: Field) => void;
}

function getUndoKey(name: string) {
  return uniqueId(`undo-key-${name}`);
}
export const UiRecordFormField: FunctionComponent<UiRecordFormFieldProps> = ({
  field,
  saveError,
  disabled,
  initialValue: _initialValue,
  modifiedValue,
  relatedRecord,
  showFieldTypes,
  omitUndoIndicator,
  hideLabel = false,
  usePortal = false,
  onChange,
  viewRelatedRecord,
}) => {
  const { label, name, labelHelpText, readOnly, metadata } = field;
  const required = !readOnly && field.required;
  const [id] = useState(uniqueId(name));
  const [key, setKey] = useState(getUndoKey(name));
  const [initialValue] = useState(() => getInitialValue(_initialValue, field));
  const [value, setValue] = useState(() => getInitialModifiedValue(modifiedValue, initialValue, field));
  const [isDirty, setIsDirty] = useState(readOnly ? false : checkIfDirty(false, modifiedValue).isDirty);
  const [helpText, setHelpText] = useState<ReactNode>();

  const [initialSelectedDate] = useState(() => {
    if (value && (isDate(field) || isDateTime(field))) {
      return parseISO(value as string);
    }
  });

  const [formatter] = useState(() => {
    if (metadata.type === 'currency' || metadata.type === 'double' || metadata.type === 'int' || metadata.type === 'percent') {
      return (value: string) => (value ? value.replace(REPLACE_NON_NUMERIC, '') : value);
    }
    return (value: string) => value;
  });

  useEffect(() => {
    if (showFieldTypes && !helpText) {
      setHelpText(<span className="slds-text-color_weak">{polyfillFieldDefinition(metadata)}</span>);
    } else if (!showFieldTypes && helpText) {
      setHelpText(null);
    }
  }, [readOnly, showFieldTypes, metadata, helpText]);

  useEffect(() => {
    if (showFieldTypes && !helpText) {
      setHelpText(<span className="slds-text-color_weak">{polyfillFieldDefinition(metadata)}</span>);
    } else if (!showFieldTypes && helpText) {
      setHelpText(null);
    }
  }, [readOnly, showFieldTypes, metadata, helpText]);

  function checkIfDirty(
    isDirty: boolean,
    valueOverride?: string | string[] | boolean | null
  ): { value: string | boolean | null; isDirty: boolean } {
    const priorDirtyValue = isDirty;
    let newDirtyValue = isDirty;
    let tempValue = valueOverride !== undefined ? valueOverride : value;
    let tempInitialValue = initialValue;

    // transform to string for accurate comparison
    if (metadata.type === 'picklist') {
      if (typeof valueOverride === 'string' && valueOverride.length) {
        tempValue = [valueOverride];
      }
      tempValue = Array.isArray(tempValue) && tempValue.length ? tempValue[0] : '';
      tempInitialValue = Array.isArray(tempInitialValue) && tempInitialValue.length ? tempInitialValue[0] : '';
    } else if (metadata.type === 'multipicklist') {
      tempValue = Array.isArray(tempValue) ? tempValue.sort().join(';') : '';
      tempInitialValue = Array.isArray(tempInitialValue) ? tempInitialValue.join(';') : '';
    }

    if (priorDirtyValue && tempValue === tempInitialValue) {
      newDirtyValue = false;
    } else if (!priorDirtyValue && tempValue !== tempInitialValue) {
      newDirtyValue = true;
    }

    return {
      value: tempValue as string | boolean | null,
      isDirty: newDirtyValue,
    };
  }

  function checkIfDirtyAndEmit(valueOverride?: string | string[] | boolean | null) {
    if (!readOnly) {
      const dirtyValue = checkIfDirty(isDirty, valueOverride);
      if (isDirty !== dirtyValue.isDirty) {
        setIsDirty(dirtyValue.isDirty);
      }
      onChange(field, dirtyValue.value, dirtyValue.isDirty);
    }
  }

  function handleInputChange(event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setValue(formatter(event.currentTarget.value));
  }

  function handleInputBlur(event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) {
    checkIfDirtyAndEmit();
  }

  function handleCheckboxChange(currValue: boolean) {
    setValue(currValue);
    checkIfDirtyAndEmit(currValue);
  }

  function handleDateChange(currValue: Date) {
    let newValue = value as string;
    try {
      newValue = currValue ? formatISO(currValue) : '';
    } catch (ex) {
      // could not parse date - keeping old value
    } finally {
      setValue(newValue);
      checkIfDirtyAndEmit(newValue || null);
    }
  }

  function handleDateTimeChange(currValue: string) {
    setValue(currValue);
    checkIfDirtyAndEmit(currValue || null);
  }

  function handleTimeChange(currValue: string) {
    setValue(currValue);
    checkIfDirtyAndEmit(currValue || null);
  }

  function handlePicklistValueChange(values: ListItem<string, PicklistFieldValueItem>[]) {
    const newValue = values.map((item) => item.value);
    setValue(newValue);
    checkIfDirtyAndEmit(newValue);
  }

  function handleClearInput() {
    setValue('');
    checkIfDirtyAndEmit('');
  }

  function handleUndo() {
    setValue(initialValue);
    setKey(getUndoKey(name));
    checkIfDirtyAndEmit(initialValue as any);
  }

  const showAsDirty = isDirty && !omitUndoIndicator;

  return (
    <Grid className={classNames('slds-size_1-of-1 slds-p-horizontal--x-small', { 'active-item-yellow-bg': showAsDirty })} vertical>
      {showAsDirty && (
        <div
          css={css`
            margin-left: auto;
          `}
        >
          <button className="slds-button slds-button_icon slds-button_icon-bare" onClick={() => handleUndo()}>
            <Icon
              type="utility"
              icon="undo"
              description="Undo"
              title="undo"
              className="slds-button__icon slds-button__icon_hint"
              omitContainer
            />
          </button>
        </div>
      )}
      <div>
        {readOnly && (
          <ReadOnlyFormElement
            id={id}
            metadata={metadata}
            label={label}
            className="slds-m-bottom_x-small"
            errorMessage={saveError}
            labelHelp={labelHelpText}
            helpText={helpText}
            isRequired={required}
            hasError={!!saveError}
            errorMessageId={`${id}-error`}
            value={(value as string) || ''}
            bottomBorder
            relatedRecord={relatedRecord}
            viewRelatedRecord={viewRelatedRecord}
          />
        )}

        {!readOnly && (
          <Fragment>
            {isInput(field) && (
              <Input
                id={id}
                label={label}
                hideLabel={hideLabel}
                className="slds-form-element_stacked slds-is-editing"
                errorMessage={saveError}
                labelHelp={labelHelpText}
                helpText={helpText}
                isRequired={required}
                hasError={!!saveError}
                errorMessageId={`${id}-error`}
                clearButton={!readOnly && !!value}
                onClear={handleClearInput}
              >
                <input
                  id={id}
                  className="slds-input"
                  required={required}
                  disabled={disabled}
                  value={(value as string) || ''}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  aria-describedby={`${id}-error`}
                  maxLength={field.maxLength}
                  inputMode={field.inputMode}
                  step={field.step}
                />
              </Input>
            )}
            {isCheckbox(field) && (
              <Checkbox
                id={id}
                checked={!!value}
                label={label}
                hideLabel={hideLabel}
                className="slds-form-element_stacked slds-is-editing"
                isStandAlone
                errorMessage={saveError}
                labelHelp={labelHelpText}
                helpText={helpText}
                isRequired={required}
                hasError={!!saveError}
                errorMessageId={`${id}-error`}
                disabled={disabled}
                onChange={handleCheckboxChange}
              />
            )}
            {isDate(field) && (
              <DatePicker
                key={key}
                id={id}
                label={label}
                hideLabel={hideLabel}
                className="slds-form-element_stacked slds-is-editing"
                containerDisplay="contents"
                errorMessage={saveError}
                labelHelp={labelHelpText}
                helpText={helpText}
                isRequired={!readOnly && required}
                hasError={!!saveError}
                errorMessageId={`${id}-error`}
                initialSelectedDate={initialSelectedDate}
                disabled={disabled}
                usePortal={usePortal}
                onChange={handleDateChange}
              />
            )}

            {isDateTime(field) && (
              <DateTime
                key={key}
                initialDateValue={initialSelectedDate}
                dateProps={{
                  id,
                  label,
                  className: 'slds-form-element_stacked slds-is-editing',
                  containerDisplay: 'contents',
                  errorMessage: saveError,
                  hideLabel,
                  labelHelp: labelHelpText,
                  helpText: helpText,
                  isRequired: !readOnly && required,
                  hasError: !!saveError,
                  errorMessageId: `${id}-error`,
                  disabled: disabled,
                  usePortal,
                }}
                timeProps={{
                  label: 'Time',
                  hideLabel,
                  className: 'slds-form-element_stacked slds-is-editing',
                  stepInMinutes: 1,
                  disabled: disabled,
                }}
                onChange={handleDateTimeChange}
              />
            )}

            {isTime(field) && (
              <TimePicker
                id={id}
                label={label}
                hideLabel={hideLabel}
                className="slds-form-element_stacked slds-is-editing"
                errorMessage={saveError}
                labelHelp={labelHelpText}
                helpText={helpText}
                isRequired={required}
                hasError={!!saveError}
                errorMessageId={`${id}-error`}
                selectedItem={value as string}
                disabled={disabled}
                stepInMinutes={1}
                onChange={handleTimeChange}
              />
            )}

            {isTextarea(field) && (
              <Textarea
                id={id}
                label={label}
                hideLabel={hideLabel}
                className="slds-form-element_stacked slds-is-editing"
                errorMessage={saveError}
                labelHelp={labelHelpText}
                helpText={helpText}
                isRequired={required}
                hasError={!!saveError}
                errorMessageId={`${id}-error`}
              >
                <textarea
                  id={id}
                  className="slds-textarea"
                  required={required}
                  disabled={disabled}
                  value={(value as string) || ''}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  aria-describedby={`${id}-error`}
                  maxLength={metadata.length}
                />
              </Textarea>
            )}

            {isPicklist(field) && (
              <Picklist
                key={key}
                id={id}
                label={label}
                hideLabel={hideLabel}
                className="slds-form-element_stacked slds-is-editing"
                containerDisplay="contents"
                omitMultiSelectPills
                errorMessage={saveError}
                labelHelp={labelHelpText}
                helpText={helpText}
                isRequired={required}
                hasError={!!saveError}
                errorMessageId={`${id}-error`}
                multiSelection={field.metadata.type === 'multipicklist'}
                allowDeselection
                items={field.values}
                selectedItemIds={(value as string[]) || ['']}
                disabled={disabled}
                onChange={handlePicklistValueChange}
              ></Picklist>
            )}
          </Fragment>
        )}
      </div>
    </Grid>
  );
};

export default UiRecordFormField;
