import { describeSObject } from '@jetstream/shared/data';
import { getFlattenedListItemsById, sortQueryFields, unFlattenedListItemsById } from '@jetstream/shared/ui-utils';
import { ListItem } from '@jetstream/types';
import type { DescribeSObjectResult, Field } from 'jsforce';
import { useCallback, useState } from 'react';

/**
 * Helper hook for working with ComboboxWithDrillInItems for a list of fields
 * Fetches initial metadata and fetched child records on-demand
 */
export function useFieldListItemsWithDrillIn(selectedOrg, sobject) {
  const [fields, setFields] = useState<ListItem[]>([]);

  const loadFields = useCallback(async (): Promise<{ describe: DescribeSObjectResult; fields: Field[] }> => {
    const { data } = await describeSObject(selectedOrg, sobject);

    const sortedFields = sortQueryFields(data.fields);
    setFields(getListItemsWithRelatedItems(sortedFields));

    return { describe: data, fields: sortedFields };
  }, [selectedOrg, sobject]);

  const loadChildFields = useCallback(
    async (item: ListItem): Promise<ListItem[]> => {
      const field = item.meta as Field;
      if (!Array.isArray(field.referenceTo) || field.referenceTo.length <= 0) {
        return [];
      }
      const { data } = await describeSObject(selectedOrg, field.referenceTo?.[0] || '');
      const allFieldMetadata = sortQueryFields(data.fields);
      const newFields = getListItemsWithRelatedItems(allFieldMetadata, item.id);

      setFields((prevValues) => {
        const allItems = getFlattenedListItemsById(prevValues);
        allItems[item.id].childItems = newFields;
        const newItems = unFlattenedListItemsById(allItems);
        return newItems;
      });
      return newFields;
    },
    [selectedOrg]
  );

  return {
    fields,
    loadFields,
    loadChildFields,
  };
}

function getListItemsWithRelatedItems(fields: Field[], parentId = ''): ListItem[] {
  const parentPath = parentId ? `${parentId}.` : '';
  const allowChildren = parentPath.split('.').length <= 6;
  const relatedFields: ListItem[] = fields
    .filter((field) => allowChildren && Array.isArray(field.referenceTo) && field.referenceTo.length > 0 && field.relationshipName)
    .map((field) => ({
      id: `${parentPath}${field.relationshipName}`,
      value: `${parentPath}${field.relationshipName}`,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      label: field.relationshipName!,
      secondaryLabel: field.referenceTo?.[0],
      secondaryLabelOnNewLine: false,
      isDrillInItem: true,
      parentId: parentId,
      meta: field,
    }));

  const coreFields: ListItem[] = fields.flatMap((field) => ({
    id: `${parentPath}${field.name}`,
    value: `${parentPath}${field.name}`,
    label: field.label,
    secondaryLabel: field.name,
    secondaryLabelOnNewLine: true,
    parentId: parentId,
    meta: field,
  }));

  return [...relatedFields, ...coreFields];
}
