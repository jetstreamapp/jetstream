import { updateTeam } from '@jetstream/shared/data';
import { TeamUserFacing } from '@jetstream/types';
import { fireToast, Form, FormRow, FormRowItem, Input, ReadOnlyFormItem } from '@jetstream/ui';
import { useState } from 'react';

export function TeamName({ team, onSave }: { team: TeamUserFacing; onSave: (name: TeamUserFacing) => void }) {
  const [editMode, setEditMode] = useState(false);
  const [value, setValue] = useState(team?.name || '');
  const [invalidName, setInvalidName] = useState(false);

  function handleCancelEdit() {
    setValue(team?.name || '');
    setInvalidName(false);
    setEditMode(false);
    focusEditButton();
  }

  /**
   * Save and Cancel unmount with edit mode, which would drop keyboard focus to <body> — return it to
   * the Edit button that replaces them (polled briefly so it exists after the re-render)
   */
  function focusEditButton() {
    let attemptsRemaining = 10;
    const tryFocus = () => {
      const editButton = document.querySelector<HTMLElement>('[data-testid="team-name-form"] button[title="Edit Team Name"]');
      if (editButton) {
        editButton.focus();
        return;
      }
      attemptsRemaining--;
      if (attemptsRemaining > 0) {
        window.setTimeout(tryFocus, 50);
      }
    };
    window.setTimeout(tryFocus);
  }

  function onChange(value: { name: string }) {
    setValue(value.name);
    const normalizedValue = value.name.trim();
    setInvalidName(!normalizedValue || normalizedValue.length < 2 || normalizedValue.length > 255);
  }

  async function handleSave() {
    try {
      if (invalidName) {
        return;
      }

      const updatedTeam = await updateTeam(team.id, { name: value });

      setEditMode(false);
      onSave(updatedTeam);
      focusEditButton();
    } catch {
      fireToast({ type: 'error', message: 'There was an error saving the team name. Please try again.' });
      setValue(team?.name || '');
      setInvalidName(false);
      setEditMode(false);
      focusEditButton();
    }
  }

  return (
    <Form data-testid="team-name-form" className="slds-m-bottom_x-small" css={{ maxWidth: '200px' }}>
      <FormRow>
        <FormRowItem>
          {!editMode && (
            <ReadOnlyFormItem label="Team Name" onEditMore={() => setEditMode(true)}>
              {team?.name}
            </ReadOnlyFormItem>
          )}
          {editMode && (
            <Input
              id="team-name"
              className="slds-is-editing"
              label="Name"
              hasError={invalidName}
              errorMessage="Your name must be between 2 and 255 characters"
            >
              <input
                id="team-name"
                className="slds-input"
                value={value}
                minLength={2}
                maxLength={254}
                onChange={(event) => onChange({ name: event.target.value })}
              />
            </Input>
          )}
        </FormRowItem>
      </FormRow>
      {editMode && (
        <FormRow className="slds-p-left_small slds-m-vertical_x-small">
          <button className="slds-button slds-button_brand" disabled={invalidName} onClick={handleSave}>
            Save
          </button>
          <button className="slds-button slds-button_neutral" onClick={() => handleCancelEdit()}>
            Cancel
          </button>
        </FormRow>
      )}
    </Form>
  );
}
