import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { focusContainer } from '../../utils/focus-container';
import { Panel } from '../Panel';

function PanelHarness({ openerFocusesOnClick = true, focusOnOpen }: { openerFocusesOnClick?: boolean; focusOnOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button
        ref={openerRef}
        // Safari does not focus a button on mouse click; the harness simulates that by blurring
        onMouseDown={(event) => !openerFocusesOnClick && event.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        Open drawer
      </button>
      <Panel
        heading="Details"
        isOpen={isOpen}
        fullHeight={false}
        returnFocusTo={openerRef}
        focusOnOpen={focusOnOpen}
        onClosed={() => setIsOpen(false)}
      >
        <input aria-label="Name" />
        <input type="search" aria-label="Filter" />
      </Panel>
    </div>
  );
}

describe('Panel', () => {
  it('moves focus into the panel on open and back to the element that was focused when it closes', async () => {
    const { baseElement } = render(<PanelHarness />);
    const opener = screen.getByRole('button', { name: 'Open drawer' });
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Details' }));
    await axeScan(baseElement);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Details' }));
    expect(document.activeElement).toBe(opener);
  });

  it('leaves focus where it is when opened with focusOnOpen false, and does not keep the region focusable', () => {
    render(<PanelHarness focusOnOpen={false} />);
    const opener = screen.getByRole('button', { name: 'Open drawer' });
    opener.focus();
    fireEvent.click(opener);

    const region = screen.getByRole('region', { name: 'Details' });
    expect(document.activeElement).toBe(opener);
    expect(region.hasAttribute('tabindex')).toBe(false);
  });

  it('hands focus back to a landmark that was focused when it opened (after a route change)', () => {
    const { container } = render(
      <main>
        <PanelHarness />
      </main>,
    );
    const main = container.querySelector('main') as HTMLElement;
    focusContainer(main);
    // A keyboard shortcut opens the drawer while focus is still on the landmark
    fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Details' }));

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Details' }));

    expect(document.activeElement).toBe(main);
  });

  it('closes on Escape after a click inside that left focus on the page (Safari, or a click on text)', () => {
    render(<PanelHarness />);
    const opener = screen.getByRole('button', { name: 'Open drawer' });
    opener.focus();
    fireEvent.click(opener);

    fireEvent.pointerDown(screen.getByRole('region', { name: 'Details' }));
    // A browser drops focus to <body> here; jsdom will not blur an element that just lost its tabindex
    opener.focus();
    opener.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
  });

  it('still closes on Escape after that click re-renders the host with a new onClosed', () => {
    function RerenderingHost() {
      const [isOpen, setIsOpen] = useState(true);
      const [runCount, setRunCount] = useState(0);
      return (
        <Panel heading="Details" isOpen={isOpen} fullHeight={false} onClosed={() => setIsOpen(false)}>
          <button type="button" onClick={() => setRunCount(runCount + 1)}>
            Run {runCount}
          </button>
        </Panel>
      );
    }
    render(<RerenderingHost />);
    const runButton = screen.getByRole('button', { name: 'Run 0' });

    // Safari: the click does not focus the button, so focus ends on <body> while the host re-renders. jsdom
    // will not blur the region once the press released its tabindex, so park focus on an input and remove it
    fireEvent.pointerDown(runButton);
    const focusPark = document.createElement('input');
    document.body.appendChild(focusPark);
    focusPark.focus();
    focusPark.remove();
    fireEvent.click(runButton);
    expect(screen.getByRole('button', { name: 'Run 1' })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
  });

  it('falls back to returnFocusTo when nothing was focused at open time', () => {
    render(<PanelHarness openerFocusesOnClick={false} />);
    const opener = screen.getByRole('button', { name: 'Open drawer' });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(opener);
    expect(screen.getByRole('region', { name: 'Details' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Details' }));
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape pressed inside the panel and returns focus', () => {
    render(<PanelHarness />);
    const opener = screen.getByRole('button', { name: 'Open drawer' });
    opener.focus();
    fireEvent.click(opener);

    const nameInput = screen.getByRole('textbox', { name: 'Name' });
    nameInput.focus();
    fireEvent.keyDown(nameInput, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // A search box clears itself on Escape. Closing instead threw away the filter along with whatever the
  // panel held unconfirmed (the deploy side panel's selections)
  it('leaves the first Escape to a search box that has text, and closes on the next', () => {
    render(<PanelHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }));

    const filter = screen.getByRole('searchbox', { name: 'Filter' });
    filter.focus();
    fireEvent.change(filter, { target: { value: 'Apex' } });
    const wasNotPrevented = fireEvent.keyDown(filter, { key: 'Escape' });

    expect(wasNotPrevented).toBe(true);
    expect(screen.getByRole('region', { name: 'Details' })).toBeTruthy();

    fireEvent.change(filter, { target: { value: '' } });
    fireEvent.keyDown(filter, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
  });
});
