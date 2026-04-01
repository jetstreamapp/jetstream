import { render, screen } from '@testing-library/react';
import { ProgressRing } from '../ProgressRing';

describe('ProgressRing', () => {
  test('renders with role="progressbar"', () => {
    render(<ProgressRing fillPercent={0.5} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  test('aria-valuenow is 25 when fillPercent is 0.25', () => {
    render(<ProgressRing fillPercent={0.25} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  test('aria-valuenow is 0 when fillPercent is 0', () => {
    render(<ProgressRing fillPercent={0} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  test('aria-valuenow is 100 when fillPercent is 1.0', () => {
    render(<ProgressRing fillPercent={1.0} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  test('clamps fillPercent > 1 to 100 for aria-valuenow', () => {
    render(<ProgressRing fillPercent={1.5} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  test('clamps fillPercent < 0 to 0 for aria-valuenow', () => {
    render(<ProgressRing fillPercent={-0.5} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  test('renders children', () => {
    render(<ProgressRing fillPercent={0.5}>Ring label</ProgressRing>);
    expect(screen.getByText('Ring label')).toBeTruthy();
  });

  test('applies slds-progress-ring_complete theme class', () => {
    const { container } = render(<ProgressRing fillPercent={1} theme="complete" />);
    expect((container.firstChild as HTMLElement).className).toContain('slds-progress-ring_complete');
  });

  test('applies slds-progress-ring_warning theme class', () => {
    const { container } = render(<ProgressRing fillPercent={0.5} theme="warning" />);
    expect((container.firstChild as HTMLElement).className).toContain('slds-progress-ring_warning');
  });

  test('applies custom className', () => {
    const { container } = render(<ProgressRing fillPercent={0.5} className="my-ring-class" />);
    expect((container.firstChild as HTMLElement).className).toContain('my-ring-class');
  });
});
