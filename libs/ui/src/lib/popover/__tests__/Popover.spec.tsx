// Mock the app state module to prevent HTTP requests during module initialization.
// The Popover imports Tooltip from the ui barrel index which transitively loads
// NotSeeingRecentMetadataPopover and UserFeedbackWidget, both of which import from
// @jetstream/ui/app-state. That module calls fetchUserProfile() at init time, which
// fails in the test environment and causes an unhandled rejection.
vi.mock('@jetstream/ui/app-state', () => ({
  fromAppState: {},
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Popover } from '../Popover';

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
});
