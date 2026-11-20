import { ACCESS_PROFILE_TOOL_GROUPS, ACCESS_PROFILE_TOOLS } from '@jetstream/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAccessProfileEditorModal } from '../TeamAccessProfileEditorModal';

const { createTeamAccessProfile, updateTeamAccessProfile } = vi.hoisted(() => ({
  createTeamAccessProfile: vi.fn(),
  updateTeamAccessProfile: vi.fn(),
}));

vi.mock('@jetstream/shared/data', () => ({ createTeamAccessProfile, updateTeamAccessProfile }));

async function setup() {
  const onClose = vi.fn();
  render(<TeamAccessProfileEditorModal teamId="team-1" onClose={onClose} />);
  // Let the modal place its initial focus first, so it does not override focus the test moves
  await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
  return { onClose, saveButton: screen.getByRole('button', { name: 'Save' }) };
}

function getWarningAnnouncement() {
  return document.querySelector('.slds-assistive-text[role="status"]')?.textContent ?? null;
}

describe('TeamAccessProfileEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Save focusable while a save runs and after it fails, without saving twice', async () => {
    createTeamAccessProfile.mockRejectedValue(new Error('A profile with this name already exists'));
    const { saveButton, onClose } = await setup();
    expect(saveButton.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Sales Ops' } });
    expect(saveButton.getAttribute('aria-disabled')).toBeNull();
    act(() => saveButton.focus());

    const form = saveButton.ownerDocument.getElementById('team-access-profile-editor-form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(saveButton.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(saveButton);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(createTeamAccessProfile).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(saveButton);
    expect(saveButton.getAttribute('aria-disabled')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a submit while the name is empty', async () => {
    const { saveButton } = await setup();

    fireEvent.click(saveButton);
    fireEvent.submit(saveButton.ownerDocument.getElementById('team-access-profile-editor-form') as HTMLFormElement);

    expect(createTeamAccessProfile).not.toHaveBeenCalled();
  });

  it('announces policy warnings through a live region that is mounted before they appear', async () => {
    await setup();
    // New profiles start with full access, which has nothing to warn about
    expect(getWarningAnnouncement()).toBe('');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Create and update records' }));

    await waitFor(() => expect(getWarningAnnouncement()).toContain('is enabled, but "Create and update records" is not.'));
  });

  it('groups each tool section under its name', async () => {
    await setup();

    const [firstToolGroup] = ACCESS_PROFILE_TOOL_GROUPS;
    const [firstTool] = ACCESS_PROFILE_TOOLS.filter(({ group }) => group === firstToolGroup.key);
    const toolGroup = screen.getByRole('group', { name: firstToolGroup.label });
    expect(toolGroup.contains(screen.getByRole('checkbox', { name: firstTool.label }))).toBe(true);
  });
});
