import { fireEvent, render, screen } from '@testing-library/react';
import { List } from '../List';
import { ReadonlyList } from '../ReadonlyList';

type TestItem = { id: string; name: string; description?: string };

const items: TestItem[] = [
  { id: 'item-1', name: 'Alpha', description: 'First item' },
  { id: 'item-2', name: 'Beta', description: 'Second item' },
  { id: 'item-3', name: 'Gamma' },
];

function getContent(item: TestItem) {
  return {
    key: item.id,
    heading: item.name,
    subheading: item.description,
  };
}

describe('List', () => {
  test('renders all item headings', () => {
    render(
      <List
        items={items}
        isActive={() => false}
        getContent={getContent}
        onSelected={() => {}}
      />,
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  test('renders subheading when provided', () => {
    render(
      <List
        items={items}
        isActive={() => false}
        getContent={getContent}
        onSelected={() => {}}
      />,
    );
    expect(screen.getByText('First item')).toBeTruthy();
  });

  test('active item has aria-selected=true', () => {
    render(
      <List
        items={items}
        isActive={(item) => item.id === 'item-2'}
        getContent={getContent}
        onSelected={() => {}}
      />,
    );
    const options = screen.getAllByRole('option');
    const betaOption = options.find((opt) => opt.querySelector('[title="Beta"]'));
    expect(betaOption?.getAttribute('aria-selected')).toBe('true');
  });

  test('calls onSelected with the key when an item is clicked', () => {
    const onSelected = vi.fn();
    render(
      <List
        items={items}
        isActive={() => false}
        getContent={getContent}
        onSelected={onSelected}
      />,
    );
    fireEvent.click(screen.getByText('Alpha'));
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledWith('item-1');
  });

  test('renders a listbox', () => {
    render(
      <List
        items={items}
        isActive={() => false}
        getContent={getContent}
        onSelected={() => {}}
      />,
    );
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  test('renders nothing when items is empty', () => {
    render(
      <List
        items={[]}
        isActive={() => false}
        getContent={getContent}
        onSelected={() => {}}
      />,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('keyboard ArrowDown moves focus to next item', () => {
    render(
      <List
        items={items}
        isActive={(item) => item.id === 'item-1'}
        getContent={getContent}
        onSelected={() => {}}
      />,
    );
    const listbox = screen.getByRole('listbox');
    const options = screen.getAllByRole('option');
    fireEvent.keyDown(listbox, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
  });

  test('keyboard Home moves focus to first item', () => {
    render(
      <List
        items={items}
        isActive={(item) => item.id === 'item-3'}
        getContent={getContent}
        onSelected={() => {}}
      />,
    );
    const listbox = screen.getByRole('listbox');
    const options = screen.getAllByRole('option');
    fireEvent.keyDown(listbox, { key: 'Home', code: 'Home' });
    expect(document.activeElement).toBe(options[0]);
  });
});

describe('ReadonlyList', () => {
  test('renders all item headings', () => {
    render(
      <ReadonlyList
        items={items}
        getContent={getContent}
      />,
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  test('renders subheading when provided', () => {
    render(
      <ReadonlyList
        items={items}
        getContent={getContent}
      />,
    );
    expect(screen.getByText('Second item')).toBeTruthy();
  });

  test('renders nothing when items is empty', () => {
    const { container } = render(
      <ReadonlyList
        items={[]}
        getContent={getContent}
      />,
    );
    expect(container.querySelector('ul')).toBeNull();
  });

  test('each item has slds-item class', () => {
    render(
      <ReadonlyList
        items={[items[0]]}
        getContent={getContent}
      />,
    );
    const li = document.querySelector('li');
    expect(li?.className).toContain('slds-item');
  });
});
