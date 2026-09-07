import { fireEvent, render } from '@testing-library/react';
import { Combobox } from '../Combobox';
import { ComboboxListItem } from '../ComboboxListItem';

const NOOP = () => undefined;

function renderOpen(extra: Record<string, unknown>) {
  const result = render(
    <Combobox label="Orgs" onKeyboardNavigation={NOOP} {...extra}>
      <ComboboxListItem id="a" label="one" selected={false} onSelection={NOOP} />
    </Combobox>,
  );
  fireEvent.click(result.container.querySelector('input') as HTMLInputElement);
  return result.container.querySelector('[role="listbox"]') as HTMLElement;
}

describe('Combobox dropdownWidth', () => {
  test('defaults to fluid (panel pinned to input width)', () => {
    const listbox = renderOpen({});
    expect(listbox.className).toContain('slds-dropdown_fluid');
  });

  test('drops fluid and applies the provided widths', () => {
    const listbox = renderOpen({ dropdownWidth: { minWidth: '100%', maxWidth: '32rem' } });
    expect(listbox.className).not.toContain('slds-dropdown_fluid');
    // jsdom resolves absolute lengths against the 16px default root font size, so the 32rem handed
    // to the component reads back as 512px. Percentages have no layout to resolve against, so
    // minWidth comes back verbatim.
    const styles = getComputedStyle(listbox);
    expect(styles.minWidth).toBe('100%');
    expect(styles.maxWidth).toBe('512px');
  });
});
