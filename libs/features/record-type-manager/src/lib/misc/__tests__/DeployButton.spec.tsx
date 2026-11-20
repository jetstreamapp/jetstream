import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordTypePicklistSummary } from '../../types/record-types.types';

let deployAccess: { allowed: boolean; deniedReason?: string } = { allowed: true };

// The real app-state module fetches app info at module load
vi.doMock('@jetstream/ui/app-state', () => ({
  useOperationAccess: () => deployAccess,
}));

const { DeployButton } = await import('../DeployButton');

const modifiedValue = { sobject: 'Account', field: 'Industry', recordType: 'Customer' } as RecordTypePicklistSummary;

/** The text a screen reader reads as the element's description (its aria-describedby targets, in order) */
function getDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

describe('DeployButton', () => {
  it('describes itself with why it is unavailable when nothing has changed', () => {
    deployAccess = { allowed: true };
    const handleDeploy = vi.fn();
    render(<DeployButton modifiedValues={[]} handleDeploy={handleDeploy} />);
    const button = screen.getByRole('button', { name: 'Deploy Changes' });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(getDescription(button)).toBe('Change one or more values to enable deployment.');
    fireEvent.click(button);
    expect(handleDeploy).not.toHaveBeenCalled();
  });

  it('describes itself with the denied reason when deploying is not allowed', () => {
    deployAccess = { allowed: false, deniedReason: 'Your Jetstream access does not include deploying metadata.' };
    render(<DeployButton modifiedValues={[modifiedValue]} handleDeploy={vi.fn()} />);

    expect(getDescription(screen.getByRole('button', { name: 'Deploy Changes (1)' }))).toBe(
      'Your Jetstream access does not include deploying metadata.',
    );
  });

  it('describes itself with the configuration errors', () => {
    deployAccess = { allowed: true };
    render(
      <DeployButton
        modifiedValues={[modifiedValue]}
        configurationErrors={{ Account: { Industry: ['Default value is not available'] } }}
        handleDeploy={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: 'Deploy Changes (1)' });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    const description = getDescription(button);
    expect(description).toContain('Resolve the following errors before deploying:');
    expect(description).toContain('Default value is not available');
  });

  it('deploys when there are changes and no errors', () => {
    deployAccess = { allowed: true };
    const handleDeploy = vi.fn();
    render(<DeployButton modifiedValues={[modifiedValue]} handleDeploy={handleDeploy} />);
    const button = screen.getByRole('button', { name: 'Deploy Changes (1)' });

    expect(button.hasAttribute('aria-disabled')).toBe(false);
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    fireEvent.click(button);
    expect(handleDeploy).toHaveBeenCalledTimes(1);
  });
});
