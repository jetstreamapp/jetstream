import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MassUpdateRecordsObjectRowLimit from '../MassUpdateRecordsObjectRowLimit';

describe('MassUpdateRecordsObjectRowLimit', () => {
  it('Should emit the parsed limit', () => {
    const onChange = vi.fn();
    render(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Maximum records to update'), { target: { value: '5000' } });

    expect(onChange).toHaveBeenCalledWith(5000);
  });

  it('Should clear the value when the input is emptied', () => {
    const onChange = vi.fn();
    render(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={5000} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Maximum records to update'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('Should show an error when the limit is below one', () => {
    render(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={0} onChange={vi.fn()} />);

    expect(screen.getByText(/limit must be 1 or greater/i)).toBeTruthy();
  });
});
