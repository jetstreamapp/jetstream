import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DropDown } from '../DropDown';

const items = [
  { id: 'one', value: 'One' },
  { id: 'two', value: 'Two' },
  { id: 'three', value: 'Three' },
];

function renderDropDown() {
  const onSelected = vi.fn();
  const result = render(<DropDown actionText="Row actions" items={items} onSelected={onSelected} />);
  const trigger = screen.getByRole('button', { name: 'Row actions' });
  return { ...result, onSelected, trigger };
}

describe('DropDown keyboard', () => {
  test('ArrowDown on the closed trigger opens the menu on the first item', async () => {
    const { trigger, baseElement } = renderDropDown();
    trigger.focus();
    expect(fireEvent.keyDown(trigger, { key: 'ArrowDown' })).toBe(false);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'One' }));

    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });

  test('ArrowUp on the closed trigger opens the menu on the last item', () => {
    const { trigger } = renderDropDown();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Three' }));
  });

  test.each(['Enter', ' '])('%j on a focused menu item activates it, closes the menu and returns focus to the trigger', (key) => {
    const { trigger, onSelected } = renderDropDown();
    fireEvent.click(trigger);
    const second = screen.getByRole('menuitem', { name: 'Two' });
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'One' }), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key });

    expect(onSelected).toHaveBeenCalledWith('two', undefined);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
