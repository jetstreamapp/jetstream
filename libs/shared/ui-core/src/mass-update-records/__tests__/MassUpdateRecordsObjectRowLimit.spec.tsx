import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MassUpdateRecordsObjectRowLimit from '../MassUpdateRecordsObjectRowLimit';
import { MAX_SOQL_OFFSET } from '../mass-update-records.utils';

describe('MassUpdateRecordsObjectRowLimit', () => {
  it('Should emit the parsed limit without disturbing the offset', () => {
    const onChange = vi.fn();
    render(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={null} offset={100} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Maximum records to update'), { target: { value: '5000' } });

    expect(onChange).toHaveBeenCalledWith({ limit: 5000, offset: 100 });
  });

  it('Should emit the parsed offset without disturbing the limit', () => {
    const onChange = vi.fn();
    render(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={5000} offset={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Skip records'), { target: { value: '100' } });

    expect(onChange).toHaveBeenCalledWith({ limit: 5000, offset: 100 });
  });

  it('Should clear the value when the input is emptied', () => {
    const onChange = vi.fn();
    render(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={5000} offset={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Maximum records to update'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({ limit: null, offset: null });
  });

  it('Should show an error when the offset is beyond what Salesforce allows', () => {
    const { rerender } = render(
      <MassUpdateRecordsObjectRowLimit sobject="Account" limit={null} offset={MAX_SOQL_OFFSET} onChange={vi.fn()} />,
    );
    expect(screen.queryByText(/maximum offset/i)).toBeNull();

    rerender(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={null} offset={MAX_SOQL_OFFSET + 1} onChange={vi.fn()} />);
    expect(screen.getByText(/maximum offset of 2,000/i)).toBeTruthy();
  });

  it('Should show an error when the limit is below one', () => {
    render(<MassUpdateRecordsObjectRowLimit sobject="Account" limit={0} offset={null} onChange={vi.fn()} />);

    expect(screen.getByText(/limit must be 1 or greater/i)).toBeTruthy();
  });
});
