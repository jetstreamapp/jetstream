import { describeSObject } from '@jetstream/shared/data';
import {
  getListItemsFromFieldWithRelatedItems,
  getPolymorphicTargetListItems,
  isPolymorphicReference,
  isPolymorphicTargetItem,
  PolymorphicTargetMeta,
  setChildItemsForParent,
  sortQueryFields,
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
      if (!selectedOrg?.uniqueId || !sobject) {
        throw new Error('Org and sobject are required');
      }
      const { data } = await describeSObject(selectedOrg, sobject);

      const sortedFields = sortQueryFields(data.fields);
      setFields(getListItemsFromFieldWithRelatedItems(sortedFields));

      return { describe: data, fields: sortedFields };
    },
    [selectedOrg],
  );

  const loadChildFields = useCallback(
    async (item: ListItem): Promise<ListItem[]> => {
      if (!selectedOrg?.uniqueId) {
        throw new Error('Org is required');
      }
      let childFields: ListItem[];
      if (isPolymorphicTargetItem(item)) {
        const { relationshipPath, sobject } = item.meta as PolymorphicTargetMeta;
        const { data } = await describeSObject(selectedOrg, sobject);
        childFields = getListItemsFromFieldWithRelatedItems(sortQueryFields(data.fields), item.id, relationshipPath);
      } else {
        const field = item.meta as Field;
        if (!Array.isArray(field.referenceTo) || field.referenceTo.length <= 0) {
          return [];
        }
        // Let the user pick which object to read from rather than silently traversing the first one.
        if (isPolymorphicReference(field)) {
          childFields = getPolymorphicTargetListItems(field, item.id);
        } else {
          const { data } = await describeSObject(selectedOrg, field.referenceTo[0]);
          childFields = getListItemsFromFieldWithRelatedItems(sortQueryFields(data.fields), item.id);
        }
      }

      setFields((prevValues) => setChildItemsForParent(prevValues, item.id, childFields));
      return childFields;
    },
    [selectedOrg],
  );

  return {
    fields,
    loadFields,
    loadChildFields,
  };
}
