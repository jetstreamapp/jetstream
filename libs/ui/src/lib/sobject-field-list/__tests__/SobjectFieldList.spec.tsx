import { axeScan } from '@jetstream/test-utils';
import { Field, FieldWrapper, QueryFields, SalesforceOrgUi } from '@jetstream/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import SobjectFieldList from '../SobjectFieldList';

const org = { uniqueId: 'org-1', label: 'Acme', instanceUrl: 'https://acme.my.salesforce.com' } as SalesforceOrgUi;

function buildField(name: string, label: string): FieldWrapper {
  return {
    name,
    label,
    type: 'string',
    sobject: 'Account',
    filterText: `${name} ${label}`.toLowerCase(),
    metadata: { name, label, type: 'string', custom: false, nillable: true, updateable: true, createable: true } as Field,
  };
}

function buildQueryFields(): QueryFields {
  const fields = { Id: buildField('Id', 'Record ID'), Name: buildField('Name', 'Account Name') };
  return {
    key: 'Account|',
    expanded: true,
    loading: false,
    hasError: false,
    filterTerm: '',
    sobject: 'Account',
    isPolymorphic: false,
    fields,
    visibleFields: new Set(Object.keys(fields)),
    selectedFields: new Set<string>(),
  };
}

function renderFieldList() {
  return render(
    <SobjectFieldList
      org={org}
      serverUrl="https://test.getjetstream.app"
      isTooling={false}
      level={0}
      itemKey="Account|"
      queryFieldsMap={{ 'Account|': buildQueryFields() }}
      sobject="Account"
      onToggleExpand={vi.fn()}
      onSelectField={vi.fn()}
      onSelectAll={vi.fn()}
      onFilterChanged={vi.fn()}
      errorReattempt={vi.fn()}
    />,
  );
}

describe('SobjectFieldList', () => {
  test('ArrowDown from Select All enters the field list and ArrowUp returns to the filter', async () => {
    const { baseElement } = renderFieldList();
    const selectAll = screen.getByRole('checkbox', { name: 'Select All (2)' });
    const filterInput = screen.getByPlaceholderText('Filter Account Fields');
    const list = baseElement.querySelector('ul') as HTMLUListElement;
    expect(list).toBeTruthy();
    await axeScan(baseElement);

    selectAll.focus();
    expect(fireEvent.keyDown(selectAll, { key: 'ArrowDown' })).toBe(false);
    const rowCheckboxes = within(list).getAllByRole('checkbox');
    expect(rowCheckboxes.length).toBe(2);
    expect(document.activeElement).toBe(rowCheckboxes[0]);

    selectAll.focus();
    expect(fireEvent.keyDown(selectAll, { key: 'ArrowUp' })).toBe(false);
    expect(document.activeElement).toBe(filterInput);
    // The release of that same press lands on the filter input, whose own hand-off runs on keyup — it
    // must not bounce focus straight back into the list
    fireEvent.keyUp(filterInput, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(filterInput);
  });

  test('Space still toggles Select All and other keys are left alone', () => {
    renderFieldList();
    const selectAll = screen.getByRole('checkbox', { name: 'Select All (2)' });
    selectAll.focus();
    expect(fireEvent.keyDown(selectAll, { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(selectAll, { key: 'Tab' })).toBe(true);
  });
});
