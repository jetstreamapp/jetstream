import { TeamUserFacing } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// This lib has no vitest setup file, and the `@jetstream/ui` barrel pulls in the drag-and-drop powered
// expression builder, whose dependency reads `ResizeObserver` at module-evaluation time
vi.hoisted(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverShim {
      constructor(_callback?: ResizeObserverCallback) {}
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverShim as unknown as typeof ResizeObserver;
  }
});

const { updateTeam } = vi.hoisted(() => ({ updateTeam: vi.fn() }));

vi.mock('@jetstream/shared/data', () => ({ updateTeam }));

const { TeamName } = await import('../TeamName');

const team = { id: 'team-1', name: 'Acme' } as TeamUserFacing;

function setup() {
  const onSave = vi.fn();
  render(<TeamName team={team} onSave={onSave} />);
  return { onSave };
}

function getEditButton() {
  return screen.getByRole('button', { name: 'Edit Team Name' });
}

function enterEditMode() {
  const editButton = getEditButton();
  editButton.focus();
  fireEvent.click(editButton);
  return screen.getByRole('textbox', { name: 'Name' });
}

describe('TeamName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the team name read-only with an Edit button until the user edits', () => {
    setup();

    expect(screen.getByText('Acme')).toBeTruthy();
    expect(getEditButton().getAttribute('title')).toBe('Edit Team Name');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('enters edit mode when the Edit button is clicked', () => {
    setup();

    const nameInput = enterEditMode();

    expect((nameInput as HTMLInputElement).value).toBe('Acme');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Team Name' })).toBeNull();
  });

  it('returns focus to the Edit button after cancelling, since Cancel unmounts with edit mode', async () => {
    const { onSave } = setup();
    const nameInput = enterEditMode();
    fireEvent.change(nameInput, { target: { value: 'Changed' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Acme')).toBeTruthy();
    // the hand-off is deferred until the Edit button has re-rendered
    await waitFor(() => expect(document.activeElement).toBe(getEditButton()));
    expect(updateTeam).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves the new name, notifies the parent and returns focus to the Edit button', async () => {
    const updatedTeam = { ...team, name: 'Acme Renamed' };
    updateTeam.mockResolvedValue(updatedTeam);
    const { onSave } = setup();
    const nameInput = enterEditMode();
    fireEvent.change(nameInput, { target: { value: 'Acme Renamed' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(updatedTeam));
    expect(updateTeam).toHaveBeenCalledWith('team-1', { name: 'Acme Renamed' });
    expect(screen.queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(getEditButton()));
  });

  it('leaves edit mode and returns focus to the Edit button when saving fails', async () => {
    updateTeam.mockRejectedValue(new Error('boom'));
    const { onSave } = setup();
    const nameInput = enterEditMode();
    fireEvent.change(nameInput, { target: { value: 'Acme Renamed' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(getEditButton()));
  });

  it('blocks saving while the name is invalid', () => {
    setup();
    const nameInput = enterEditMode();

    fireEvent.change(nameInput, { target: { value: 'a' } });

    expect(screen.getByText('Your name must be between 2 and 255 characters')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('focuses the name input when edit mode begins (the Edit button unmounts on activation)', async () => {
    render(<TeamName team={team} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit team name/i }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' })));
  });
});
