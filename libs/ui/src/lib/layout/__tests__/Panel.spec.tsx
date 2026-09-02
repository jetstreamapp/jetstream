import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Panel } from '../Panel';

function PanelHarness({ openerFocusesOnClick = true }: { openerFocusesOnClick?: boolean }) {
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
      <Panel heading="Details" isOpen={isOpen} fullHeight={false} returnFocusTo={openerRef} onClosed={() => setIsOpen(false)}>
        <input aria-label="Name" />
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
});
