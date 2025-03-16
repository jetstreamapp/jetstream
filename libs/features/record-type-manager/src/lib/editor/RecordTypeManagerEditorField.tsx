import { css } from '@emotion/react';
import { getNameOrNameAndLabelFromObj } from '@jetstream/shared/utils';
import { Grid } from '@jetstream/ui';
import { PicklistFieldEntry, SobjectWithPicklistValues } from '../types/record-types.types';
import { RecordTypeManagerEditorFieldItem } from './RecordTypeManagerEditorFieldItem';

export interface RecordTypeManagerEditorFieldProps {
  picklistFieldEntry: PicklistFieldEntry;
  recordTypeValues: SobjectWithPicklistValues['recordTypeValues'];
  onSelectAll: (fieldName: string, recordType: string, value: boolean) => void;
  onSelect: (fieldName: string, recordType: string, picklistValue: string, value: boolean) => void;
  onChangeDefaultValue: (fieldName: string, recordType: string, value: string) => void;
}

export function RecordTypeManagerEditorField({
  picklistFieldEntry,
  recordTypeValues,
  onSelectAll,
  onSelect,
  onChangeDefaultValue,
}: RecordTypeManagerEditorFieldProps) {
  return (
    <div>
      <h2 className="slds-text-heading_small">{getNameOrNameAndLabelFromObj(picklistFieldEntry, 'fieldName', 'fieldLabel')}</h2>
      <div>
        <Grid
          className="slds-p-right_x-small"
          css={css`
            max-width: 100%;
            overflow-x: auto;
          `}
        >
          {Object.entries(recordTypeValues).map(([recordTypeName, { picklistValues }]) => (
            <RecordTypeManagerEditorFieldItem
              key={recordTypeName}
              label={recordTypeName}
              picklistValues={picklistValues}
              recordTypeName={recordTypeName}
              picklistFieldEntry={picklistFieldEntry}
              onSelectAll={onSelectAll}
              onSelect={onSelect}
              onChangeDefaultValue={onChangeDefaultValue}
            />
          ))}
        </Grid>
      </div>
    </div>
  );
}
