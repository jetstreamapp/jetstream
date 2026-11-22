import { TeamAccessProfile } from '@jetstream/types';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamAccessProfiles } from '../TeamAccessProfiles';

function createAccessProfile(name: string, overrides: Partial<TeamAccessProfile> = {}): TeamAccessProfile {
  return {
    id: `id-${name}`,
    name,
    description: null,
    policy: { v: 1, tools: ['query'], operations: [], surfaces: ['web'] },
    isDefault: false,
    version: 1,
    memberCount: 0,
    invitationCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const alpha = createAccessProfile('Alpha');
const bravo = createAccessProfile('Bravo', { invitationCount: 2 });
const charlie = createAccessProfile('Charlie');

function renderAccessProfiles(accessProfiles: TeamAccessProfile[]) {
  const props = { canUpdate: true, fullAccessMemberCount: 1, onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  const result = render(<TeamAccessProfiles accessProfiles={accessProfiles} {...props} />);
  return {
    ...result,
    rerenderWith: (nextAccessProfiles: TeamAccessProfile[]) =>
      result.rerender(<TeamAccessProfiles accessProfiles={nextAccessProfiles} {...props} />),
  };
}

/** What the delete modal leaves behind: the Delete button that opened it is gone, so focus is on <body> */
function deleteFocusedRow(rerenderWith: (accessProfiles: TeamAccessProfile[]) => void, remaining: TeamAccessProfile[]) {
  act(() => rerenderWith(remaining));
  expect(document.activeElement).toBe(document.body);
}

describe('TeamAccessProfiles', () => {
  it('names the table, labels the built-in row action cell and lets the keyboard reach the invitation tooltip', () => {
    renderAccessProfiles([alpha, bravo]);

    expect(screen.getByRole('table', { name: 'Access profiles' })).toBeTruthy();
    expect(screen.getByText('Built in, cannot be edited or deleted')).toBeTruthy();
    expect(screen.getByText('(+2 invited)').closest('[tabindex="0"]')).toBeTruthy();
  });

  it('moves focus to the next row after the focused row is deleted', async () => {
    const { rerenderWith } = renderAccessProfiles([alpha, bravo, charlie]);
    screen.getByRole('button', { name: 'Delete Bravo' }).focus();

    deleteFocusedRow(rerenderWith, [alpha, charlie]);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete Charlie' })));
  });

  it('moves focus to the previous row when the last row is deleted', async () => {
    const { rerenderWith } = renderAccessProfiles([alpha, bravo]);
    screen.getByRole('button', { name: 'Delete Bravo' }).focus();

    deleteFocusedRow(rerenderWith, [alpha]);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete Alpha' })));
  });

  it('moves focus to New Access Profile when no profiles remain', async () => {
    const { rerenderWith } = renderAccessProfiles([alpha]);
    screen.getByRole('button', { name: 'Delete Alpha' }).focus();

    deleteFocusedRow(rerenderWith, []);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New Access Profile' })));
  });

  it('leaves focus alone when it is somewhere else as a profile disappears', async () => {
    const { rerenderWith } = renderAccessProfiles([alpha, bravo]);
    const newButton = screen.getByRole('button', { name: 'New Access Profile' });
    newButton.focus();

    act(() => rerenderWith([bravo]));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.activeElement).toBe(newButton);
  });
});
