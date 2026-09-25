import { SoqlQueryFormatOptions, SoqlQueryFormatOptionsSchema } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SoqlQueryFormatSettings } from '../SoqlQueryFormatSettings';

vi.mock('../../analytics', () => ({ useAmplitude: () => ({ trackEvent: vi.fn() }) }));

const DEFAULT_OPTIONS = SoqlQueryFormatOptionsSchema.parse({});

function renderSettings(value: SoqlQueryFormatOptions = DEFAULT_OPTIONS) {
  const onChange = vi.fn();
  const result = render(<SoqlQueryFormatSettings value={value} onChange={onChange} />);
  return { onChange, ...result };
}

describe('SoqlQueryFormatSettings', () => {
  it('saves a toggle as soon as it changes', () => {
    const { onChange } = renderSettings();
    fireEvent.click(screen.getByRole('checkbox', { name: /New line after keywords/ }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_OPTIONS, newLineAfterKeywords: true });
  });

  it('previews a number while typing and only saves it on blur', () => {
    const { onChange } = renderSettings();
    const indentInput = screen.getByLabelText('Indent size');

    fireEvent.change(indentInput, { target: { value: '2' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('soql-format-preview').textContent).toContain('\n\t\tId,');

    fireEvent.blur(indentInput);
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_OPTIONS, numIndent: 2 });
  });

  it('flags an invalid number and restores the saved value on blur', () => {
    const { onChange } = renderSettings();
    const lineLengthInput = screen.getByLabelText('Max characters per line');

    fireEvent.change(lineLengthInput, { target: { value: '0' } });
    expect(lineLengthInput.getAttribute('aria-invalid')).toBe('true');

    fireEvent.blur(lineLengthInput);
    expect(onChange).not.toHaveBeenCalled();
    expect((lineLengthInput as HTMLInputElement).value).toBe(String(DEFAULT_OPTIONS.fieldMaxLineLength));
  });

  it('describes number fields with the row description, plus the error while invalid', () => {
    renderSettings();
    const indentInput = screen.getByLabelText('Indent size');
    const describedByText = () =>
      (indentInput.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' | ');

    expect(describedByText()).toBe('Number of tabs for each level of indentation.');

    fireEvent.change(indentInput, { target: { value: '' } });
    expect(describedByText()).toBe('Number of tabs for each level of indentation. | Enter a whole number of 1 or more');
  });

  it('does not save when a number is committed unchanged', () => {
    const { onChange } = renderSettings();
    fireEvent.blur(screen.getByLabelText('Indent size'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers reset to defaults only once something was customized', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: 'Reset to Defaults' })).toBeNull();
  });

  it('resets customized options to the defaults', () => {
    const { onChange } = renderSettings({ ...DEFAULT_OPTIONS, numIndent: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_OPTIONS);
  });

  it('drops an uncommitted number when resetting to the defaults', () => {
    const { onChange } = renderSettings({ ...DEFAULT_OPTIONS, numIndent: 3 });
    const indentInput = screen.getByLabelText('Indent size') as HTMLInputElement;
    fireEvent.change(indentInput, { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
    fireEvent.blur(indentInput);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(DEFAULT_OPTIONS);
    expect(indentInput.value).toBe('3');
  });
});
