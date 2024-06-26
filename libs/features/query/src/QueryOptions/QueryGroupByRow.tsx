import { Field, ListItem, QueryGroupByClause } from '@jetstream/types';
import { ComboboxWithDrillInItems, ComboboxWithItems, FormRowButton, GridCol } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
import { QUERY_FIELD_DATE_FUNCTIONS } from '../utils/query-filter.utils';

export interface QueryOrderByProps {
  groupNumber: number;
  groupBy: QueryGroupByClause;
  sobject: string;
  fields: ListItem<string, Field>[];
  onChange: (orderBy: QueryGroupByClause) => void;
  onDelete: (orderBy: QueryGroupByClause) => void;
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

function getSelectionLabel(item: ListItem<string, unknown>) {
  return `${item.value} (${item.label})`;
}

export const QueryGroupByRow: FunctionComponent<QueryOrderByProps> = ({
  groupNumber,
  sobject,
  groupBy,
  fields,
  onChange,
  onDelete,
  onLoadRelatedFields,
}) => {
  const selectedField = useMemo(
    () => (!groupBy.field ? null : fields.find((field) => field.id === groupBy.field)),
    [groupBy.field, fields]
  );

  return (
    <div className="slds-grid slds-gutters_xx-small" role="group" aria-label={`Filter row ${groupNumber}`}>
      {/* Resource */}
      <GridCol>
        <ComboboxWithDrillInItems
          comboboxProps={{
            label: 'Field',
            labelHelp: 'Field to group by. Date and Datetime fields allow a function to be applied.',
            itemLength: 10,
            showSelectionAsButton: true,
            onClear: () => onChange({ ...groupBy, function: null, field: null, fieldLabel: null }),
          }}
          selectedItemLabelFn={getSelectionLabel}
          selectedItemId={groupBy.field}
          items={fields}
          rootHeadingLabel={sobject}
          onLoadItems={onLoadRelatedFields}
          onSelected={(item) =>
            item &&
            onChange({
              ...groupBy,
              function: item.meta?.type?.includes('date') ? groupBy.function : null,
              field: item.value,
              fieldLabel: getSelectionLabel(item),
            })
          }
        />
      </GridCol>
      {selectedField?.meta?.type?.includes('date') && (
        <GridCol growNone>
          <ComboboxWithItems
            comboboxProps={{
              label: 'Function',
              labelHelp: 'Optional function to apply to the field.',
              itemLength: 10,
              showSelectionAsButton: true,
              onClear: () => onChange({ ...groupBy, function: null }),
            }}
            items={QUERY_FIELD_DATE_FUNCTIONS}
            selectedItemId={groupBy.function}
            onSelected={(item) => onChange({ ...groupBy, function: item.value })}
          />
        </GridCol>
      )}
      <GridCol growNone>
        <FormRowButton
          title="Delete Condition"
          icon={{ type: 'utility', icon: 'delete', description: 'Delete condition' }}
          onClick={() => onDelete(groupBy)}
        />
      </GridCol>
    </div>
  );
};

export default QueryGroupByRow;
