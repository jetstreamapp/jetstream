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

  test('does not toggle when disabled', async () => {
    const onChange = vi.fn();
    render(<CheckboxToggle id="toggle-1" checked={false} label="Include deleted records" disabled onChange={onChange} />);

    await userEvent.click(screen.getByText('Include deleted records'));

    expect(onChange).not.toHaveBeenCalled();
  });

  test('has no axe violations', async () => {
    const { baseElement } = render(
      <main>
        <CheckboxToggle id="toggle-1" checked={false} label="Include deleted records" />
      </main>,
    );
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });
});
