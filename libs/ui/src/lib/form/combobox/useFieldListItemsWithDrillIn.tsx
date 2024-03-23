import { describeSObject } from '@jetstream/shared/data';
import {
  getFlattenedListItemsById,
  getListItemsFromFieldWithRelatedItems,
  sortQueryFields,
  unFlattenedListItemsById,
} from '@jetstream/shared/ui-utils';
import { DescribeSObjectResult, Field, ListItem, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useState } from 'react';

/**
 * Helper hook for working with ComboboxWithDrillInItems for a list of fields
 * Fetches initial metadata and fetched child records on-demand
 */
export function useFieldListItemsWithDrillIn(selectedOrg: SalesforceOrgUi) {
  const [fields, setFields] = useState<ListItem[]>([]);

  const loadFields = useCallback(
    async (sobject: string): Promise<{ describe: DescribeSObjectResult; fields: Field[] }> => {
      if (!selectedOrg || !sobject) {
        throw new Error('Org and sobject are required');
      }
      const { data } = await describeSObject(selectedOrg, sobject);

      const sortedFields = sortQueryFields(data.fields);
      setFields(getListItemsFromFieldWithRelatedItems(sortedFields));

      return { describe: data, fields: sortedFields };
    },
    [selectedOrg]
  );

  const loadChildFields = useCallback(
    async (item: ListItem): Promise<ListItem[]> => {
      if (!selectedOrg) {
        throw new Error('Org is required');
      }
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
