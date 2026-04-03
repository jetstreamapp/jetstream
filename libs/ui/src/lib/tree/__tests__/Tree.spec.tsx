import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Tree, TreeHandleRefFns, TreeItems } from '../Tree';

const flatItems: TreeItems[] = [
  { id: 'leaf-1', label: 'Leaf One' },
  { id: 'leaf-2', label: 'Leaf Two' },
  { id: 'leaf-3', label: 'Leaf Three' },
];

const nestedItems: TreeItems[] = [
  {
    id: 'parent-1',
    label: 'Parent One',
    treeItems: [
      { id: 'child-1a', label: 'Child 1A' },
      { id: 'child-1b', label: 'Child 1B' },
    ],
  },
  {
    id: 'parent-2',
    label: 'Parent Two',
    treeItems: [{ id: 'child-2a', label: 'Child 2A' }],
  },
  { id: 'leaf-only', label: 'Standalone Leaf' },
];

describe('Tree', () => {
  test('renders all top-level item labels', () => {
    render(<Tree items={flatItems} />);
    expect(screen.getByText('Leaf One')).toBeTruthy();
    expect(screen.getByText('Leaf Two')).toBeTruthy();
    expect(screen.getByText('Leaf Three')).toBeTruthy();
  });

  test('renders with role=tree', () => {
    render(<Tree items={flatItems} />);
    expect(screen.getByRole('tree')).toBeTruthy();
  });

  test('renders header when provided', () => {
    render(<Tree items={flatItems} header="My Tree" />);
    expect(screen.getByText('My Tree')).toBeTruthy();
  });

  test('does not render header when not provided', () => {
    render(<Tree items={flatItems} />);
    expect(screen.queryByText('My Tree')).toBeNull();
  });

  test('calls onSelected when a leaf item is clicked', () => {
    const onSelected = vi.fn();
    render(<Tree items={flatItems} onSelected={onSelected} />);
    fireEvent.click(screen.getByText('Leaf One'));
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledWith(flatItems[0]);
  });

  test('expandAllOnInit expands all parent nodes', () => {
    render(<Tree items={nestedItems} expandAllOnInit />);
    // Child nodes should be visible when expanded
    expect(screen.getByText('Child 1A')).toBeTruthy();
    expect(screen.getByText('Child 1B')).toBeTruthy();
    expect(screen.getByText('Child 2A')).toBeTruthy();
  });

  test('child nodes are not visible when not expanded', () => {
    render(<Tree items={nestedItems} />);
    expect(screen.queryByText('Child 1A')).toBeNull();
    expect(screen.queryByText('Child 2A')).toBeNull();
  });

  test('clicking a parent node toggles expansion', () => {
    render(<Tree items={nestedItems} />);
    expect(screen.queryByText('Child 1A')).toBeNull();
    fireEvent.click(screen.getByText('Parent One'));
    expect(screen.getByText('Child 1A')).toBeTruthy();
  });

  test('selectFirstLeafNodeOnInit selects the first leaf node', () => {
    const onSelected = vi.fn();
    render(<Tree items={nestedItems} selectFirstLeafNodeOnInit onSelected={onSelected} />);
    expect(onSelected).toHaveBeenCalledTimes(1);
    // The first leaf is a child of parent-1 which hasn't been expanded, but getAllIds traverses all
    expect(onSelected).toHaveBeenCalledWith(expect.objectContaining({ id: 'child-1a' }));
  });

  test('onlyEmitOnLeafNodeClick does not call onSelected for parent nodes', () => {
    const onSelected = vi.fn();
    render(<Tree items={nestedItems} onlyEmitOnLeafNodeClick onSelected={onSelected} />);
    fireEvent.click(screen.getByText('Parent One'));
    expect(onSelected).not.toHaveBeenCalled();
  });

  test('imperative ref collapseAll collapses all nodes', () => {
    const ref = createRef<TreeHandleRefFns>();
    render(<Tree ref={ref} items={nestedItems} expandAllOnInit />);
    expect(screen.getByText('Child 1A')).toBeTruthy();
    act(() => {
      ref.current?.collapseAll();
    });
    expect(screen.queryByText('Child 1A')).toBeNull();
  });

  test('imperative ref expandAll expands all parent nodes', () => {
    const ref = createRef<TreeHandleRefFns>();
    render(<Tree ref={ref} items={nestedItems} />);
    expect(screen.queryByText('Child 1A')).toBeNull();
    act(() => {
      ref.current?.expandAll();
    });
    expect(screen.getByText('Child 1A')).toBeTruthy();
  });

  test('each tree item has role=treeitem', () => {
    render(<Tree items={flatItems} />);
    const treeItems = screen.getAllByRole('treeitem');
    expect(treeItems.length).toBe(3);
  });

  test('selected item has aria-selected=true', () => {
    render(<Tree items={flatItems} />);
    fireEvent.click(screen.getByText('Leaf Two'));
    const treeItems = screen.getAllByRole('treeitem');
    const selectedItem = treeItems.find((item) => item.getAttribute('aria-selected') === 'true');
    expect(selectedItem).toBeTruthy();
  });
});
