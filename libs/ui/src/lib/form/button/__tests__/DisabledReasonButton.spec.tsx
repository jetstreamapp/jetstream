import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DisabledReasonButton } from '../DisabledReasonButton';

/** The text a screen reader reads as the element's description (its aria-describedby targets, in order) */
function getDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

describe('DisabledReasonButton', () => {
  it('stays focusable while disabled, ignores clicks, and describes itself with the reason', async () => {
    const onClick = vi.fn();
    const { baseElement } = render(
      <DisabledReasonButton
        className="slds-button slds-button_brand"
        disabled
        disabledReason="Your access does not include deploying"
        onClick={onClick}
      >
        Deploy
      </DisabledReasonButton>,
    );
    const button = screen.getByRole('button', { name: 'Deploy' });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('type')).toBe('button');
    expect(getDescription(button)).toBe('Your access does not include deploying');

    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    // The tooltip opens on keyboard focus, not only on hover
    expect((await screen.findByRole('tooltip')).textContent).toContain('Your access does not include deploying');

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    await axeScan(baseElement);
  });

  it('runs the handler and drops the reason once enabled, keeping the same button element', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <DisabledReasonButton disabled disabledReason="Select a file first" onClick={onClick}>
        Continue
      </DisabledReasonButton>,
    );
    const button = screen.getByRole('button', { name: 'Continue' });
    act(() => button.focus());

    rerender(
      <DisabledReasonButton disabled={false} disabledReason="Select a file first" onClick={onClick}>
        Continue
      </DisabledReasonButton>,
    );

    // Same node, still focused — the tooltip wrapper never unmounts around it
    expect(screen.getByRole('button', { name: 'Continue' })).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(getDescription(button)).not.toContain('Select a file first');

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps a caller-provided description alongside the reason', () => {
    render(
      <>
        <span id="seat-note">No seats are free</span>
        <DisabledReasonButton aria-describedby="seat-note" disabled disabledReason="Add a seat to invite members" onClick={vi.fn()}>
          Send Invitation
        </DisabledReasonButton>
      </>,
    );

    expect(getDescription(screen.getByRole('button', { name: 'Send Invitation' }))).toBe('No seats are free Add a seat to invite members');
  });

  it('shows the regular tooltip while enabled', async () => {
    render(
      <DisabledReasonButton tooltip="Cmd+Enter" onClick={vi.fn()}>
        Save
      </DisabledReasonButton>,
    );
    act(() => screen.getByRole('button', { name: 'Save' }).focus());
    expect((await screen.findByRole('tooltip')).textContent).toContain('Cmd+Enter');
  });
});
