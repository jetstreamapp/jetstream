import { axeScan } from '@jetstream/test-utils';
import { Maybe, OrgGroup } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationGroupSelector } from '../OrganizationGroupSelector';

const groups = [
  { id: 'group-1', name: 'Production', orgs: [{ uniqueId: 'a' }, { uniqueId: 'b' }] },
  { id: 'group-2', name: 'Sandboxes', orgs: [{ uniqueId: 'c' }] },
] as unknown as OrgGroup[];

/** Owns the selection the way OrgsDropdown does, so the selector re-renders after a choice */
function Harness({ initialGroup, onSelection }: { initialGroup?: Maybe<OrgGroup>; onSelection: (group?: Maybe<OrgGroup>) => void }) {
  const [selectedGroup, setSelectedGroup] = useState<Maybe<OrgGroup> | undefined>(initialGroup);
  return (
    <MemoryRouter>
      <OrganizationGroupSelector
        groups={groups}
        selectedGroup={selectedGroup}
        salesforceOrgsWithoutGroup={3}
        onSelection={(group) => {
          onSelection(group);
          setSelectedGroup(group);
        }}
      />
    </MemoryRouter>
  );
}

describe('OrganizationGroupSelector', () => {
  it('lists the groups as one tab stop navigated with the arrow keys, and Enter chooses one', async () => {
    const onSelection = vi.fn();
    const { baseElement } = render(<Harness onSelection={onSelection} />);
    const trigger = screen.getByRole('button', { name: 'Choose Group' });
    trigger.focus();
    fireEvent.click(trigger);

    const list = screen.getByRole('listbox', { name: 'Org groups' });
    expect(list.getAttribute('tabindex')).toBe('0');
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Production2 Orgs', 'Sandboxes1 Org']);
    expect(options.every((option) => option.getAttribute('tabindex') === '-1')).toBe(true);
    await axeScan(baseElement);

    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[0]);
    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);

    fireEvent.keyDown(options[1], { key: 'Enter' });
    expect(onSelection).toHaveBeenCalledWith(groups[1]);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());

    // The popover closed and its trigger survived the selection (now reading "Switch"), so focus returns to it
    const switchTrigger = screen.getByRole('button', { name: 'Switch group' });
    expect(switchTrigger.textContent).toBe('Switch');
    await waitFor(() => expect(document.activeElement).toBe(switchTrigger));
    expect(screen.getByText('Sandboxes')).toBeTruthy();
  });

  it('offers the other groups plus "-No Group-" when a group is selected, and clearing returns focus to the trigger', async () => {
    const onSelection = vi.fn();
    render(<Harness initialGroup={groups[0]} onSelection={onSelection} />);
    const trigger = screen.getByRole('button', { name: 'Switch group' });
    trigger.focus();
    fireEvent.click(trigger);

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Sandboxes1 Org', '-No Group-3 Orgs']);

    fireEvent.click(options[1]);
    expect(onSelection).toHaveBeenCalledWith(null);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Choose Group' })));
  });
});
