import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsLayout } from '../layout/SettingsLayout';
import { SettingsGroup, SettingsRow, SettingsSection } from '../layout/SettingsSection';

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

describe('SettingsLayout search', () => {
  const SEARCH_SECTIONS = [
    { id: 'general', label: 'General' },
    { id: 'query', label: 'Query' },
    { id: 'privacy', label: 'Privacy' },
  ];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  function renderSearchLayout() {
    render(
      <MemoryRouter>
        <div style={{ overflowY: 'auto' }}>
          <SettingsLayout sections={SEARCH_SECTIONS}>
            <SettingsSection id="general" title="General">
              <SettingsGroup>
                <SettingsRow id="theme" title="Theme" description="Choose light or dark." keywords={['appearance']} />
                <SettingsRow id="auto-login" title="Log in automatically" />
                <SettingsRow id="updates" title="Updates" details={<p>Managed by your organization</p>}>
                  <button>Check Now</button>
                </SettingsRow>
                <SettingsRow
                  id="download"
                  title="Download location"
                  description={
                    <>
                      Files are saved <strong>without asking</strong>
                    </>
                  }
                />
              </SettingsGroup>
            </SettingsSection>
            <SettingsSection id="query" title="Query">
              <SettingsGroup title="SOQL formatting">
                <SettingsRow id="indent" title="Indent size" description="Number of tabs." />
                <SettingsRow id="line-length" title="Max characters per line" />
              </SettingsGroup>
            </SettingsSection>
            <SettingsSection id="privacy" title="Privacy" keywords={['cookies']}>
              <SettingsGroup searchText={[<button key="export">Export Data</button>]}>
                <p>Custom content</p>
              </SettingsGroup>
            </SettingsSection>
          </SettingsLayout>
        </div>
      </MemoryRouter>,
    );
  }

  const searchInput = () => screen.getByRole('searchbox', { name: 'Search settings' });
  const search = (value: string) => fireEvent.change(searchInput(), { target: { value } });
  const isShown = (text: string) => !screen.getByText(text, { ignore: 'mark' }).closest('[hidden]');
  const navItems = () =>
    Array.from(screen.getByRole('navigation', { name: 'Settings sections' }).querySelectorAll('a')).map(({ textContent }) => textContent);

  function getRowTitle(id: string) {
    return document.getElementById(`${id}-title`) as HTMLElement;
  }

  it('shows only the settings that match, and the sections that hold them', () => {
    renderSearchLayout();
    search('indent');

    expect(getRowTitle('indent').closest('[hidden]')).toBeNull();
    expect(getRowTitle('line-length').closest('[hidden]')).not.toBeNull();
    expect(getRowTitle('theme').closest('[hidden]')).not.toBeNull();
    expect(document.getElementById('general')).toHaveProperty('hidden', true);
    expect(document.getElementById('privacy')).toHaveProperty('hidden', true);
    expect(navItems()).toEqual(['Query']);
  });

  it('requires every word to match, counting the group and section headings above a setting', () => {
    renderSearchLayout();
    search('query  CHARACTERS');

    expect(getRowTitle('line-length').closest('[hidden]')).toBeNull();
    expect(getRowTitle('indent').closest('[hidden]')).not.toBeNull();

    search('soql tabs');
    expect(getRowTitle('indent').closest('[hidden]')).toBeNull();
    expect(getRowTitle('line-length').closest('[hidden]')).not.toBeNull();
  });

  it('shows everything in a section whose title matches', () => {
    renderSearchLayout();
    search('general');

    expect(getRowTitle('theme').closest('[hidden]')).toBeNull();
    expect(getRowTitle('auto-login').closest('[hidden]')).toBeNull();
    expect(navItems()).toEqual(['General']);
  });

  it('matches keywords and the descriptions of settings', () => {
    renderSearchLayout();
    search('appearance');
    expect(navItems()).toEqual(['General']);
    expect(getRowTitle('theme').closest('[hidden]')).toBeNull();

    search('cookies');
    expect(navItems()).toEqual(['Privacy']);
    expect(isShown('Custom content')).toBe(true);

    search('dark');
    expect(getRowTitle('theme').closest('[hidden]')).toBeNull();
    expect(getRowTitle('auto-login').closest('[hidden]')).not.toBeNull();
  });

  it('searches the text of rich descriptions', () => {
    renderSearchLayout();
    search('"saved without asking"');

    expect(getRowTitle('download').closest('[hidden]')).toBeNull();
    expect(getRowTitle('theme').closest('[hidden]')).not.toBeNull();

    // Highlighting works within each piece of text, so a phrase that spans elements matches without being marked
    search('asking');
    expect(document.querySelector('#download-description strong mark')?.textContent).toBe('asking');
  });

  it('matches the text of row details and controls, and extra group text, without highlighting it', () => {
    renderSearchLayout();
    search('organization');
    expect(getRowTitle('updates').closest('[hidden]')).toBeNull();
    expect(getRowTitle('theme').closest('[hidden]')).not.toBeNull();

    search('check now');
    expect(getRowTitle('updates').closest('[hidden]')).toBeNull();
    expect(document.querySelectorAll('mark')).toHaveLength(0);

    search('export');
    expect(navItems()).toEqual(['Privacy']);
    expect(isShown('Custom content')).toBe(true);
  });

  it('highlights the matching words', () => {
    renderSearchLayout();
    search('tabs indent');

    const marks = Array.from(document.querySelectorAll('mark')).map(({ textContent }) => textContent);
    expect(marks).toEqual(['Indent', 'tabs']);
    expect(getRowTitle('indent').textContent).toBe('Indent size');
  });

  it('says when nothing matches and clears the search from there', () => {
    renderSearchLayout();
    search('nothing here');

    expect(screen.getByRole('status').textContent).toContain('No settings match “nothing here”');
    expect(navItems()).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(searchInput()).toHaveProperty('value', '');
    expect(document.activeElement).toBe(searchInput());
    expect(navItems()).toEqual(['General', 'Query', 'Privacy']);
    expect(document.querySelectorAll('[hidden]')).toHaveLength(0);
  });

  it('clears the search on Escape without letting the key reach the page', () => {
    const pageKeyDown = vi.fn();
    window.addEventListener('keydown', pageKeyDown);
    renderSearchLayout();
    search('indent');

    fireEvent.keyDown(searchInput(), { key: 'Escape' });
    expect(searchInput()).toHaveProperty('value', '');
    expect(pageKeyDown).not.toHaveBeenCalled();

    // With nothing to clear, Escape is left to the page
    fireEvent.keyDown(searchInput(), { key: 'Escape' });
    expect(pageKeyDown).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', pageKeyDown);
  });
});
