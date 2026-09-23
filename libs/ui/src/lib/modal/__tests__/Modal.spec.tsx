import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Fragment, useRef, useState } from 'react';
import Modal from '../Modal';

function renderModal() {
  return render(
    <Modal
      header="This is the modal header"
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral">Cancel</button>
          <button className="slds-button slds-button_brand">Save</button>
        </Fragment>
      }
      directionalFooter={false}
      onClose={() => {
        // do nothing
      }}
    >
      Test Content
    </Modal>,
  );
}

function OpenerHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  return (
    <Fragment>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      {isOpen && (
        <Modal header="Edit" initialFocus={nameInputRef} onClose={() => setIsOpen(false)}>
          <label htmlFor="name">Name</label>
          <input id="name" ref={nameInputRef} />
        </Modal>
      )}
    </Fragment>
  );
}

function AutoFocusOpenerHarness() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Fragment>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      {isOpen && (
        <Modal header="Edit" onClose={() => setIsOpen(false)}>
          <label htmlFor="name">Name</label>
          <input id="name" autoFocus />
        </Modal>
      )}
    </Fragment>
  );
}

describe('Modal', () => {
  it('should render successfully', () => {
    const { baseElement } = renderModal();
    expect(baseElement).toBeTruthy();
  });

  it('should have no axe violations', async () => {
    const { baseElement } = renderModal();
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });

  it('should focus the initialFocus element on open and return focus to the opener on close', async () => {
    render(<OpenerHarness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();

    fireEvent.click(opener);
    const nameInput = await screen.findByLabelText('Name');
    await waitFor(() => expect(document.activeElement).toBe(nameInput));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('returns focus to the opener even when a child autofocuses itself', async () => {
    render(<AutoFocusOpenerHarness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();

    fireEvent.click(opener);
    const nameInput = await screen.findByLabelText('Name');
    await waitFor(() => expect(document.activeElement).toBe(nameInput));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('leaves an Escape to a widget inside that handled its keydown (a code editor closing its autocomplete)', () => {
    const onClose = vi.fn();
    render(
      <Modal header="Edit query" onClose={onClose}>
        <textarea
          aria-label="SOQL"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
            }
          }}
        />
      </Modal>,
    );
    const editor = screen.getByRole('textbox', { name: 'SOQL' });

    fireEvent.keyDown(editor, { key: 'Escape' });
    fireEvent.keyUp(editor, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays open when Escape cancels an IME conversion', () => {
    const onClose = vi.fn();
    render(
      <Modal header="Edit query" onClose={onClose}>
        <input aria-label="Name" />
      </Modal>,
    );
    const nameInput = screen.getByRole('textbox', { name: 'Name' });

    // Chromium and Firefox: the Escape arrives while the composition is still open
    fireEvent.compositionStart(nameInput);
    fireEvent.keyDown(nameInput, { key: 'Escape', isComposing: true });
    fireEvent.keyUp(nameInput, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on an Escape the modal saw from start to finish', () => {
    const onClose = vi.fn();
    render(
      <Modal header="Edit query" onClose={onClose}>
        <input aria-label="Name" />
      </Modal>,
    );
    const nameInput = screen.getByRole('textbox', { name: 'Name' });

    fireEvent.keyDown(nameInput, { key: 'Escape' });
    fireEvent.keyUp(nameInput, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
