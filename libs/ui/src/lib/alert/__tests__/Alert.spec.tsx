import { fireEvent, render, screen } from '@testing-library/react';
import { Alert } from '../Alert';

describe('Alert', () => {
  test('applies slds-theme_info class for info type', () => {
    const { container } = render(<Alert type="info">Info message</Alert>);
    expect(container.firstChild).toHaveProperty('className');
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_info');
  });

  test('applies slds-theme_warning class for warning type', () => {
    const { container } = render(<Alert type="warning">Warning message</Alert>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_warning');
  });

  test('applies slds-theme_error class for error type', () => {
    const { container } = render(<Alert type="error">Error message</Alert>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_error');
  });

  test('renders children content', () => {
    render(<Alert type="info">Hello world</Alert>);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  test('shows close button when allowClose is true', () => {
    render(<Alert type="info" allowClose onClose={() => {}}>Message</Alert>);
    expect(screen.getByTitle('Close')).toBeTruthy();
  });

  test('does not show close button when allowClose is false', () => {
    render(<Alert type="info" allowClose={false}>Message</Alert>);
    expect(screen.queryByTitle('Close')).toBeNull();
  });

  test('does not show close button when allowClose is not provided', () => {
    render(<Alert type="info">Message</Alert>);
    expect(screen.queryByTitle('Close')).toBeNull();
  });

  test('calls onClose callback when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Alert type="info" allowClose onClose={onClose}>Message</Alert>);
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('applies custom className', () => {
    const { container } = render(<Alert type="info" className="my-custom-class">Message</Alert>);
    expect((container.firstChild as HTMLElement).className).toContain('my-custom-class');
  });
});
