vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return { fromAppState: { appInfoState: atom({ version: 'test' }) } };
});

import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserFeedbackWidget } from '../UserFeedbackWidget';

describe('UserFeedbackWidget position menu', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('opens from the keyboard with focus on the first option, and hands focus back after a choice', async () => {
    const { baseElement } = render(<UserFeedbackWidget />);
    const feedbackButton = screen.getByRole('button', { name: 'Send Feedback' });
    feedbackButton.focus();

    fireEvent.keyDown(feedbackButton, { key: 'F10', shiftKey: true });

    const menu = screen.getByRole('menu', { name: 'Widget position options' });
    const [firstOption, secondOption] = screen.getAllByRole('menuitemradio');
    await waitFor(() => expect(document.activeElement).toBe(firstOption));
    await axeScan(baseElement);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(secondOption);
    fireEvent.click(secondOption);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(feedbackButton);
  });
});
