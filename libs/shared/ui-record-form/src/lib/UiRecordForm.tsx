/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { CloneEditView, MapOf, PicklistFieldValues, Record } from '@jetstream/types';
import { Field } from 'jsforce';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { EditableFields } from './ui-record-form-types';
import { convertMetadataToEditableFields } from './ui-record-form-utils';
import UiRecordFormField from './UiRecordFormField';

/* eslint-disable-next-line */
export interface UiRecordFormProps {
  action: CloneEditView;
  sobjectFields: Field[];
  picklistValues: PicklistFieldValues;
  record: Record;
  showReadOnlyFields?: boolean;
  showFieldTypes?: boolean;
  saveErrors?: MapOf<string>;
  disabled?: boolean;
  onChange: (record: Record) => void;
}

export const UiRecordForm: FunctionComponent<UiRecordFormProps> = ({
  action,
  sobjectFields,
  picklistValues,
  record,
  showReadOnlyFields = true,
  showFieldTypes = false,
  saveErrors = {},
  disabled = false,
  onChange,
}) => {
  // used to avoid re-renders when value changes since children manage all state of their own values
  // const recordRef = useRef<Record>({ ...record });
  const [modifiedRecord, setModifiedRecord] = useState<Record>({});
  const [fieldMetadataRows, setFieldMetadataRows] = useState<EditableFields[][]>();
  const [fieldMetadata, setFieldMetadata] = useState(() => {
    return convertMetadataToEditableFields(sobjectFields, picklistValues, action, record);
  });

  useNonInitialEffect(() => {
    setFieldMetadata(convertMetadataToEditableFields(sobjectFields, picklistValues, action, record));
  }, [sobjectFields, picklistValues]);

  useEffect(() => {
    if (Array.isArray(fieldMetadata)) {
      setFieldMetadataRows(splitArrayToMaxSize(fieldMetadata, 2));
    }
  }, [fieldMetadata]);

  useNonInitialEffect(() => {
    onChange(modifiedRecord);
  }, [modifiedRecord]);

  function handleRecordUpdate(field: EditableFields, value: string | boolean | null, isDirty: boolean) {
    if (isDirty) {
      setModifiedRecord({ ...modifiedRecord, [field.name]: value });
    } else if (!isDirty && modifiedRecord[field.name] !== undefined) {
      setModifiedRecord({ ...modifiedRecord, [field.name]: undefined });
    }
  }

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {fieldMetadataRows && (
        <div className="slds-form" role="list">
          {fieldMetadataRows.map((row, i) => (
            <div key={i} className="slds-form__row">
              {row.map((field) => {
                if (!showReadOnlyFields && field.readOnly) {
                  return <div key={field.name} className="slds-form__item" role="listitem" />;
                }
                return (
                  <div key={field.name} className="slds-form__item" role="listitem">
                    <UiRecordFormField
                      field={field}
                      saveError={saveErrors[field.name]}
                      disabled={disabled}
                      initialValue={record[field.name]}
                      showFieldTypes={showFieldTypes}
                      omitUndoIndicator={action === 'create'}
                      onChange={handleRecordUpdate}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Fragment>
  );
};

export default UiRecordForm;
