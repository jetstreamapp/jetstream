import { TeamAccessProfile } from '@jetstream/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAccessProfileDeleteModal } from '../TeamAccessProfileDeleteModal';

const { deleteTeamAccessProfile } = vi.hoisted(() => ({ deleteTeamAccessProfile: vi.fn() }));

vi.mock('@jetstream/shared/data', () => ({ deleteTeamAccessProfile }));

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

const unusedProfile = createAccessProfile('Unused');
const otherProfile = createAccessProfile('Other');

async function setup() {
  const onClose = vi.fn();
  render(
    <TeamAccessProfileDeleteModal
      teamId="team-1"
      accessProfile={unusedProfile}
      accessProfiles={[unusedProfile, otherProfile]}
      onClose={onClose}
    />,
  );
  // Let the modal place its initial focus first, so it does not override focus the test moves
  await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
  const deleteButton = screen.getByRole('button', { name: 'Delete' });
  act(() => deleteButton.focus());
  return { onClose, deleteButton };
}

describe('TeamAccessProfileDeleteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps focus on Delete while the delete runs and ignores a second click', async () => {
    let resolveDelete: (value: unknown) => void = () => undefined;
    deleteTeamAccessProfile.mockReturnValue(new Promise((resolve) => (resolveDelete = resolve)));
    const { deleteButton, onClose } = await setup();

    fireEvent.click(deleteButton);

    await waitFor(() => expect(deleteButton.getAttribute('aria-disabled')).toBe('true'));
    expect(deleteButton.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(deleteButton);
    fireEvent.click(deleteButton);
    expect(deleteTeamAccessProfile).toHaveBeenCalledTimes(1);

    await act(async () => resolveDelete({ id: 'team-1' }));
    expect(onClose).toHaveBeenCalledWith({ id: 'team-1' });
  });

  it('moves focus to the Move to picker when a refused delete makes it appear', async () => {
    deleteTeamAccessProfile.mockRejectedValue(new Error('This profile is assigned to members'));
    const { deleteButton } = await setup();
    expect(screen.queryByRole('combobox', { name: 'Move to' })).toBeNull();

    fireEvent.click(deleteButton);

    const picker = await screen.findByRole('combobox', { name: 'Move to' });
    await waitFor(() => expect(document.activeElement).toBe(picker));
    expect(screen.getByRole('alert').textContent).toContain('This profile is assigned to members');
  });
});
