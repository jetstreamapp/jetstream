import { ListItem } from '@jetstream/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Picklist } from '../Picklist';

const ITEMS: ListItem[] = [
  { id: 'one', value: 'one', label: 'First option' },
  { id: 'two', value: 'two', label: 'Second option' },
];

describe('Picklist', () => {
  test.each([false, true])('selects an item with usePortal=%s', async (usePortal) => {
    const onChange = vi.fn();
    render(
      <Picklist
        label="Choices"
        items={ITEMS}
        selectedItemIds={['one']}
        allowDeselection={false}
        usePortal={usePortal}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Second option'));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'two' })]);
    expect(screen.queryByText('Second option')).toBeNull();
  });

  test('renders the list outside of the component when usePortal is set', async () => {
    const { container } = render(
      <Picklist label="Choices" items={ITEMS} selectedItemIds={['one']} allowDeselection={false} usePortal onChange={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    const option = await screen.findByText('Second option');

    expect(container.contains(option)).toBe(false);
  });
});
