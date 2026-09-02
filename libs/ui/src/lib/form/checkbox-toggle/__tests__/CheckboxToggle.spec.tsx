import { axeScan } from '@jetstream/test-utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckboxToggle from '../CheckboxToggle';

describe('CheckboxToggle', () => {
  test('Space toggles exactly once when the checkbox is focused', async () => {
    const onChange = vi.fn();
    render(<CheckboxToggle id="toggle-1" checked={false} label="Include deleted records" onChange={onChange} />);

    screen.getByRole('checkbox').focus();
    await userEvent.keyboard(' ');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('clicking the label text toggles exactly once', async () => {
    const onChange = vi.fn();
    render(<CheckboxToggle id="toggle-1" checked={false} label="Include deleted records" onChange={onChange} />);

    await userEvent.click(screen.getByText('Include deleted records'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('with labelHelp, the label text still toggles the checkbox and names it (help button is not the label control)', async () => {
    const onChange = vi.fn();
    render(
      <CheckboxToggle
        id="toggle-1"
        checked={false}
        label="Include deleted records"
        labelHelp="Deleted records are returned with an IsDeleted flag"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /Include deleted records/ })).toBeTruthy();
    await userEvent.click(screen.getByText('Include deleted records'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('a hidden label still names the checkbox', () => {
    render(<CheckboxToggle id="toggle-1" checked={false} label="Include deleted records" hideLabel />);

    expect(screen.getByRole('checkbox', { name: /Include deleted records/ })).toBeTruthy();
  });

  test('does not toggle when disabled', async () => {
    const onChange = vi.fn();
    render(<CheckboxToggle id="toggle-1" checked={false} label="Include deleted records" disabled onChange={onChange} />);

    await userEvent.click(screen.getByText('Include deleted records'));

    expect(onChange).not.toHaveBeenCalled();
  });

  test('has no axe violations', async () => {
    const { baseElement } = render(
      <main>
        <CheckboxToggle id="toggle-1" checked={false} label="Include deleted records" labelHelp="Deleted records are included" />
      </main>,
    );
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });

  test('exposes disclosure state when it reveals content below it', () => {
    const { rerender } = render(
      <CheckboxToggle
        id="toggle-2"
        checked={false}
        label="Advanced options"
        ariaExpanded={false}
        ariaControls="advanced"
        onChange={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.getAttribute('aria-expanded')).toBe('false');
    expect(checkbox.getAttribute('aria-controls')).toBe('advanced');

    rerender(<CheckboxToggle id="toggle-2" checked label="Advanced options" ariaExpanded ariaControls="advanced" onChange={vi.fn()} />);
    expect(checkbox.getAttribute('aria-expanded')).toBe('true');
  });
});
