import { isEnterKey, useDebounce } from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import { FieldType, ListItem, QueryFieldWithPolymorphic } from '@jetstream/types';
import { ComboboxWithItems, GridCol, Icon, Input, Popover, PopoverRef } from '@jetstream/ui';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';

export interface QueryFieldFunctionRowProps {
  showLabel?: boolean;
  functionFields: ListItem<string, QueryFieldWithPolymorphic>[];
  selectedField: QueryFieldWithPolymorphic | null;
  selectedFunction: string | null;
  alias: string | null;
  hasGroupByClause: boolean;
  onChange: (selectedField: QueryFieldWithPolymorphic | null, selectedFunction: string | null, alias: string | null) => void;
}

export const QueryFieldFunctionRow = ({
  showLabel,
  selectedField,
  selectedFunction,
  functionFields,
  hasGroupByClause,
  alias: aliasProp,
  onChange,
}: QueryFieldFunctionRowProps) => {
  const popoverRef = useRef<PopoverRef>(null);
  const [alias, setAlias] = useState(aliasProp);
  const debouncedSelectedValue = useDebounce(alias, 150);
  const [functionListItems, setFunctionListItems] = useState<ListItem[]>([]);

  useEffect(() => {
    if (selectedField) {
      const functions = getFunctionListItems(selectedField, hasGroupByClause);
      if (selectedFunction && !functions.find((f) => f.value === selectedFunction)) {
        onChange(selectedField, null, null);
      }
      setFunctionListItems(functions);
    } else {
      setFunctionListItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGroupByClause, selectedField, selectedFunction]);

  useEffect(() => {
    if (!aliasProp) {
      setAlias(aliasProp);
    }
  }, [aliasProp]);

  useEffect(() => {
    if (debouncedSelectedValue !== aliasProp) {
      onChange(selectedField, selectedFunction, debouncedSelectedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedField, selectedFunction, debouncedSelectedValue, aliasProp]);

  return (
    <>
      <GridCol grow>
        <ComboboxWithItems
          comboboxProps={{
            hideLabel: !showLabel,
            label: 'Query Field',
            labelHelp: `Only fields you have included in your query are available for selection.`,
            showSelectionAsButton: true,
            onClear: () => onChange(null, null, alias),
          }}
          items={functionFields}
          selectedItemId={selectedField?.field}
          onSelected={(item) => onChange(item.meta, selectedFunction, alias)}
        />
      </GridCol>
      <GridCol grow>
        <ComboboxWithItems
          comboboxProps={{
            hideLabel: !showLabel,
            label: 'Formula',
            disabled: !selectedField,
            labelHelp: `Select a field to see available formulas based on the field type. Some formulas can only be combined with Group By queries.`,
            showSelectionAsButton: true,
            onClear: () => onChange(selectedField, null, alias),
          }}
          items={functionListItems}
          selectedItemId={selectedFunction}
          onSelected={(item) => onChange(selectedField, item.value, alias)}
        />
      </GridCol>
      <GridCol growNone>
        <Popover
          ref={popoverRef}
          placement="bottom"
          content={
            <div className="slds-popover__body slds-p-around_none">
              <Input label="Alias" clearButton={!!alias} onClear={() => setAlias(null)}>
                <input
                  className="slds-input"
                  value={alias || ''}
                  onChange={(event) => setAlias(event.target.value.replace(REGEX.NOT_ALPHANUMERIC, ''))}
                  onKeyUp={(event) => isEnterKey(event) && popoverRef.current?.close()}
                />
              </Input>
            </div>
          }
          buttonProps={{
            className: classNames('slds-button slds-button_icon slds-button_icon-border-filled', { 'slds-is-selected': !!alias }),
            disabled: !selectedField,
          }}
        >
          <Icon type="utility" icon="text" className="slds-button__icon" omitContainer />
        </Popover>
      </GridCol>
    </>
  );
};

const avgTypes: Set<FieldType> = new Set<FieldType>(['double', 'int', 'currency', 'percent']);
const sumTypes: Set<FieldType> = new Set<FieldType>(avgTypes);
const countTypes: Set<FieldType> = new Set<FieldType>([
  'boolean',
  'combobox',
  'currency',
  'date',
  'datetime',
  'double',
  'email',
  'id',
  'int',
  'percent',
  'phone',
  'picklist',
  'reference',
  'string',
  'textarea',
  'url',
]);
const minMaxTypes: Set<FieldType> = new Set<FieldType>(countTypes);
const dateTypes: Set<FieldType> = new Set<FieldType>(['date', 'datetime']);

/**
 * Get available functions based on the selected field type.
 * https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select_agg_functions_field_types.htm
 */
function getFunctionListItems(field: QueryFieldWithPolymorphic, hasGroupByClause = false) {
  const itemsWithDependencyFn: [() => boolean, ListItem][] = [
    [() => true, { id: 'FORMAT', label: 'Format', value: 'FORMAT' }],
    [
      () =>
        field.metadata.type === 'picklist' ||
        field.metadata.type === 'multipicklist' ||
        field.field === 'RecordType.Name' ||
        field.field === 'RecordType.Description',
      { id: 'toLabel', label: 'toLabel', value: 'toLabel' },
    ],
    [() => field.metadata.type === 'datetime', { id: 'ConvertTimeZone', label: 'ConvertTimeZone', value: 'ConvertTimeZone' }],
    [() => field.metadata.type === 'currency', { id: 'ConvertCurrency', label: 'ConvertCurrency', value: 'ConvertCurrency' }],
    [() => hasGroupByClause && avgTypes.has(field.metadata.type), { id: 'AVG', label: 'AVG', value: 'AVG' }],
    [() => true, { id: 'COUNT', label: 'COUNT', value: 'COUNT' }],
    [
      () => hasGroupByClause && (field.metadata.type === 'date' || field.metadata.type === 'datetime'),
      { id: 'COUNT_DISTINCT', label: 'COUNT_DISTINCT', value: 'COUNT_DISTINCT' },
    ],
    [() => hasGroupByClause && minMaxTypes.has(field.metadata.type), { id: 'MIN', label: 'MIN', value: 'MIN' }],
    [() => hasGroupByClause && minMaxTypes.has(field.metadata.type), { id: 'MAX', label: 'MAX', value: 'MAX' }],
    [() => hasGroupByClause && sumTypes.has(field.metadata.type), { id: 'SUM', label: 'SUM', value: 'SUM' }],
    // DATE
    [
      () => hasGroupByClause && dateTypes.has(field.metadata.type),
      { id: 'CALENDAR_MONTH', label: 'CALENDAR_MONTH', value: 'CALENDAR_MONTH' },
    ],
    [
      () => hasGroupByClause && dateTypes.has(field.metadata.type),
      { id: 'CALENDAR_QUARTER', label: 'CALENDAR_QUARTER', value: 'CALENDAR_QUARTER' },
    ],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'CALENDAR_YEAR', label: 'CALENDAR_YEAR', value: 'CALENDAR_YEAR' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'DAY_IN_MONTH', label: 'DAY_IN_MONTH', value: 'DAY_IN_MONTH' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'DAY_IN_WEEK', label: 'DAY_IN_WEEK', value: 'DAY_IN_WEEK' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'DAY_IN_YEAR', label: 'DAY_IN_YEAR', value: 'DAY_IN_YEAR' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'DAY_ONLY', label: 'DAY_ONLY', value: 'DAY_ONLY' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'FISCAL_MONTH', label: 'FISCAL_MONTH', value: 'FISCAL_MONTH' }],
    [
      () => hasGroupByClause && dateTypes.has(field.metadata.type),
      { id: 'FISCAL_QUARTER', label: 'FISCAL_QUARTER', value: 'FISCAL_QUARTER' },
    ],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'FISCAL_YEAR', label: 'FISCAL_YEAR', value: 'FISCAL_YEAR' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'HOUR_IN_DAY', label: 'HOUR_IN_DAY', value: 'HOUR_IN_DAY' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'WEEK_IN_MONTH', label: 'WEEK_IN_MONTH', value: 'WEEK_IN_MONTH' }],
    [() => hasGroupByClause && dateTypes.has(field.metadata.type), { id: 'WEEK_IN_YEAR', label: 'WEEK_IN_YEAR', value: 'WEEK_IN_YEAR' }],
  ];

  return itemsWithDependencyFn.filter(([fn]) => fn()).map(([, listItem]) => listItem);
}

export default QueryFieldFunctionRow;
