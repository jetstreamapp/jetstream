import { css } from '@emotion/react';
import { getNameOrNameAndLabelFromObj } from '@jetstream/shared/utils';
import { UiSection } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { AccordionTitle } from '../editor/AccordionTitle';
import { EditorAccordionProps } from '../editor/EditorAccordion';
import { RecordTypeManagerEditorFieldItem } from '../editor/RecordTypeManagerEditorFieldItem';
import { PicklistFieldEntry, RecordTypeValue } from '../types/record-types.types';

type GetAccordionFieldSectionProps = {
  picklistFieldEntry: PicklistFieldEntry;
  recordTypes: [string, RecordTypeValue][];
} & Pick<EditorAccordionProps, 'errors' | 'onSelect' | 'onChangeDefaultValue' | 'onSelectAll'>;

type GetAccordionRecordTypeSectionProps = {
  recordTypeValue: RecordTypeValue;
} & Pick<EditorAccordionProps, 'picklistValues' | 'errors' | 'onSelect' | 'onChangeDefaultValue' | 'onSelectAll'>;

export const getAccordionFieldSection = ({
  picklistFieldEntry,
  recordTypes,
  errors,
  onChangeDefaultValue,
  onSelect,
  onSelectAll,
}: GetAccordionFieldSectionProps): UiSection => {
  const titleText = getNameOrNameAndLabelFromObj(picklistFieldEntry, 'fieldName', 'fieldLabel');

  return {
    id: picklistFieldEntry.fieldName,
    title: <AccordionTitle titleText={titleText} hasError={!!errors?.[picklistFieldEntry.fieldName]} />,
    titleText,
    // TODO: this should show the number of modified items in this section
    // titleSummaryIfCollapsed: (
    //   <Badge className="slds-m-left_x-small slds-truncate">
    //     {formatNumber(Object.keys(picklistValues).length)} {pluralizeIfMultiple('Record Types', Object.keys(recordTypes))}
    //   </Badge>
    // ),
    content: (
      <div>
        <Grid
          className="slds-p-right_x-small"
          css={css`
            max-width: 100%;
            overflow-x: auto;
          `}
        >
          {recordTypes.map(([recordTypeName, recordTypeValue]) => (
            <RecordTypeManagerEditorFieldItem
              key={recordTypeName}
              label={getNameOrNameAndLabelFromObj(recordTypeValue, 'recordType', 'recordTypeLabel')}
              picklistValues={recordTypeValue.picklistValues}
              recordTypeName={recordTypeName}
              picklistFieldEntry={picklistFieldEntry}
              onSelectAll={onSelectAll}
              onSelect={onSelect}
              onChangeDefaultValue={onChangeDefaultValue}
            />
          ))}
        </Grid>
      </div>
    ),
  };
};

export const getAccordionRecordTypeSection = ({
  picklistValues,
  recordTypeValue,
  errors,
  onChangeDefaultValue,
  onSelect,
  onSelectAll,
}: GetAccordionRecordTypeSectionProps): UiSection => {
  const titleText = getNameOrNameAndLabelFromObj(recordTypeValue, 'recordType', 'recordTypeLabel');

  return {
    id: recordTypeValue.recordType,
    // FIXME:
    title: <AccordionTitle titleText={titleText} hasError={!!errors?.[recordTypeValue.recordType]} />,
    titleText,
    // TODO: this should show the number of modified items in this section
    // titleSummaryIfCollapsed: (
    //   <Badge className="slds-m-left_x-small slds-truncate">
    //     {formatNumber(Object.keys(picklistValues).length)} {pluralizeIfMultiple('Record Types', Object.keys(recordTypes))}
    //   </Badge>
    // ),
    content: (
      <div>
        <Grid
          className="slds-p-right_x-small"
          css={css`
            max-width: 100%;
            overflow-x: auto;
          `}
        >
          {Object.values(picklistValues).map((picklistFieldEntry) => (
            <RecordTypeManagerEditorFieldItem
              key={picklistFieldEntry.fieldName}
              label={getNameOrNameAndLabelFromObj(picklistFieldEntry, 'fieldName', 'fieldLabel')}
              picklistValues={recordTypeValue.picklistValues}
              recordTypeName={recordTypeValue.recordType}
              picklistFieldEntry={picklistFieldEntry}
              onSelectAll={onSelectAll}
              onSelect={onSelect}
              onChangeDefaultValue={onChangeDefaultValue}
            />
          ))}
        </Grid>
      </div>
    ),
  };
};
