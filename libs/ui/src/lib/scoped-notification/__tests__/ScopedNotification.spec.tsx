import { fireEvent, render, screen } from '@testing-library/react';
import { ScopedNotification } from '../ScopedNotification';

describe('ScopedNotification', () => {
  test('renders children in media body', () => {
    render(<ScopedNotification theme="info">Notification content</ScopedNotification>);
    expect(screen.getByText('Notification content')).toBeTruthy();
  });

  test('light theme applies slds-scoped-notification_light', () => {
    const { container } = render(<ScopedNotification theme="light">Message</ScopedNotification>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-scoped-notification_light');
  });

  test('dark theme applies slds-scoped-notification_dark', () => {
    const { container } = render(<ScopedNotification theme="dark">Message</ScopedNotification>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-scoped-notification_dark');
  });

  test('info theme applies slds-theme_info', () => {
    const { container } = render(<ScopedNotification theme="info">Message</ScopedNotification>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_info');
  });

  test('success theme applies slds-theme_success', () => {
    const { container } = render(<ScopedNotification theme="success">Message</ScopedNotification>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_success');
  });

  test('warning theme applies slds-theme_warning', () => {
    const { container } = render(<ScopedNotification theme="warning">Message</ScopedNotification>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_warning');
  });

  test('error theme applies slds-theme_error', () => {
    const { container } = render(<ScopedNotification theme="error">Message</ScopedNotification>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_error');
  });

  test('custom className is applied', () => {
    const { container } = render(
      <ScopedNotification theme="info" className="my-notification-class">
        Message
      </ScopedNotification>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('my-notification-class');
  });

  test('custom icon renders when provided', () => {
    render(
      <ScopedNotification theme="info" icon={<span data-testid="custom-icon">★</span>}>
        Message
      </ScopedNotification>,
    );
    expect(screen.getByTestId('custom-icon')).toBeTruthy();
  });

  test('no close button rendered by default', () => {
    render(<ScopedNotification theme="info">Message</ScopedNotification>);
    expect(screen.queryByTitle('Close')).toBeNull();
  });

  test('allowClose renders a close button that dismisses the notification', () => {
    render(
      <ScopedNotification theme="info" allowClose>
        Message
      </ScopedNotification>,
    );
    expect(screen.getByText('Message')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Close'));
    expect(screen.queryByText('Message')).toBeNull();
  });

  test('onClose is invoked when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ScopedNotification theme="info" allowClose onClose={onClose}>
        Message
      </ScopedNotification>,
    );
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
