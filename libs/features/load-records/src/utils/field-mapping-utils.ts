import { FieldWithRelatedEntities, ListItem } from '@jetstream/types';

export function getComboboxFieldName(item: ListItem) {
  return `${item.label} (${item.value})`;
}

export function getComboboxFieldTitle(item: ListItem) {
  return `${item.label} (${item.value}) - ${item.secondaryLabel}`;
}

export function getFieldListItems(fields: FieldWithRelatedEntities[]) {
  return fields.map((field): ListItem<string, FieldWithRelatedEntities> => ({
    id: field.name,
    label: field.label,
    value: field.name,
    secondaryLabel: field.name,
    secondaryLabelOnNewLine: true,
    tertiaryLabel: field.typeLabel,
    meta: field,
  }));
}
