/* eslint-disable @typescript-eslint/no-unused-vars */
import { getFlattenedListItems, multiWordObjectFilter } from '@jetstream/shared/utils';
import { AscDesc, FirstLast, ListItem, ListItemGroup, QueryOrderByClause } from '@jetstream/types';
import { ComboboxWithItemsVirtual, FormRowButton, Picklist } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';

export interface QueryOrderByProps {
  orderBy: QueryOrderByClause;
  fields: ListItemGroup[];
  order: ListItem<AscDesc>[];
  nulls: ListItem<FirstLast | null>[];
  onChange: (orderBy: QueryOrderByClause) => void;
  onDelete: (orderBy: QueryOrderByClause) => void;
}

function getSelectionLabel(item: ListItem<string, unknown>) {
  return item.group ? `${item.group.label} - ${item.label} ${item.secondaryLabel || ''}` : `${item.label} ${item.secondaryLabel || ''}`;
}

export const QueryOrderBy: FunctionComponent<QueryOrderByProps> = ({ orderBy, fields, order, nulls, onChange, onDelete }) => {
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState(fields);
  const [initialSelectedOrder] = useState(order.find((item) => item.value === orderBy.order) || order[0]);
  const [initialSelectedNulls] = useState(nulls.find((item) => item.value === orderBy.nulls) || nulls[0]);
  const [flattenedResources, setFlattenedResources] = useState<ListItem[]>(() => getFlattenedListItems(fields));

  useEffect(() => {
    if (!fieldFilter) {
      setVisibleFields(fields);
    } else {
      const filter = fieldFilter.toLowerCase().trim();
      const tempFields: typeof fields = [];
      fields.forEach((field) => {
        tempFields.push({
          ...field,
          items: field.items.filter(multiWordObjectFilter(['label', 'value'], filter)),
        });
      });
      setVisibleFields(tempFields);
    }
  }, [fields, fieldFilter]);

  return (
    <div className="slds-grid slds-gutters_xx-small">
      {/* Resource */}
      <div className="slds-col">
        <ComboboxWithItemsVirtual
          comboboxProps={{
            label: 'Field',
            labelHelp: 'Related fields must be selected to appear in this list and only fields that allow sorting are included.',
            itemLength: 10,
          }}
          selectedItemLabelFn={getSelectionLabel}
          selectedItemId={orderBy.field}
          items={flattenedResources}
          onSelected={(item) => onChange({ ...orderBy, field: item.value, fieldLabel: getSelectionLabel(item) })}
        />
      </div>
      <div className="slds-col slds-grow-none">
        <Picklist
          label="Order"
          items={order}
          selectedItems={[initialSelectedOrder]}
          allowDeselection={false}
          onChange={(items: ListItem<AscDesc>[]) => onChange({ ...orderBy, order: items[0].value })}
        />
      </div>
      <div className="slds-col slds-grow-none">
        <Picklist
          label="Nulls"
          items={nulls as ListItem[]}
          selectedItems={[initialSelectedNulls as ListItem]}
          allowDeselection={false}
          onChange={(items) => onChange({ ...orderBy, nulls: items[0].value as FirstLast | null })}
        />
      </div>
      <div className="slds-col slds-grow-none">
        <FormRowButton
          title="Delete Condition"
          icon={{ type: 'utility', icon: 'delete', description: 'Delete condition' }}
          onClick={() => onDelete(orderBy)}
        />
      </div>
    </div>
  );
};

export default QueryOrderBy;
