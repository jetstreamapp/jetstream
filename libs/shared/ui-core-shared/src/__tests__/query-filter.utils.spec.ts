import { ExpressionConditionRowSelectedItems, Field, ListItem } from '@jetstream/types';
import {
  ensureFieldSelectItemsIncludesSelectionsFromRestore,
  getFieldSelectItems,
  getResourceTypeFnsFromFields,
} from '../query-filter.utils';

// ObjectTerritory2Association.SobjectType - Salesforce returns null labels for these picklist values
const sobjectTypeField = {
  name: 'SobjectType',
  label: 'Object Type',
  type: 'picklist',
  picklistValues: [
    { active: true, defaultValue: false, label: null, validFor: null, value: 'Account' },
    { active: true, defaultValue: false, label: null, validFor: null, value: 'Lead' },
  ],
} as unknown as Field;

const fields: ListItem[] = [{ id: 'SobjectType', label: 'SobjectType (Object Type)', value: 'SobjectType', meta: sobjectTypeField }];

function getSelected(overrides: Partial<ExpressionConditionRowSelectedItems>): ExpressionConditionRowSelectedItems {
  return { resource: 'SobjectType', resourceGroup: null, function: null, operator: 'eq', value: '', ...overrides };
}

describe('getResourceTypeFnsFromFields.getSelectItems', () => {
  it('should not add a blank option when no value is selected yet', () => {
    const selectItems = getResourceTypeFnsFromFields(fields).getSelectItems(getSelected({ value: '' }));
    expect(selectItems).toEqual([
      { id: 'Account', label: 'Account', value: 'Account' },
      { id: 'Lead', label: 'Lead', value: 'Lead' },
    ]);
  });

  it('should not add a blank option for an empty multi-select value', () => {
    const selectItems = getResourceTypeFnsFromFields(fields).getSelectItems(getSelected({ operator: 'in', value: [] }));
    expect(selectItems?.map(({ id }) => id)).toEqual(['Account', 'Lead']);
  });

  it('should add a selected value that is not in the picklist', () => {
    const selectItems = getResourceTypeFnsFromFields(fields).getSelectItems(getSelected({ value: 'Contact' }));
    expect(selectItems?.map(({ id }) => id)).toEqual(['Account', 'Lead', 'Contact']);
  });
});

describe('ensureFieldSelectItemsIncludesSelectionsFromRestore', () => {
  it('should only add non-empty values that are missing from the list', () => {
    const selectItems = ensureFieldSelectItemsIncludesSelectionsFromRestore(sobjectTypeField, getFieldSelectItems(sobjectTypeField), [
      'Lead',
      '',
      'Contact',
    ]);
    expect(selectItems.map(({ id }) => id)).toEqual(['Account', 'Lead', 'Contact']);
  });
});
