import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CloneEditView, Field, PicklistFieldValues, SalesforceRecord } from '@jetstream/types';
import { Checkbox, EmptyState, Grid, SearchInput, Select } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import UiRecordFormField from './UiRecordFormField';
import { EditableFields } from './ui-record-form-types';
import { convertMetadataToEditableFields } from './ui-record-form-utils';

export interface UiRecordFormProps {
  controlClassName?: string;
  formClassName?: string;
  action: CloneEditView;
  sobjectFields: Field[];
  picklistValues: PicklistFieldValues;
  record: SalesforceRecord;
  saveErrors?: Record<string, string | undefined>;
  disabled?: boolean;
  onChange: (record: SalesforceRecord) => void;
  viewRelatedRecord?: (recordId: string, metadata: Field) => void;
}

export const UiRecordForm: FunctionComponent<UiRecordFormProps> = ({
  controlClassName = 'slds-p-vertical_x-small slds-p-horizontal_large',
  formClassName,
  action,
  sobjectFields,
  picklistValues,
  record,
  saveErrors,
  disabled = false,
  onChange,
  viewRelatedRecord,
}) => {
  const [columnSize, setColumnSize] = useState<1 | 2 | 3 | 4>(2);
  const [showReadOnlyFields, setShowReadOnlyFields] = useState(true);
  const [showFieldTypes, setShowFieldTypes] = useState(false);
  const [limitToRequired, setLimitToRequired] = useState(false);
  const [limitToErrorFields, setLimitToErrorFields] = useState(false);
  const [modifiedRecord, setModifiedRecord] = useState<SalesforceRecord>({});
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
        visibleFields = visibleFields.filter(
          (field) => !field.metadata.nillable && field.metadata.type !== 'boolean' && field.metadata.createable
        );
      }
      if (limitToErrorFields) {
        visibleFields = visibleFields.filter((field) => saveErrors?.[field.name]);
      }
      if (visibleFields.length) {
        setVisibleFieldMetadataRows(splitArrayToMaxSize(visibleFields, columnSize));
      } else {
        setVisibleFieldMetadataRows([]);
      }
    }
  }, [fieldMetadata, debouncedFilters, showReadOnlyFields, columnSize, limitToRequired, action, limitToErrorFields, saveErrors]);

  useNonInitialEffect(() => {
    setFieldMetadata(convertMetadataToEditableFields(sobjectFields, picklistValues, action, record));
  }, [sobjectFields, picklistValues, action, record]);

  function handleRecordUpdate(field: EditableFields, value: string | boolean | null, isDirty: boolean) {
    const tempModifiedRecord = { ...modifiedRecord, [field.name]: value };
    if (isDirty) {
      setModifiedRecord(tempModifiedRecord);
      onChange(tempModifiedRecord);
    } else if (!isDirty && modifiedRecord[field.name] !== undefined) {
      tempModifiedRecord[field.name] = undefined;
      setModifiedRecord(tempModifiedRecord);
      onChange(tempModifiedRecord);
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
          {(action === 'create' || action === 'clone') && (
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
          {saveErrors && Object.keys(saveErrors).length > 0 && (
            <Checkbox
              id={`record-form-limit-to-error`}
              label="Show Fields with Errors"
              checked={limitToErrorFields}
              disabled={!fieldMetadata || disabled}
              onChange={setLimitToErrorFields}
            />
          )}
        </Grid>
      </div>
      <hr className="slds-m-around_xx-small" />
      {!!fieldMetadata?.length && !visibleFieldMetadataRows?.length && (
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
                    saveError={saveErrors?.[field.name]}
                    disabled={disabled}
                    initialValue={record[field.name]}
                    modifiedValue={modifiedRecord[field.name]}
                    relatedRecord={field.metadata.relationshipName ? record[field.metadata.relationshipName] : null}
                    showFieldTypes={showFieldTypes}
                    omitUndoIndicator={action === 'create'}
                    onChange={handleRecordUpdate}
                    viewRelatedRecord={viewRelatedRecord}
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
