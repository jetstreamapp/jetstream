import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  test('renders children', () => {
    render(<Badge>My Badge</Badge>);
    expect(screen.getByText('My Badge')).toBeTruthy();
  });

  test('default type applies slds-badge class', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-badge');
  });

  test('inverse type applies slds-badge_inverse class', () => {
    const { container } = render(<Badge type="inverse">Inverse</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-badge_inverse');
  });

  test('light type applies slds-badge_lightest class', () => {
    const { container } = render(<Badge type="light">Light</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-badge_lightest');
  });

  test('success type applies slds-theme_success class', () => {
    const { container } = render(<Badge type="success">Success</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_success');
  });

  test('warning type applies slds-theme_warning class', () => {
    const { container } = render(<Badge type="warning">Warning</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_warning');
  });

  test('error type applies slds-theme_error class', () => {
    const { container } = render(<Badge type="error">Error</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-theme_error');
  });

  test('title prop is applied', () => {
    render(<Badge title="My title">Badge</Badge>);
    expect(screen.getByTitle('My title')).toBeTruthy();
  });

  test('extra className is applied', () => {
    const { container } = render(<Badge className="extra-class">Badge</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('extra-class');
  });
});
