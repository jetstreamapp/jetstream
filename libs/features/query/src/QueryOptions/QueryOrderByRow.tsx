/* eslint-disable @typescript-eslint/no-unused-vars */
import { AscDesc, FirstLast, ListItem, QueryOrderByClause } from '@jetstream/types';
import { ComboboxWithDrillInItems, FormRowButton, Picklist } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';

export interface QueryOrderByProps {
  groupNumber: number;
  orderBy: QueryOrderByClause;
  sobject: string;
  fields: ListItem[];
  order: ListItem<AscDesc>[];
  nulls: ListItem<FirstLast | null>[];
  onChange: (orderBy: QueryOrderByClause) => void;
  onDelete: (orderBy: QueryOrderByClause) => void;
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

function getSelectionLabel(item: ListItem<string, unknown>) {
  return `${item.value} (${item.label})`;
}

export const QueryOrderByRow: FunctionComponent<QueryOrderByProps> = ({
  groupNumber,
  sobject,
  orderBy,
  fields,
  order,
  nulls,
  onChange,
  onDelete,
  onLoadRelatedFields,
}) => {
  const [initialSelectedOrder] = useState(order.find((item) => item.value === orderBy.order) || order[0]);
  const [initialSelectedNulls] = useState(nulls.find((item) => item.value === orderBy.nulls) || nulls[0]);

  return (
    <div className="slds-grid slds-gutters_xx-small" role="group" aria-label={`Filter row ${groupNumber}`}>
      {/* Resource */}
      <div className="slds-col">
        <ComboboxWithDrillInItems
          comboboxProps={{
            label: 'Field',
            itemLength: 10,
          }}
          selectedItemLabelFn={getSelectionLabel}
          selectedItemId={orderBy.field}
          items={fields}
          rootHeadingLabel={sobject}
          onLoadItems={onLoadRelatedFields}
          onSelected={(item) => item && onChange({ ...orderBy, field: item.value, fieldLabel: getSelectionLabel(item) })}
        />
      </div>
      <div className="slds-col slds-grow-none">
        <Picklist
          label="Order"
          items={order as ListItem[]}
          selectedItems={[initialSelectedOrder] as ListItem[]}
          allowDeselection={false}
          onChange={(items) => onChange({ ...orderBy, order: items[0].value as AscDesc })}
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

export default QueryOrderByRow;
