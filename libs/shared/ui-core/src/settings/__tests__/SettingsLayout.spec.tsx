import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsLayout } from '../layout/SettingsLayout';
import { SettingsSection } from '../layout/SettingsSection';

const SECTIONS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

// jsdom has no layout, so each section's distance from the top of the scroll container is set by hand
const sectionTops: Record<string, number> = {};

function scrollTo(tops: Record<string, number>, scrollContainer: HTMLElement) {
  Object.assign(sectionTops, tops);
  fireEvent.scroll(scrollContainer);
}

function renderLayout(initialEntry = '/settings') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <div data-testid="scroll-container" style={{ overflowY: 'auto' }}>
        <SettingsLayout sections={SECTIONS}>
          {SECTIONS.map(({ id, label }) => (
            <SettingsSection key={id} id={id} title={label}>
              <p>{label} settings</p>
            </SettingsSection>
          ))}
        </SettingsLayout>
      </div>
    </MemoryRouter>,
  );
  return screen.getByTestId('scroll-container');
}

const currentNavItem = () =>
  screen.getByRole('navigation', { name: 'Settings sections' }).querySelector('[aria-current="location"]')?.textContent;

describe('SettingsLayout', () => {
  beforeEach(() => {
    Object.assign(sectionTops, { one: 0, two: 500, three: 1000 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { top: sectionTops[this.id] ?? 0 } as DOMRect;
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks the section at the top of the page as current while scrolling', async () => {
    const scrollContainer = renderLayout();
    expect(currentNavItem()).toBe('One');

    scrollTo({ one: -600, two: -100, three: 400 }, scrollContainer);
    await waitFor(() => expect(currentNavItem()).toBe('Two'));
  });

  it('scrolls to and focuses a section picked from the navigation', () => {
    renderLayout();
    fireEvent.click(screen.getByRole('link', { name: 'Three' }));

    expect(currentNavItem()).toBe('Three');
    expect(document.getElementById('three')?.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('three');
  });

  it('keeps a picked section current while the page scrolls to it', async () => {
    const scrollContainer = renderLayout();
    fireEvent.click(screen.getByRole('link', { name: 'Three' }));

    // The last section is too short to reach the top, so position alone would say "Two"
    scrollTo({ one: -800, two: -300, three: 200 }, scrollContainer);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(currentNavItem()).toBe('Three');
  });

  it('follows the scroll position again once the user scrolls, including by dragging the scroll bar', async () => {
    const scrollContainer = renderLayout();
    fireEvent.click(screen.getByRole('link', { name: 'Three' }));

    fireEvent.pointerDown(scrollContainer);
    scrollTo({ one: 0, two: 500, three: 1000 }, scrollContainer);
    await waitFor(() => expect(currentNavItem()).toBe('One'));
  });

  it('opens at the section named in the URL hash', async () => {
    const scrollContainer = renderLayout('/settings#two');
    expect(document.activeElement?.id).toBe('two');
    expect(document.getElementById('two')?.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

    scrollTo({ one: -500, two: 0, three: 500 }, scrollContainer);
    await waitFor(() => expect(currentNavItem()).toBe('Two'));
  });
});
