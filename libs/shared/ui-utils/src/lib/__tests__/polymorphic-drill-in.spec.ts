import { Field, ListItem } from '@jetstream/types';
import { describe, expect, test } from 'vitest';
import {
  getFlattenedListItemsById,
  getListItemsFromFieldWithRelatedItems,
  getPolymorphicTargetListItems,
  isPolymorphicReference,
  isPolymorphicTargetItem,
  setChildItemsForParent,
} from '../shared-ui-utils';

const ownerField = {
  name: 'OwnerId',
  label: 'Owner Id',
  relationshipName: 'Owner',
  referenceTo: ['User', 'Group'],
} as Field;

const accountField = {
  name: 'AccountId',
  label: 'Account Id',
  relationshipName: 'Account',
  referenceTo: ['Account'],
} as Field;

describe('isPolymorphicReference', () => {
  test('only true when more than one object can be referenced', () => {
    expect(isPolymorphicReference(ownerField)).toBe(true);
    expect(isPolymorphicReference(accountField)).toBe(false);
    expect(isPolymorphicReference({ name: 'Name' } as Field)).toBe(false);
  });
});

describe('getPolymorphicTargetListItems', () => {
  test('offers every referenced object as a drill-in level under the relationship', () => {
    const items = getPolymorphicTargetListItems(ownerField, 'Owner');

    expect(items.map((item) => item.label)).toEqual(['Group', 'User']);
    items.forEach((item) => {
      expect(item.isDrillInItem).toBe(true);
      expect(item.parentId).toBe('Owner');
      expect(isPolymorphicTargetItem(item as ListItem)).toBe(true);
    });
  });

  test('carries the relationship path so the loaded fields keep a valid SOQL path', () => {
    const [group] = getPolymorphicTargetListItems(ownerField, 'Case.Owner');

    expect(group.meta).toEqual({ _polymorphicTarget: true, relationshipPath: 'Case.Owner', sobject: 'Group' });
  });
});

describe('getListItemsFromFieldWithRelatedItems', () => {
  const fields = [{ name: 'Name', label: 'Name' } as Field, ownerField];

  test('builds ids from the relationship path, not from the drill-in parent', () => {
    // Under a polymorphic target the tree parent is a synthetic id, but the SOQL path must not include it.
    const items = getListItemsFromFieldWithRelatedItems(fields, 'Owner::User', 'Owner');

    const nameField = items.find((item) => item.label === 'Name');
    expect(nameField?.id).toBe('Owner.Name');
    expect(nameField?.parentId).toBe('Owner::User');
  });

  test('path defaults to the parent id for an ordinary lookup', () => {
    const items = getListItemsFromFieldWithRelatedItems(fields, 'Account');

    const nameField = items.find((item) => item.label === 'Name');
    expect(nameField?.id).toBe('Account.Name');
    expect(nameField?.parentId).toBe('Account');
  });

  test('labels a polymorphic relationship by its object count rather than an arbitrary object', () => {
    const [relationship] = getListItemsFromFieldWithRelatedItems([ownerField]);
    expect(relationship.secondaryLabel).toBe('2 related objects');

    const [singleRelationship] = getListItemsFromFieldWithRelatedItems([accountField]);
    expect(singleRelationship.secondaryLabel).toBe('Account');
  });
});

describe('setChildItemsForParent', () => {
  const userFields = [{ name: 'Name', label: 'Name' } as Field, { name: 'Email', label: 'Email' } as Field];
  const groupFields = [{ name: 'Name', label: 'Name' } as Field, { name: 'Type', label: 'Type' } as Field];

  /** Drill into the relationship, then into both of its target objects, as a user would. */
  function buildTreeWithBothTargetsLoaded(cacheChildren: (items: ListItem[], parentId: string, children: ListItem[]) => ListItem[]) {
    let fields = getListItemsFromFieldWithRelatedItems([ownerField, { name: 'Id', label: 'Id' } as Field]);
    fields = cacheChildren(fields, 'Owner', getPolymorphicTargetListItems(ownerField, 'Owner') as ListItem[]);
    fields = cacheChildren(fields, 'Owner::User', getListItemsFromFieldWithRelatedItems(userFields, 'Owner::User', 'Owner'));
    fields = cacheChildren(fields, 'Owner::Group', getListItemsFromFieldWithRelatedItems(groupFields, 'Owner::Group', 'Owner'));
    return fields;
  }

  function childIdsByTarget(fields: ListItem[]) {
    const owner = fields.find((item) => item.id === 'Owner');
    const forTarget = (targetId: string) =>
      owner?.childItems
        ?.find((item) => item.id === targetId)
        ?.childItems?.map((item) => item.id)
        .sort();
    return { user: forTarget('Owner::User'), group: forTarget('Owner::Group') };
  }

  test('keeps fields that two polymorphic targets share', () => {
    // Both targets expose `Name`, which resolves to the same SOQL path (`Owner.Name`) under either one.
    const fields = buildTreeWithBothTargetsLoaded(setChildItemsForParent);

    expect(childIdsByTarget(fields)).toEqual({
      user: ['Owner.Email', 'Owner.Name'],
      group: ['Owner.Name', 'Owner.Type'],
    });
  });

  test('both targets stay resolvable through the drill-in combobox lookup', () => {
    // ComboboxWithDrillInItems keeps `getFlattenedListItemsById(items)` and reads
    // `allItemsById[activeItemId].childItems`. activeItemId is only ever a drill-in item's id, and those
    // are unique, so the shared leaf path under two parents never has to survive the id-keyed map.
    const fields = buildTreeWithBothTargetsLoaded(setChildItemsForParent);
    const allItemsById = getFlattenedListItemsById(fields);

    expect(allItemsById['Owner::User'].childItems?.map((item) => item.id).sort()).toEqual(['Owner.Email', 'Owner.Name']);
    expect(allItemsById['Owner::Group'].childItems?.map((item) => item.id).sort()).toEqual(['Owner.Name', 'Owner.Type']);
  });

  test('leaves unrelated branches untouched', () => {
    const fields = getListItemsFromFieldWithRelatedItems([ownerField, accountField]);
    const updated = setChildItemsForParent(fields, 'Account', [{ id: 'Account.Name', label: 'Name', value: 'Account.Name' }]);

    expect(updated.find((item) => item.id === 'Account')?.childItems?.map((item) => item.id)).toEqual(['Account.Name']);
    expect(updated.find((item) => item.id === 'Owner')?.childItems).toBeUndefined();
  });

  test('keeps references stable for everything outside the updated branch', () => {
    const fields = buildTreeWithBothTargetsLoaded(setChildItemsForParent);
    const ownerBefore = fields.find((item) => item.id === 'Owner');
    const idFieldBefore = fields.find((item) => item.id === 'Id');
    const userTargetBefore = ownerBefore?.childItems?.find((item) => item.id === 'Owner::User');

    const updated = setChildItemsForParent(fields, 'Owner::Group', [{ id: 'Owner.Name', label: 'Name', value: 'Owner.Name' }]);
    const ownerAfter = updated.find((item) => item.id === 'Owner');

    // Siblings and untouched targets are reused; only the path down to the updated parent is rebuilt.
    expect(updated.find((item) => item.id === 'Id')).toBe(idFieldBefore);
    expect(ownerAfter?.childItems?.find((item) => item.id === 'Owner::User')).toBe(userTargetBefore);
    expect(ownerAfter).not.toBe(ownerBefore);
  });

  test('returns the original array when the parent is not present', () => {
    const fields = getListItemsFromFieldWithRelatedItems([ownerField, accountField]);

    expect(setChildItemsForParent(fields, 'NotARelationship', [])).toBe(fields);
  });
});
