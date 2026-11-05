import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoadRecordsNextStepButton, LoadRecordsNextStepButtonProps } from '../LoadRecordsNextStepButton';

const BLOCKED_REASON = 'Select an object and upload a file to continue';

function setup(overrides: Partial<LoadRecordsNextStepButtonProps> = {}) {
  const props: LoadRecordsNextStepButtonProps = {
    label: 'Continue to Map Fields',
    blockedReason: BLOCKED_REASON,
    onClick: vi.fn(),
    ...overrides,
  };
  // The main landmark mirrors the app shell so axe's region rule sees real page context
  const renderResult = render(
    <main>
      <LoadRecordsNextStepButton {...props} />
    </main>,
  );
  const button = screen.getByRole('button', { name: /Continue to Map Fields/ });
  return { props, button, ...renderResult };
}

function getAccessibleDescription(button: HTMLElement): string | null {
  const describedById = button.getAttribute('aria-describedby');
  if (!describedById) {
    return null;
  }
  return document.getElementById(describedById)?.textContent ?? null;
}

describe('LoadRecordsNextStepButton', () => {
  it('stays focusable while blocked and is described by the reason', () => {
    const { button, props } = setup();

    // aria-disabled rather than native disabled so the button keeps focus and can be described
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(getAccessibleDescription(button)).toBe(BLOCKED_REASON);

    fireEvent.click(button);
    expect(props.onClick).not.toHaveBeenCalled();
  });

  it('reveals the reason as a tooltip on keyboard focus', async () => {
    const { button } = setup();

    act(() => button.focus());

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe(BLOCKED_REASON);
  });

  it('reveals the reason as a tooltip on hover', async () => {
    const { button } = setup();

    await userEvent.hover(button);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe(BLOCKED_REASON);
  });

  it('is enabled without a description once the step is complete', () => {
    const { button, props } = setup({ blockedReason: null });

    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(button.getAttribute('aria-keyshortcuts')).toBeTruthy();

    fireEvent.click(button);
    expect(props.onClick).toHaveBeenCalledTimes(1);
  });

  it('honors an external disabled flag without exposing a reason', () => {
    const { button, props } = setup({ blockedReason: null, disabled: true });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-describedby')).toBeNull();

    fireEvent.click(button);
    expect(props.onClick).not.toHaveBeenCalled();
  });

  it('has no axe violations while blocked', async () => {
    const { baseElement } = setup();
    // The tooltip schedules a zero-delay unmount timer on render; flush it inside act before scanning
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });
});
