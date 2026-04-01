import { fireEvent, render, screen } from '@testing-library/react';
import { Checkbox } from '../Checkbox';

describe('Checkbox', () => {
  test('renders label text', () => {
    render(<Checkbox id="cb-1" checked={false} label="Accept Terms" onChange={() => {}} />);
    expect(screen.getByText('Accept Terms')).toBeTruthy();
  });

  test('renders checked state', () => {
    render(<Checkbox id="cb-1" checked label="Label" onChange={() => {}} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  test('renders unchecked state', () => {
    render(<Checkbox id="cb-1" checked={false} label="Label" onChange={() => {}} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  test('calls onChange with new boolean value when clicked', () => {
    const onChange = vi.fn();
    render(<Checkbox id="cb-1" checked={false} label="Label" onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('renders disabled when disabled=true', () => {
    render(<Checkbox id="cb-1" checked={false} label="Label" disabled onChange={() => {}} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  test('renders error state with slds-has-error class', () => {
    const { container } = render(<Checkbox id="cb-1" checked={false} label="Label" hasError onChange={() => {}} />);
    expect((container.firstChild as HTMLElement).className).toContain('slds-has-error');
  });

  test('renders error message when hasError and errorMessage are provided', () => {
    render(
      <Checkbox
        id="cb-1"
        checked={false}
        label="Label"
        hasError
        errorMessage="This field is required"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  test('does not render error message when hasError is false', () => {
    render(
      <Checkbox
        id="cb-1"
        checked={false}
        label="Label"
        hasError={false}
        errorMessage="Error"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('Error')).toBeNull();
  });

  test('renders required indicator when isRequired=true in standalone mode', () => {
    render(<Checkbox id="cb-1" checked={false} label="Label" isRequired isStandAlone onChange={() => {}} />);
    expect(screen.getByTitle('required')).toBeTruthy();
  });

  test('renders readonly when readOnly=true', () => {
    render(<Checkbox id="cb-1" checked={false} label="Label" readOnly onChange={() => {}} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  test('renders help text when helpText is provided', () => {
    render(
      <Checkbox id="cb-1" checked={false} label="Label" helpText="Helpful hint" onChange={() => {}} />,
    );
    expect(screen.getByText('Helpful hint')).toBeTruthy();
  });

  test('associates input with label via id', () => {
    render(<Checkbox id="my-checkbox" checked={false} label="My Label" onChange={() => {}} />);
    const input = screen.getByRole('checkbox');
    expect(input.getAttribute('id')).toBe('my-checkbox');
    const label = document.querySelector('label[for="my-checkbox"]');
    expect(label).toBeTruthy();
  });
});
