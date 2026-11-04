import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import Input from '../Input';

describe('Input', () => {
  it('clears without submitting a wrapping form, since the clear button is not a submit button', async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onClear = vi.fn();
    const { baseElement } = render(
      <form onSubmit={onSubmit}>
        <Input id="name" label="Name" clearButton onClear={onClear}>
          <input id="name" className="slds-input" defaultValue="Acme" />
        </Input>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear Name' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    await axeScan(baseElement);
  });
});
