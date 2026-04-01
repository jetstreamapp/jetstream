import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmationDialog from '../ConfirmationDialog';

describe('ConfirmationDialog', () => {
  test('renders nothing when isOpen=false', () => {
    const { container } = render(<ConfirmationDialog isOpen={false} onConfirm={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  test('renders modal content when isOpen=true', () => {
    render(
      <ConfirmationDialog isOpen onConfirm={vi.fn()}>
        Dialog body text
      </ConfirmationDialog>,
    );

    expect(screen.getByText('Dialog body text')).toBeTruthy();
  });

  test('shows default header "Confirm Action" when no header is provided', () => {
    render(<ConfirmationDialog isOpen onConfirm={vi.fn()} />);

    expect(screen.getByText('Confirm Action')).toBeTruthy();
  });

  test('shows custom header text', () => {
    render(<ConfirmationDialog isOpen header="Delete Record?" onConfirm={vi.fn()} />);

    expect(screen.getByText('Delete Record?')).toBeTruthy();
  });

  test('shows cancel and confirm buttons with default text', () => {
    render(<ConfirmationDialog isOpen onConfirm={vi.fn()} />);

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  test('calls onCancel when Cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(<ConfirmationDialog isOpen onCancel={handleCancel} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(handleCancel).toHaveBeenCalledOnce();
  });

  test('calls onConfirm when Confirm button is clicked', () => {
    const handleConfirm = vi.fn();
    render(<ConfirmationDialog isOpen onConfirm={handleConfirm} />);

    fireEvent.click(screen.getByText('Confirm'));

    expect(handleConfirm).toHaveBeenCalledOnce();
  });

  test('confirm button is disabled when submitDisabled=true', () => {
    render(<ConfirmationDialog isOpen submitDisabled onConfirm={vi.fn()} />);

    const confirmButton = screen.getByText('Confirm');
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
  });

  test('renders custom cancelText and confirmText', () => {
    render(<ConfirmationDialog isOpen cancelText="No Thanks" confirmText="Yes, Delete" onConfirm={vi.fn()} />);

    expect(screen.getByText('No Thanks')).toBeTruthy();
    expect(screen.getByText('Yes, Delete')).toBeTruthy();
  });
});
