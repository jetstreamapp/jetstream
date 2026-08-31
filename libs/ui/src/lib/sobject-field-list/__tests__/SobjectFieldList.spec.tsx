/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
// Each field row's "where is this used" button reads the Google Drive atoms, which derive from the user
// profile — without this mock that fires a real profile request, and whether it fails fast enough to leave
// the rows rendered depends on what else ran in the worker (see Popover.spec.tsx).
vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    fromAppState: {},
    applicationCookieState: atom({ google_apiKey: '', google_appId: '', google_clientId: '' }),
    googleDriveAccessState: atom({ hasGoogleDriveAccess: false, googleShowUpgradeToPro: false }),
  };
});

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

/** A lookup that can point at more than one object, like Case.OwnerId */
function buildPolymorphicField(name: string, label: string, relationshipName: string, relatedSobjects: string[]): FieldWrapper {
  const field = buildField(name, label);
  return {
    ...field,
    type: 'reference',
    relatedSobject: relatedSobjects,
    relationshipKey: relationshipName,
    metadata: { ...field.metadata, type: 'reference', relationshipName, referenceTo: relatedSobjects } as Field,
  };
}

function buildQueryFields(extraFields: Record<string, FieldWrapper> = {}): QueryFields {
  const fields = { Id: buildField('Id', 'Record ID'), Name: buildField('Name', 'Account Name'), ...extraFields };
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

function renderFieldList(queryFields = buildQueryFields()) {
  return render(
    <SobjectFieldList
      org={org}
      serverUrl="https://test.getjetstream.app"
      isTooling={false}
      level={0}
      itemKey="Account|"
      queryFieldsMap={{ 'Account|': queryFields }}
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

  test('ArrowDown keeps moving after re-entering the list from Select All', () => {
    const { baseElement } = renderFieldList();
    const selectAll = screen.getByRole('checkbox', { name: 'Select All (2)' });
    const list = baseElement.querySelector('ul') as HTMLUListElement;
    const [firstRow, secondRow] = within(list).getAllByRole('checkbox');

    selectAll.focus();
    fireEvent.keyDown(selectAll, { key: 'ArrowDown' });
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(secondRow);

    // Back out and in again: focus lands on the first row while the list still remembers the second
    selectAll.focus();
    fireEvent.keyDown(selectAll, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(firstRow);
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(secondRow);
  });

  test('the View Fields button of a lookup to several objects is reachable with Tab after the object combobox', () => {
    renderFieldList(buildQueryFields({ OwnerId: buildPolymorphicField('OwnerId', 'Owner ID', 'Owner', ['User', 'Group']) }));

    const objectCombobox = screen.getByRole('combobox', { name: /Which Related Object/ });
    const viewFieldsButton = screen.getByRole('button', { name: /View User Fields/ });

    // The combobox is a text field that keeps ArrowLeft/Right, so the row's arrow navigation cannot reach
    // the button — it has to stay a Tab stop after the combobox
    expect(objectCombobox.compareDocumentPosition(viewFieldsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(viewFieldsButton.tabIndex).toBe(0);
  });
});
