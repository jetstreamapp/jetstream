import { QueryFieldWithPolymorphic } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildSelectedSubqueryTree } from '../../utils/subquery-navigation-utils';
import QuerySubqueryNavigator from '../QuerySubqueryNavigator';

/** Only the number of selected fields matters to the tree, so the field metadata is not worth building out */
function getFields(...fields: string[]): QueryFieldWithPolymorphic[] {
  return fields.map((field) => ({ field }) as QueryFieldWithPolymorphic);
}

const selectedSubqueryTree = buildSelectedSubqueryTree(
  {
    Contacts: getFields('Id'),
    'Contacts.Cases': getFields('Id', 'Subject'),
    Opportunities: getFields('Id'),
  },
  { Contacts: 'Contact', 'Contacts.Cases': 'Case', Opportunities: 'Opportunity' },
);

function setup(currentRelationshipPath = '') {
  const onNavigate = vi.fn();
  render(
    <QuerySubqueryNavigator
      rootSObjectName="Account"
      selectedSubqueryTree={selectedSubqueryTree}
      currentRelationshipPath={currentRelationshipPath}
      onNavigate={onNavigate}
    />,
  );
  return { onNavigate, openNavigator: () => fireEvent.click(screen.getByTestId('subquery-navigator-button')) };
}

describe('QuerySubqueryNavigator', () => {
  it('should count every related object in the query, including nested ones', () => {
    setup();
    expect(screen.getByTestId('subquery-navigator-button').textContent).toContain('Selected (3)');
  });

  it('should show nested related objects, which are not listed on the level being viewed', () => {
    const { openNavigator } = setup();
    openNavigator();

    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Contacts')).toBeTruthy();
    expect(screen.getByText('Cases')).toBeTruthy();
    expect(screen.getByText('Opportunities')).toBeTruthy();
  });

  it('should navigate to a nested related object by its full relationship path', () => {
    const { onNavigate, openNavigator } = setup();
    openNavigator();

    fireEvent.click(screen.getByText('Cases'));

    expect(onNavigate).toHaveBeenCalledWith('Contacts.Cases');
  });

  it('should navigate back to the root object with an empty relationship path', () => {
    const { onNavigate, openNavigator } = setup('Contacts');
    openNavigator();

    fireEvent.click(screen.getByText('Account'));

    expect(onNavigate).toHaveBeenCalledWith('');
  });

  it('should point out the level currently being viewed', () => {
    const { openNavigator } = setup('Contacts.Cases');
    openNavigator();

    expect(screen.getByText('Cases').closest('li')?.textContent).toContain('viewing');
  });
});
