import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { NumberStepperInput } from '../NumberStepperInput';

function Harness({
  initialValue = 3,
  min = 1,
  max = 5,
  onChange,
}: {
  initialValue?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <NumberStepperInput
      id="seats"
      testId="seats"
      label="Seats"
      value={value}
      min={min}
      max={max}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange?.(nextValue);
      }}
    />
  );
}

describe('NumberStepperInput', () => {
  test('steps the value with the minus and plus buttons', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByTitle('Increase'));
    expect(onChange).toHaveBeenLastCalledWith(4);
    expect((screen.getByTestId('seats') as HTMLInputElement).value).toBe('4');

    fireEvent.click(screen.getByTitle('Decrease'));
    fireEvent.click(screen.getByTitle('Decrease'));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  test('disables the buttons at the bounds', () => {
    render(<Harness initialValue={1} min={1} max={1} />);

    expect((screen.getByTitle('Decrease') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle('Increase') as HTMLButtonElement).disabled).toBe(true);
  });

  test('emits typed integers and keeps partial input until blur', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByTestId('seats') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '4' } });
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  test('clamps an out-of-range value into range on blur', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByTestId('seats') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '99' } });
    expect(onChange).toHaveBeenLastCalledWith(99);

    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(input.value).toBe('5');
  });

  test('restores the last committed value when the field is blurred empty', () => {
    render(<Harness initialValue={3} />);
    const input = screen.getByTestId('seats') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('3');
  });

  test('renders the error message and marks the input invalid', () => {
    render(
      <NumberStepperInput
        id="seats"
        testId="seats"
        label="Seats"
        value={0}
        min={1}
        hasError
        errorMessage="Enter at least 1 seat."
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText('Enter at least 1 seat.')).toBeTruthy();
    expect(screen.getByTestId('seats').getAttribute('aria-invalid')).toBe('true');
  });
});
