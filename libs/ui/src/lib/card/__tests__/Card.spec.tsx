import { render, screen } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  test('renders children in body', () => {
    render(<Card>Body content</Card>);
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  test('renders title when provided', () => {
    render(<Card title="My Card Title">Content</Card>);
    expect(screen.getByText('My Card Title')).toBeTruthy();
  });

  test('does not render header when title is not provided', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.querySelector('.slds-card__header')).toBeNull();
  });

  test('renders footer when provided', () => {
    render(<Card footer={<span>Footer text</span>}>Content</Card>);
    expect(screen.getByText('Footer text')).toBeTruthy();
  });

  test('applies slds-card_boundary when nestedBorder is true', () => {
    const { container } = render(<Card nestedBorder>Content</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-card_boundary');
  });

  test('does not apply slds-card_boundary when nestedBorder is false', () => {
    const { container } = render(<Card nestedBorder={false}>Content</Card>);
    expect((container.firstChild as HTMLElement).className).not.toContain('slds-card_boundary');
  });

  test('applies custom className', () => {
    const { container } = render(<Card className="my-card-class">Content</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('my-card-class');
  });

  test('testId is applied as data-testid', () => {
    render(<Card testId="card-test-id">Content</Card>);
    expect(screen.getByTestId('card-test-id')).toBeTruthy();
  });

  test('renders actions when title and actions are provided', () => {
    render(<Card title="Card" actions={<button>Action</button>}>Content</Card>);
    expect(screen.getByText('Action')).toBeTruthy();
  });
});
