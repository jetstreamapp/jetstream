import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/** The last root item is a parent so End can prove it lands on the last visible item rather than the last root item */
const parentLastItems: TreeItems[] = [
  { id: 'intro', label: 'Intro' },
  {
    id: 'chapters',
    label: 'Chapters',
    treeItems: [
      { id: 'chapter-1', label: 'Chapter One' },
      { id: 'chapter-2', label: 'Chapter Two' },
    ],
  },
];

/**
 * Looks items up by id instead of accessible name: a treeitem's name is computed from its content,
 * so an expanded parent's name also contains every child label.
 */
function getTreeItem(id: string): HTMLElement {
  const treeItem = screen.getAllByRole('treeitem').find((item) => item.dataset.treeItemId === id);
  if (!treeItem) {
    throw new Error(`Tree item "${id}" is not rendered`);
  }
  return treeItem;
}

/** Ids of every rendered treeitem in the tab order — the roving tabindex contract is that there is exactly one */
function getTabbableTreeItemIds(): string[] {
  return screen
    .getAllByRole('treeitem')
    .filter((item) => item.tabIndex === 0)
    .map((item) => item.dataset.treeItemId ?? '');
}

function focusTreeItem(id: string): HTMLElement {
  const treeItem = getTreeItem(id);
  treeItem.focus();
  return treeItem;
}

/** The tree defers focus moves to requestAnimationFrame, so poll instead of asserting synchronously */
async function expectFocusToMoveTo(id: string): Promise<void> {
  await waitFor(() => expect(document.activeElement).toBe(getTreeItem(id)));
}

/** Lets any queued requestAnimationFrame callback run so a "focus stayed put" assertion is meaningful */
async function flushAnimationFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

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

  test('reEmitSelectionOnItemsChange re-emits the selected item when the items change', () => {
    const onSelected = vi.fn();
    const { rerender } = render(<Tree items={nestedItems} expandAllOnInit reEmitSelectionOnItemsChange onSelected={onSelected} />);
    fireEvent.click(screen.getByText('Child 2A'));
    onSelected.mockClear();

    rerender(
      <Tree items={nestedItems.map((item) => ({ ...item }))} expandAllOnInit reEmitSelectionOnItemsChange onSelected={onSelected} />,
    );

    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledWith(expect.objectContaining({ id: 'child-2a' }));
  });

  test('reEmitSelectionOnItemsChange selects the first remaining leaf when the selected item is removed', () => {
    const onSelected = vi.fn();
    const { rerender } = render(<Tree items={nestedItems} expandAllOnInit reEmitSelectionOnItemsChange onSelected={onSelected} />);
    fireEvent.click(screen.getByText('Child 2A'));
    onSelected.mockClear();

    const filteredItems = nestedItems.filter((item) => item.id !== 'parent-2');
    rerender(<Tree items={filteredItems} expandAllOnInit reEmitSelectionOnItemsChange onSelected={onSelected} />);

    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledWith(expect.objectContaining({ id: 'child-1a' }));
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

  describe('roving tabindex', () => {
    test('exactly one item is tabbable when nothing is selected (regression: no item used to be tabbable)', () => {
      render(<Tree items={flatItems} />);
      expect(getTabbableTreeItemIds()).toEqual(['leaf-1']);
    });

    test('falls back to the first root item in a nested tree with no selection', () => {
      render(<Tree items={nestedItems} expandAllOnInit />);
      expect(getTabbableTreeItemIds()).toEqual(['parent-1']);
    });

    test('the selected item is the tabbable one when it is visible', () => {
      render(<Tree items={nestedItems} expandAllOnInit selectFirstLeafNodeOnInit />);
      expect(getTabbableTreeItemIds()).toEqual(['child-1a']);
    });

    test('falls back to the first root item when the selected item is hidden inside a collapsed parent', () => {
      render(<Tree items={nestedItems} selectFirstLeafNodeOnInit />);
      expect(getTabbableTreeItemIds()).toEqual(['parent-1']);
    });

    test('clicking an item makes it the tabbable one', () => {
      render(<Tree items={flatItems} />);
      fireEvent.click(screen.getByText('Leaf Three'));
      expect(getTabbableTreeItemIds()).toEqual(['leaf-3']);
    });

    test('keeps exactly one tabbable item after the focused item is collapsed out of view', () => {
      const ref = createRef<TreeHandleRefFns>();
      render(<Tree ref={ref} items={nestedItems} expandAllOnInit />);
      fireEvent.click(screen.getByText('Child 1B'));
      expect(getTabbableTreeItemIds()).toEqual(['child-1b']);

      act(() => {
        ref.current?.collapseAll();
      });

      expect(getTabbableTreeItemIds()).toEqual(['parent-1']);
    });
  });

  describe('keyboard navigation', () => {
    test('ArrowDown and ArrowUp move focus between sibling items and hand off the tab stop', async () => {
      render(<Tree items={flatItems} />);

      fireEvent.keyDown(focusTreeItem('leaf-1'), { key: 'ArrowDown' });
      await expectFocusToMoveTo('leaf-2');
      expect(getTabbableTreeItemIds()).toEqual(['leaf-2']);

      fireEvent.keyDown(getTreeItem('leaf-2'), { key: 'ArrowUp' });
      await expectFocusToMoveTo('leaf-1');
      expect(getTabbableTreeItemIds()).toEqual(['leaf-1']);
    });

    test('ArrowDown on the last visible item keeps focus there rather than wrapping', async () => {
      render(<Tree items={flatItems} />);
      const leafThree = focusTreeItem('leaf-3');

      fireEvent.keyDown(leafThree, { key: 'ArrowDown' });
      await flushAnimationFrame();

      expect(document.activeElement).toBe(leafThree);
    });

    test('ArrowUp on the first item keeps focus there rather than wrapping', async () => {
      render(<Tree items={flatItems} />);
      const leafOne = focusTreeItem('leaf-1');

      fireEvent.keyDown(leafOne, { key: 'ArrowUp' });
      await flushAnimationFrame();

      expect(document.activeElement).toBe(leafOne);
    });

    test('ArrowDown skips the hidden children of a collapsed parent', async () => {
      render(<Tree items={nestedItems} />);
      fireEvent.keyDown(focusTreeItem('parent-1'), { key: 'ArrowDown' });
      await expectFocusToMoveTo('parent-2');
    });

    test('ArrowDown walks through the children of an expanded parent before its next sibling', async () => {
      render(<Tree items={nestedItems} expandAllOnInit />);

      fireEvent.keyDown(focusTreeItem('parent-1'), { key: 'ArrowDown' });
      await expectFocusToMoveTo('child-1a');

      fireEvent.keyDown(getTreeItem('child-1a'), { key: 'ArrowDown' });
      await expectFocusToMoveTo('child-1b');

      fireEvent.keyDown(getTreeItem('child-1b'), { key: 'ArrowDown' });
      await expectFocusToMoveTo('parent-2');
    });

    test('ArrowRight on a collapsed parent expands it and keeps focus on the parent', async () => {
      render(<Tree items={nestedItems} />);
      const parentOne = focusTreeItem('parent-1');
      expect(parentOne.getAttribute('aria-expanded')).toBe('false');

      fireEvent.keyDown(parentOne, { key: 'ArrowRight' });
      await flushAnimationFrame();

      expect(parentOne.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Child 1A')).toBeTruthy();
      expect(document.activeElement).toBe(parentOne);
      expect(getTabbableTreeItemIds()).toEqual(['parent-1']);
    });

    test('ArrowRight on an expanded parent moves focus to its first child', async () => {
      render(<Tree items={nestedItems} expandAllOnInit />);

      fireEvent.keyDown(focusTreeItem('parent-1'), { key: 'ArrowRight' });
      await expectFocusToMoveTo('child-1a');

      expect(getTreeItem('parent-1').getAttribute('aria-expanded')).toBe('true');
      expect(getTabbableTreeItemIds()).toEqual(['child-1a']);
    });

    test('ArrowRight on a leaf does nothing', async () => {
      render(<Tree items={nestedItems} />);
      const leaf = focusTreeItem('leaf-only');

      fireEvent.keyDown(leaf, { key: 'ArrowRight' });
      await flushAnimationFrame();

      expect(document.activeElement).toBe(leaf);
      expect(leaf.hasAttribute('aria-expanded')).toBe(false);
    });

    test('ArrowLeft on an expanded parent collapses it and keeps focus on the parent', async () => {
      render(<Tree items={nestedItems} expandAllOnInit />);
      const parentOne = focusTreeItem('parent-1');

      fireEvent.keyDown(parentOne, { key: 'ArrowLeft' });
      await flushAnimationFrame();

      expect(parentOne.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Child 1A')).toBeNull();
      expect(document.activeElement).toBe(parentOne);
    });

    test('ArrowLeft on a child moves focus to its parent without collapsing it', async () => {
      render(<Tree items={nestedItems} expandAllOnInit />);

      fireEvent.keyDown(focusTreeItem('child-1b'), { key: 'ArrowLeft' });
      await expectFocusToMoveTo('parent-1');

      expect(getTreeItem('parent-1').getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Child 1B')).toBeTruthy();
    });

    test('ArrowLeft on a root-level leaf does nothing', async () => {
      render(<Tree items={nestedItems} />);
      const leaf = focusTreeItem('leaf-only');

      fireEvent.keyDown(leaf, { key: 'ArrowLeft' });
      await flushAnimationFrame();

      expect(document.activeElement).toBe(leaf);
    });

    test('Home and End jump to the first and last visible items', async () => {
      render(<Tree items={parentLastItems} expandAllOnInit />);

      fireEvent.keyDown(focusTreeItem('chapter-1'), { key: 'End' });
      await expectFocusToMoveTo('chapter-2');

      fireEvent.keyDown(getTreeItem('chapter-2'), { key: 'Home' });
      await expectFocusToMoveTo('intro');
    });

    test('End stops at a collapsed parent rather than one of its hidden children', async () => {
      render(<Tree items={parentLastItems} />);
      fireEvent.keyDown(focusTreeItem('intro'), { key: 'End' });
      await expectFocusToMoveTo('chapters');
    });

    test('Enter selects a leaf and emits onSelected', () => {
      const onSelected = vi.fn();
      render(<Tree items={flatItems} onSelected={onSelected} />);
      const leafTwo = focusTreeItem('leaf-2');

      fireEvent.keyDown(leafTwo, { key: 'Enter' });

      expect(leafTwo.getAttribute('aria-selected')).toBe('true');
      expect(onSelected).toHaveBeenCalledTimes(1);
      expect(onSelected).toHaveBeenCalledWith(flatItems[1]);
      expect(getTabbableTreeItemIds()).toEqual(['leaf-2']);
    });

    test('Space selects a leaf and emits onSelected', () => {
      const onSelected = vi.fn();
      render(<Tree items={flatItems} onSelected={onSelected} />);
      const leafThree = focusTreeItem('leaf-3');

      fireEvent.keyDown(leafThree, { key: ' ' });

      expect(leafThree.getAttribute('aria-selected')).toBe('true');
      expect(onSelected).toHaveBeenCalledTimes(1);
      expect(onSelected).toHaveBeenCalledWith(flatItems[2]);
    });

    test('Enter on a parent toggles its expansion, selects it, and emits onSelected each time', () => {
      const onSelected = vi.fn();
      render(<Tree items={nestedItems} onSelected={onSelected} />);
      const parentOne = focusTreeItem('parent-1');

      fireEvent.keyDown(parentOne, { key: 'Enter' });
      expect(parentOne.getAttribute('aria-expanded')).toBe('true');
      expect(parentOne.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Child 1A')).toBeTruthy();
      expect(onSelected).toHaveBeenCalledTimes(1);
      expect(onSelected).toHaveBeenCalledWith(nestedItems[0]);

      fireEvent.keyDown(parentOne, { key: 'Enter' });
      expect(parentOne.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Child 1A')).toBeNull();
      expect(onSelected).toHaveBeenCalledTimes(2);
    });

    test('Enter on a parent with onlyEmitOnLeafNodeClick toggles expansion without emitting', () => {
      const onSelected = vi.fn();
      render(<Tree items={nestedItems} onlyEmitOnLeafNodeClick onSelected={onSelected} />);
      const parentOne = focusTreeItem('parent-1');

      fireEvent.keyDown(parentOne, { key: 'Enter' });

      expect(parentOne.getAttribute('aria-expanded')).toBe('true');
      expect(onSelected).not.toHaveBeenCalled();
    });

    test('unhandled keys leave focus, selection, and expansion alone', async () => {
      const onSelected = vi.fn();
      render(<Tree items={nestedItems} onSelected={onSelected} />);
      const parentOne = focusTreeItem('parent-1');

      fireEvent.keyDown(parentOne, { key: 'a' });
      await flushAnimationFrame();

      expect(document.activeElement).toBe(parentOne);
      expect(parentOne.getAttribute('aria-expanded')).toBe('false');
      expect(parentOne.getAttribute('aria-selected')).toBe('false');
      expect(onSelected).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    test('has no axe violations with a header and an expanded, selected tree', async () => {
      const { baseElement } = render(<Tree items={nestedItems} header="Metadata Types" expandAllOnInit />);
      fireEvent.click(screen.getByText('Child 1A'));

      const results = await axeScan(baseElement);

      expect(results.violations).toEqual([]);
    });

    test('has no axe violations without a header', async () => {
      const { baseElement } = render(<Tree items={nestedItems} />);

      const results = await axeScan(baseElement);

      expect(results.violations).toEqual([]);
    });
  });
});
