// Mock the app state module to prevent HTTP requests during module initialization.
// The Popover imports Tooltip from the ui barrel index which transitively loads
// NotSeeingRecentMetadataPopover and UserFeedbackWidget, both of which import from
// @jetstream/ui/app-state. That module calls fetchUserProfile() at init time, which
// fails in the test environment and causes an unhandled rejection.
vi.mock('@jetstream/ui/app-state', () => ({
  fromAppState: {},
}));

import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Fragment, useState } from 'react';
import Modal from '../../modal/Modal';
import { Popover } from '../Popover';

/** A popover living inside a modal — the Escape ownership case the layer hook exists for. */
function PopoverInModalHarness() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  return (
    <Fragment>
      {isModalOpen && (
        <Modal header="Host modal" onClose={() => setIsModalOpen(false)}>
          <Popover header={<h2>Popover title</h2>} content={<span>Popover body</span>}>
            Open Popover
          </Popover>
        </Modal>
      )}
    </Fragment>
  );
}

/** A full press: keydown then keyup, the way a Modal (which closes on keyup) would experience it. */
function pressEscape(target: Element) {
  fireEvent.keyDown(target, { key: 'Escape' });
  fireEvent.keyUp(target, { key: 'Escape' });
}

async function openPopover(triggerName = 'Open Popover') {
  const trigger = screen.getByRole('button', { name: triggerName });
  trigger.focus();
  await act(async () => {
    fireEvent.click(trigger);
  });
  // The popover's own close button ("Close dialog") is unique to it — a hosting Modal's is titled "Close"
  await waitFor(() => {
    expect(screen.getByTitle('Close dialog')).toBeTruthy();
  });
  return trigger;
}

describe('Popover', () => {
  test('renders the trigger children', () => {
    render(<Popover content={<span>Popover body</span>}>Open Popover</Popover>);

    expect(screen.getByText('Open Popover')).toBeTruthy();
  });

  test('popover content is not visible when closed', () => {
    render(<Popover content={<span>Popover body</span>}>Open Popover</Popover>);

    expect(screen.queryByText('Popover body')).toBeNull();
  });

  test('clicking the trigger opens the popover', async () => {
    render(<Popover content={<span>Popover body</span>}>Open Popover</Popover>);

    const triggerButton = screen.getByText('Open Popover');
    await act(async () => {
      fireEvent.click(triggerButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Popover body')).toBeTruthy();
    });
  });

  test('clicking the close dialog button closes the popover', async () => {
    render(<Popover content={<span>Popover body</span>}>Open Popover</Popover>);

    const triggerButton = screen.getByText('Open Popover');
    await act(async () => {
      fireEvent.click(triggerButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Popover body')).toBeTruthy();
    });

    const closeButton = screen.getByTitle('Close dialog');
    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Popover body')).toBeNull();
    });
  });

  test('onChange is called with true when opened', async () => {
    const handleChange = vi.fn();
    render(
      <Popover content={<span>Popover body</span>} onChange={handleChange}>
        Open Popover
      </Popover>,
    );

    const triggerButton = screen.getByText('Open Popover');
    await act(async () => {
      fireEvent.click(triggerButton);
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  test('popover content is hidden after clicking the close button', async () => {
    render(<Popover content={<span>Popover body</span>}>Open Popover</Popover>);

    await act(async () => {
      fireEvent.click(screen.getByText('Open Popover'));
    });

    await waitFor(() => {
      expect(screen.getByText('Popover body')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle('Close dialog'));
    });

    await waitFor(() => {
      expect(screen.queryByText('Popover body')).toBeNull();
    });
  });

  test('has no axe violations while open', async () => {
    const { baseElement } = render(
      <Popover header={<h2>Popover title</h2>} content={<span>Popover body</span>}>
        Open Popover
      </Popover>,
    );
    await openPopover();

    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });

  test('names the dialog from its header via aria-labelledby', async () => {
    render(
      <Popover header={<h2>Popover title</h2>} content={<span>Popover body</span>}>
        Open Popover
      </Popover>,
    );
    await openPopover();

    const dialog = screen.getByRole('dialog', { name: 'Popover title' });
    const headerContainer = screen.getByText('Popover title').parentElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe(headerContainer?.id);
    expect(headerContainer?.id).toBeTruthy();
  });

  test('leaves aria-labelledby off when there is no header so panelProps aria-label can name it', async () => {
    render(
      <Popover content={<span>Popover body</span>} panelProps={{ 'aria-label': 'Filters' }}>
        Open Popover
      </Popover>,
    );
    await openPopover();

    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('returns focus to the trigger when closed with the close button', async () => {
    render(<Popover content={<span>Popover body</span>}>Open Popover</Popover>);
    const trigger = await openPopover();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTitle('Close dialog')));

    await act(async () => {
      fireEvent.click(screen.getByTitle('Close dialog'));
    });

    await waitFor(() => expect(screen.queryByText('Popover body')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test('closes on Escape and returns focus to the trigger', async () => {
    const handleChange = vi.fn();
    render(
      <Popover content={<span>Popover body</span>} onChange={handleChange}>
        Open Popover
      </Popover>,
    );
    const trigger = await openPopover();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTitle('Close dialog')));

    pressEscape(screen.getByTitle('Close dialog'));

    await waitFor(() => expect(screen.queryByText('Popover body')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(handleChange).toHaveBeenLastCalledWith(false);
  });

  test('trapFocus keeps Tab cycling inside the popover', async () => {
    render(
      <Fragment>
        <Popover
          trapFocus
          content={
            <Fragment>
              <button type="button">First</button>
              <button type="button">Second</button>
            </Fragment>
          }
        >
          Open Popover
        </Popover>
        <button type="button">Outside</button>
      </Fragment>,
    );
    await openPopover();
    const dialog = screen.getByRole('dialog');
    const closeButton = screen.getByTitle('Close dialog');
    const firstButton = screen.getByRole('button', { name: 'First' });
    const secondButton = screen.getByRole('button', { name: 'Second' });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(firstButton));

    userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(secondButton));

    // Past the last tabbable: focus wraps to the first one instead of leaving the popover
    userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    // And backwards from the first tabbable wraps to the last one
    userEvent.tab({ shift: true });
    await waitFor(() => expect(document.activeElement).toBe(secondButton));

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test('without trapFocus, Tab past the last element leaves the popover and closes it', async () => {
    render(
      <Fragment>
        <Popover content={<button type="button">Only</button>}>Open Popover</Popover>
        <button type="button">Outside</button>
      </Fragment>,
    );
    await openPopover();
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTitle('Close dialog')));

    userEvent.tab();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Only' })));

    userEvent.tab();

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('Escape inside a popover hosted by a Modal closes only the popover; the next Escape closes the modal', async () => {
    render(<PopoverInModalHarness />);
    expect(screen.getByRole('dialog', { name: 'Host modal' })).toBeTruthy();
    await openPopover();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTitle('Close dialog')));

    pressEscape(screen.getByTitle('Close dialog'));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Popover title' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Host modal' })).toBeTruthy();

    pressEscape(screen.getByRole('button', { name: 'Open Popover' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Host modal' })).toBeNull());
  });
});
