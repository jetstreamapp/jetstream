import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CloneEditView, MapOf, PicklistFieldValues, Record } from '@jetstream/types';
import { Checkbox, EmptyState, Grid, SearchInput, Select } from '@jetstream/ui';
import classNames from 'classnames';
import { Field } from 'jsforce';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { EditableFields } from './ui-record-form-types';
import { convertMetadataToEditableFields } from './ui-record-form-utils';
import UiRecordFormField from './UiRecordFormField';

export interface UiRecordFormProps {
  controlClassName?: string;
  formClassName?: string;
  action: CloneEditView;
  sobjectFields: Field[];
  picklistValues: PicklistFieldValues;
  record: Record;
  saveErrors?: MapOf<string>;
  disabled?: boolean;
  onChange: (record: Record) => void;
}

export const UiRecordForm: FunctionComponent<UiRecordFormProps> = ({
  controlClassName = 'slds-p-vertical_x-small slds-p-horizontal_large',
  formClassName,
  action,
  sobjectFields,
  picklistValues,
  record,
  saveErrors = {},
  disabled = false,
  onChange,
}) => {
  const [columnSize, setColumnSize] = useState<1 | 2 | 3 | 4>(2);
  const [showReadOnlyFields, setShowReadOnlyFields] = useState(true);
  const [showFieldTypes, setShowFieldTypes] = useState(false);
  const [limitToRequired, setLimitToRequired] = useState(false);
  const [modifiedRecord, setModifiedRecord] = useState<Record>({});
  const [visibleFieldMetadataRows, setVisibleFieldMetadataRows] = useState<EditableFields[][]>();
  const [fieldMetadata, setFieldMetadata] = useState(() => {
    return convertMetadataToEditableFields(sobjectFields, picklistValues, action, record);
  });

  const [filter, setFilter] = useState('');
  const debouncedFilters = useDebounce(filter);

  useEffect(() => {
    if (fieldMetadata) {
      let visibleFields = fieldMetadata;
      if (action === 'create' || action === 'clone') {
        visibleFields = visibleFields.filter((field) => field.metadata.createable);
      }
      if (debouncedFilters) {
        visibleFields = fieldMetadata.filter(multiWordObjectFilter(['name', 'label', 'type'], debouncedFilters));
      }
      if (!showReadOnlyFields) {
        visibleFields = visibleFields.filter((field) => !field.readOnly);
      }
      if (limitToRequired) {
        visibleFields = visibleFields.filter((field) => !field.metadata.nillable && field.metadata.createable);
      }
      if (visibleFields.length) {
        setVisibleFieldMetadataRows(splitArrayToMaxSize(visibleFields, columnSize));
      } else {
        setVisibleFieldMetadataRows([]);
      }
    }
  }, [fieldMetadata, debouncedFilters, showReadOnlyFields, columnSize, limitToRequired, action]);

  useNonInitialEffect(() => {
    setFieldMetadata(convertMetadataToEditableFields(sobjectFields, picklistValues, action, record));
  }, [sobjectFields, picklistValues, action, record]);

  useNonInitialEffect(() => {
    onChange(modifiedRecord);
  }, [modifiedRecord, onChange]);

  function handleRecordUpdate(field: EditableFields, value: string | boolean | null, isDirty: boolean) {
    if (isDirty) {
      setModifiedRecord({ ...modifiedRecord, [field.name]: value });
    } else if (!isDirty && modifiedRecord[field.name] !== undefined) {
      setModifiedRecord({ ...modifiedRecord, [field.name]: undefined });
    }
  }

  return (
    <Fragment>
      <div className={controlClassName}>
        <Grid>
          <Select id={'num-columns'} className="slds-m-right_small">
            <select
              aria-describedby="num-columns"
              className="slds-select"
              id="num-columns-select"
              required
              value={columnSize}
              disabled={!fieldMetadata}
              onChange={(event) => setColumnSize(Number(event.target.value) as 1 | 2 | 3)}
            >
              <option value={1}>1 Column</option>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
            </select>
          </Select>
          <SearchInput
            id="record-field-filter"
            className="slds-grow"
            value={filter}
            placeholder="Filter by API name, label, or type"
            disabled={!fieldMetadata || disabled}
            onChange={setFilter}
          />
        </Grid>
        <Grid>
          {!(action === 'create' || action === 'clone') && (
            <Checkbox
              id={`record-form-show-readonly`}
              label="Include read-only fields"
              checked={showReadOnlyFields}
              disabled={!fieldMetadata || disabled}
              onChange={setShowReadOnlyFields}
            />
          )}
          <Checkbox
            id={`record-form-show-field-types`}
            label="Show fields types"
            checked={showFieldTypes}
            disabled={!fieldMetadata || disabled}
            onChange={setShowFieldTypes}
          />
          <Checkbox
            id={`record-form-limit-to-required`}
            label="Limit to required fields"
            checked={limitToRequired}
            disabled={!fieldMetadata || disabled}
            onChange={setLimitToRequired}
          />
        </Grid>
      </div>
      <hr className="slds-m-around_xx-small" />
      {fieldMetadata?.length && !visibleFieldMetadataRows?.length && (
        <EmptyState headline="There are no matching fields" subHeading="Adjust your selection."></EmptyState>
      )}
      {visibleFieldMetadataRows && (
        <div className={classNames('slds-form', formClassName)} role="list">
          {visibleFieldMetadataRows.map((row, i) => (
            <div key={i} className="slds-form__row">
              {row.map((field) => (
                <div key={field.name} className="slds-form__item" role="listitem">
                  <UiRecordFormField
                    field={field}
                    saveError={saveErrors[field.name]}
                    disabled={disabled}
                    initialValue={record[field.name]}
                    modifiedValue={modifiedRecord[field.name]}
                    showFieldTypes={showFieldTypes}
                    omitUndoIndicator={action === 'create'}
                    onChange={handleRecordUpdate}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Fragment>
  );
};

export default UiRecordForm;
