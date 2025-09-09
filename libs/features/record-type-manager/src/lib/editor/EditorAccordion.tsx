import { Maybe } from '@jetstream/types';
import { Accordion } from '@jetstream/ui';
import { useMemo } from 'react';
import { PicklistFieldEntry, SobjectWithPicklistValues, ViewMode } from '../types/record-types.types';
import { getAccordionFieldSection, getAccordionRecordTypeSection } from '../utils/editor.utils';

export interface EditorAccordionProps {
  viewMode: ViewMode;
  picklistValues: Record<string, PicklistFieldEntry>;
  recordTypeValues: SobjectWithPicklistValues['recordTypeValues'];
  errors?: Maybe<Record<string, string[]>>;
  onSelectAll: (fieldName: string, recordType: string, value: boolean) => void;
  onSelect: (fieldName: string, recordType: string, picklistValue: string, value: boolean) => void;
  onChangeDefaultValue: (fieldName: string, recordType: string, value: string) => void;
}

export function EditorAccordion({
  picklistValues,
  recordTypeValues,
  errors,
  viewMode,
  onSelectAll,
  onSelect,
  onChangeDefaultValue,
}: EditorAccordionProps) {
  const recordTypes = Object.entries(recordTypeValues);

  const sections = useMemo(() => {
    if (viewMode === 'FIELD') {
      return Object.values(picklistValues).map((picklistFieldEntry) =>
        getAccordionFieldSection({
          picklistFieldEntry,
          recordTypes,
          errors,
          onChangeDefaultValue,
          onSelect,
          onSelectAll,
        }),
      );
    }
    return Object.values(recordTypeValues).map((recordTypeValue) =>
      getAccordionRecordTypeSection({
        picklistValues,
        recordTypeValue,
        errors,
        onChangeDefaultValue,
        onSelect,
        onSelectAll,
      }),
    );
  }, [errors, onChangeDefaultValue, onSelect, onSelectAll, picklistValues, recordTypeValues, recordTypes, viewMode]);

  return <Accordion allowMultiple showExpandCollapseAll expandAllClassName="slds-m-left_small" initOpenIds={[]} sections={sections} />;
}
