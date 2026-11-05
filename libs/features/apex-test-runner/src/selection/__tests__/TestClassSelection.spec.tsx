import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { TestClassListItem } from '../../apex-test-runner-types';
import TestClassSelection, { TestClassSelectionProps } from '../TestClassSelection';

function getTestClass(classId: string, name: string, methods: string[]): TestClassListItem {
  return { classId, name, lastModifiedDate: '2026-01-01T00:00:00.000Z', methods, symbolTableUnavailable: false };
}

const testClasses: TestClassListItem[] = [
  getTestClass('01p000000000001', 'AlphaTest', ['testOne', 'testTwo']),
  getTestClass('01p000000000002', 'BravoTest', ['testA']),
  getTestClass('01p000000000003', 'CharlieTest', []),
];

function setup(overrides: Partial<TestClassSelectionProps> = {}) {
  const props: TestClassSelectionProps = {
    testClasses,
    unknownClasses: [],
    selectedClasses: new Map(),
    onToggleClass: vi.fn(),
    onToggleMethod: vi.fn(),
    onSelectAllVisible: vi.fn(),
    ...overrides,
  };
  // The main landmark mirrors the app shell so axe's region rule sees real page context
  const renderResult = render(
    <main>
      <TestClassSelection {...props} />
    </main>,
  );
  return { props, renderResult };
}

function getCheckbox(name: string) {
  return screen.getByRole('checkbox', { name });
}

/** Roving focus moves are deferred one animation frame — flush it inside act */
async function flushFrame() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
  });
}

describe('TestClassSelection keyboard navigation', () => {
  test('the class list is a single tab stop — only the first class checkbox is tabbable', () => {
    setup();

    expect(getCheckbox('AlphaTest').tabIndex).toBe(0);
    expect(getCheckbox('BravoTest').tabIndex).toBe(-1);
    expect(getCheckbox('CharlieTest').tabIndex).toBe(-1);
    // Select All is its own tab stop, outside the composite
    expect(getCheckbox('Select All').tabIndex).toBe(0);
  });

  test('expand/collapse chevrons are out of the tab order', () => {
    setup();

    const chevrons = screen.getAllByTitle('Expand methods');
    expect(chevrons.length).toBeGreaterThan(0);
    chevrons.forEach((chevron) => expect((chevron as HTMLButtonElement).tabIndex).toBe(-1));
  });

  test('ArrowDown/ArrowUp move focus between class checkboxes and update the tab stop', async () => {
    setup();
    const alpha = getCheckbox('AlphaTest');
    const bravo = getCheckbox('BravoTest');

    act(() => alpha.focus());
    fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    await flushFrame();

    expect(document.activeElement).toBe(bravo);
    expect(bravo.tabIndex).toBe(0);
    expect(alpha.tabIndex).toBe(-1);

    fireEvent.keyDown(bravo, { key: 'ArrowUp' });
    await flushFrame();
    expect(document.activeElement).toBe(alpha);
  });

  test('Home and End jump to the first and last visible checkbox', async () => {
    setup();
    const alpha = getCheckbox('AlphaTest');

    act(() => alpha.focus());
    fireEvent.keyDown(alpha, { key: 'End' });
    await flushFrame();
    expect(document.activeElement).toBe(getCheckbox('CharlieTest'));

    fireEvent.keyDown(getCheckbox('CharlieTest'), { key: 'Home' });
    await flushFrame();
    expect(document.activeElement).toBe(alpha);
  });

  test('ArrowRight expands a class, then steps into its first method; ArrowLeft reverses', async () => {
    setup();
    const alpha = getCheckbox('AlphaTest');
    act(() => alpha.focus());

    // First press expands, focus stays on the class
    fireEvent.keyDown(alpha, { key: 'ArrowRight' });
    await flushFrame();
    expect(screen.getByRole('checkbox', { name: 'testOne' })).toBeTruthy();
    expect(document.activeElement).toBe(alpha);

    // Second press steps into the first method
    fireEvent.keyDown(alpha, { key: 'ArrowRight' });
    await flushFrame();
    const methodOne = getCheckbox('testOne');
    expect(document.activeElement).toBe(methodOne);

    // ArrowLeft from a method returns to its class
    fireEvent.keyDown(methodOne, { key: 'ArrowLeft' });
    await flushFrame();
    expect(document.activeElement).toBe(alpha);

    // ArrowLeft on an expanded class collapses it
    fireEvent.keyDown(alpha, { key: 'ArrowLeft' });
    await flushFrame();
    expect(screen.queryByRole('checkbox', { name: 'testOne' })).toBeNull();
  });

  test('ArrowDown traverses through an expanded class into its methods before the next class', async () => {
    setup();
    const alpha = getCheckbox('AlphaTest');
    act(() => alpha.focus());

    fireEvent.keyDown(alpha, { key: 'ArrowRight' });
    await flushFrame();
    fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    await flushFrame();
    expect(document.activeElement).toBe(getCheckbox('testOne'));

    fireEvent.keyDown(getCheckbox('testOne'), { key: 'ArrowDown' });
    await flushFrame();
    expect(document.activeElement).toBe(getCheckbox('testTwo'));

    fireEvent.keyDown(getCheckbox('testTwo'), { key: 'ArrowDown' });
    await flushFrame();
    expect(document.activeElement).toBe(getCheckbox('BravoTest'));
  });

  test('has no axe violations', async () => {
    const { renderResult } = setup();
    const results = await axeScan(renderResult.baseElement);
    expect(results.violations).toEqual([]);
  });
});
