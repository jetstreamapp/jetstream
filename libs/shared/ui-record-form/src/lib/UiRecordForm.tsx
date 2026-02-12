import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CloneEditView, Field, PicklistFieldValues, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import { Checkbox, EmptyState, Grid, SearchInput, Select } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import UiRecordFormField from './UiRecordFormField';
import { EditableFields } from './ui-record-form-types';
import { convertMetadataToEditableFields, OWNER_AND_AUDIT_FIELDS } from './ui-record-form-utils';

export interface UiRecordFormProps {
  org: SalesforceOrgUi;
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
  org,
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

  const isCreateOrClone = action === 'create' || action === 'clone';

  useEffect(() => {
    if (fieldMetadata) {
      let visibleFields = fieldMetadata;
      if (isCreateOrClone) {
        visibleFields = visibleFields.filter((field) => field.metadata.createable);
      }
      if (debouncedFilters) {
        visibleFields = fieldMetadata.filter(multiWordObjectFilter(['name', 'label', 'type'], debouncedFilters));
      }
      if (limitToRequired) {
        visibleFields = visibleFields.filter((field) => {
          if (field.metadata.nillable) {
            return false;
          }
          if (field.metadata.type === 'boolean') {
            return false;
          }
          if (!field.metadata.createable) {
            return false;
          }
          if (isCreateOrClone && OWNER_AND_AUDIT_FIELDS.has(field.name)) {
            return false;
          }
          return true;
        });
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
  }, [fieldMetadata, debouncedFilters, columnSize, limitToRequired, limitToErrorFields, saveErrors, isCreateOrClone]);

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
                    org={org}
                    field={field}
                    saveError={saveErrors?.[field.name]}
                    disabled={disabled}
                    initialValue={record[field.name]}
                    modifiedValue={modifiedRecord[field.name]}
                    relatedRecord={field.metadata.relationshipName ? record[field.metadata.relationshipName] : null}
                    showFieldTypes={showFieldTypes}
                    omitUndoIndicator={action === 'create'}
                    showOwnerAndAuditFieldsAsOptional={isCreateOrClone}
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
