import { TeamLoginConfigRequest } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { atom } from 'jotai';
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

vi.doMock('@jetstream/ui/app-state', () => ({ abilityState: atom({ cannot: () => false }) }));

const { TeamLoginConfiguration } = await import('../TeamLoginConfiguration');

const loginConfiguration: TeamLoginConfigRequest = {
  requireMfa: false,
  ssoRequireMfa: false,
  allowedMfaMethods: ['otp', 'email'],
  allowedProviders: ['credentials', 'google'],
  allowIdentityLinking: true,
  autoAddToTeam: false,
};

function setup(onUpdate = vi.fn().mockResolvedValue(undefined)) {
  render(
    <TeamLoginConfiguration loginConfiguration={loginConfiguration} hasSsoConfigured={false} ssoIsActive={false} onUpdate={onUpdate} />,
  );
  return { onUpdate };
}

const getSaveButton = () => screen.getByRole('button', { name: 'Save' });
const getRequireMfa = () => screen.getByLabelText('Require Multi-Factor Authentication', { exact: false });

describe('TeamLoginConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Guards the child's half of the contract: nothing here disables or replaces the focused control
  // mid-save. (The parent's remount-on-save, the original cause of the lost focus, is gone with its
  // `key` prop and is not reachable from this component's own tests.)
  it('does not disable or replace the control that submitted while the save is in flight', async () => {
    const { onUpdate } = setup();
    const checkbox = getRequireMfa();
    fireEvent.click(checkbox);
    checkbox.focus();

    fireEvent.submit(checkbox.closest('form') as HTMLFormElement);

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(document.activeElement).toBe(checkbox);
  });

  it('settles to not-dirty in place after a save, leaving Save focusable but aria-disabled', async () => {
    const { onUpdate } = setup();
    fireEvent.click(getRequireMfa());

    const saveButton = getSaveButton();
    saveButton.focus();
    fireEvent.click(saveButton);

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getSaveButton().getAttribute('aria-disabled')).toBe('true'));
    expect(document.activeElement).toBe(getSaveButton());
  });

  // Enter anywhere in a form submits implicitly and never runs the button's click guard
  it('ignores an implicit submit while there is nothing to save', () => {
    const { onUpdate } = setup();

    fireEvent.submit(getRequireMfa().closest('form') as HTMLFormElement);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(getSaveButton().getAttribute('aria-disabled')).toBe('true');
  });

  it('ignores an implicit submit while the form is invalid', () => {
    const { onUpdate } = setup();
    // Clearing both MFA methods puts the form in its error state
    fireEvent.click(screen.getByLabelText('Authenticator App', { exact: false }));
    fireEvent.click(screen.getByLabelText('Email', { exact: false }));

    fireEvent.submit(getRequireMfa().closest('form') as HTMLFormElement);

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
