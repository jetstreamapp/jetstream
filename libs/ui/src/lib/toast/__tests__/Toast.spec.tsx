import { fireEvent, render, screen } from '@testing-library/react';
import { Toast } from '../Toast';

describe('Toast', () => {
  test('renders with role="status"', () => {
    render(<Toast>Message</Toast>);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  test('applies slds-theme_info by default', () => {
    render(<Toast>Message</Toast>);
    expect(screen.getByRole('status').className).toContain('slds-theme_info');
  });

  test('applies slds-theme_success for success type', () => {
    render(<Toast type="success">Message</Toast>);
    expect(screen.getByRole('status').className).toContain('slds-theme_success');
  });

  test('applies slds-theme_warning for warning type', () => {
    render(<Toast type="warning">Message</Toast>);
    expect(screen.getByRole('status').className).toContain('slds-theme_warning');
  });

  test('applies slds-theme_error for error type', () => {
    render(<Toast type="error">Message</Toast>);
    expect(screen.getByRole('status').className).toContain('slds-theme_error');
  });

  test('renders children content', () => {
    render(<Toast>Toast message content</Toast>);
    expect(screen.getByText('Toast message content')).toBeTruthy();
  });

  test('shows close button when onClose is provided', () => {
    render(<Toast onClose={() => {}}>Message</Toast>);
    expect(screen.getByTitle('Close')).toBeTruthy();
  });

  test('does not show close button when onClose is not provided', () => {
    render(<Toast>Message</Toast>);
    expect(screen.queryByTitle('Close')).toBeNull();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Toast onClose={onClose}>Message</Toast>);
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
