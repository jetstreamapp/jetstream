import { ListItem, PicklistFieldValueItem } from '@jetstream/types';
import { Field } from 'jsforce';

export type EditableFields =
  | EditableFieldInput
  | EditableFieldCheckbox
  | EditableFieldDate
  | EditableFieldDateTime
  | EditableFieldTextarea
  | EditableFieldPicklist;

export interface EditableField {
  type: 'input' | 'textarea' | 'picklist' | 'date' | 'datetime' | 'checkbox';
  label: string;
  name: string;
  labelHelpText?: string;
  inputHelpText: string;
  required: boolean;
  readOnly: boolean;
  metadata: Field;
}

export interface EditableFieldInput extends EditableField {
  type: 'input';
  maxLength?: number | undefined;
  inputMode?: 'decimal' | undefined;
  step?: 'any' | undefined;
}

export interface EditableFieldCheckbox extends EditableField {
  type: 'checkbox';
}

export interface EditableFieldTextarea extends EditableField {
  type: 'textarea';
  isRichTextarea: boolean;
  maxLength?: number | undefined;
}
export interface EditableFieldDate extends EditableField {
  type: 'date';
}
export interface EditableFieldDateTime extends EditableField {
  type: 'datetime';
}

export interface EditableFieldPicklist extends EditableField {
  type: 'picklist';
  defaultValue: string | null;
  values: ListItem<string, PicklistFieldValueItem>[];
}
