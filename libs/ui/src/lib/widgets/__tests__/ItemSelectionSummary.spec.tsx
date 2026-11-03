import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemSelectionSummary } from '../ItemSelectionSummary';

const items = [
  { value: 'Account', label: 'Account' },
  { value: 'Contact', label: 'Contact' },
];

describe('ItemSelectionSummary', () => {
  it('opens the selection popover when the trigger is clicked', async () => {
    render(<ItemSelectionSummary items={items} onClearItem={vi.fn()} onClearAll={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /2 items selected/ }));

    expect(await screen.findByRole('button', { name: 'Clear All' })).toBeTruthy();
  });

  it('keeps a disabled trigger focusable but does not open on click', () => {
    render(<ItemSelectionSummary items={items} disabled onClearItem={vi.fn()} onClearAll={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /2 items selected/ });

    trigger.focus();
    fireEvent.click(trigger);

    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Clear All' })).toBeNull();
  });
});
