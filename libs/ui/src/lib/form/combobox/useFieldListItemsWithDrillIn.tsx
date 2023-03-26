import { describeSObject } from '@jetstream/shared/data';
import {
  getFlattenedListItemsById,
  getListItemsFromFieldWithRelatedItems,
  sortQueryFields,
  unFlattenedListItemsById,
} from '@jetstream/shared/ui-utils';
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
    setFields(getListItemsFromFieldWithRelatedItems(sortedFields));

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
      const childFields = getListItemsFromFieldWithRelatedItems(allFieldMetadata, item.id);

      setFields((prevValues) => {
        let allItems = getFlattenedListItemsById(prevValues);
        allItems = { ...allItems, [item.id]: { ...allItems[item.id], childItems: childFields } };
        const newItems = unFlattenedListItemsById(allItems);
        return newItems;
      });
      return childFields;
    },
    [selectedOrg]
  );

  return {
    fields,
    loadFields,
    loadChildFields,
  };
}
