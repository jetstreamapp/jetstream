/* eslint-disable @typescript-eslint/no-unused-vars */
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { AscDesc, FirstLast, ListItem, ListItemGroup, QueryOrderByClause } from '@jetstream/types';
import { Combobox, ComboboxListItem, ComboboxListItemGroup, FormRowButton, Picklist } from '@jetstream/ui';
import React, { FunctionComponent, useEffect, useState } from 'react';

export interface QueryOrderByProps {
  orderBy: QueryOrderByClause;
  fields: ListItemGroup[];
  order: ListItem<AscDesc>[];
  nulls: ListItem<FirstLast | null>[];
  onChange: (orderBy: QueryOrderByClause) => void;
  onDelete: (orderBy: QueryOrderByClause) => void;
}

function getSelectionLabel(groupLabel: string, item: ListItem<string, unknown>) {
  return `${groupLabel} - ${item.label} ${item.secondaryLabel || ''}`;
}

export const QueryOrderBy: FunctionComponent<QueryOrderByProps> = ({ orderBy, fields, order, nulls, onChange, onDelete }) => {
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState(fields);
  const [initialSelectedOrder] = useState(order.find((item) => item.value === orderBy.order) || order[0]);
  const [initialSelectedNulls] = useState(nulls.find((item) => item.value === orderBy.nulls) || nulls[0]);

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
        <Combobox
          label="Field"
          labelHelp="Related fields must be selected to appear in this list and only fields that allow sorting are included."
          onInputChange={(filter) => setFieldFilter(filter)}
          selectedItemLabel={orderBy.fieldLabel}
          selectedItemTitle={null}
        >
          {visibleFields
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <ComboboxListItemGroup key={group.id} label={group.label}>
                {group.items.map((item) => (
                  <ComboboxListItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    secondaryLabel={item.secondaryLabel}
                    selected={item.id === orderBy.field}
                    onSelection={(id) => {
                      onChange({ ...orderBy, field: item.value, fieldLabel: getSelectionLabel(group.label, item) });
                    }}
                  />
                ))}
              </ComboboxListItemGroup>
            ))}
        </Combobox>
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
