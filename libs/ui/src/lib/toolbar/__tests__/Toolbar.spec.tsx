import { render, screen } from '@testing-library/react';
import { Toolbar } from '../Toolbar';
import { ToolbarItemActions } from '../ToolbarItemActions';
import { ToolbarItemGroup } from '../ToolbarItemGroup';

describe('Toolbar', () => {
  test('renders children', () => {
    render(<Toolbar>Toolbar Content</Toolbar>);
    expect(screen.getByText('Toolbar Content')).toBeTruthy();
  });

  test('has role=toolbar', () => {
    render(<Toolbar>Content</Toolbar>);
    expect(screen.getByRole('toolbar')).toBeTruthy();
  });

  test('applies slds-builder-toolbar class', () => {
    const { container } = render(<Toolbar>Content</Toolbar>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-builder-toolbar');
  });
});

describe('ToolbarItemGroup', () => {
  test('renders children', () => {
    render(<ToolbarItemGroup>Group Content</ToolbarItemGroup>);
    expect(screen.getByText('Group Content')).toBeTruthy();
  });

  test('applies slds-builder-toolbar__item-group class', () => {
    const { container } = render(<ToolbarItemGroup>Content</ToolbarItemGroup>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-builder-toolbar__item-group');
  });
});

describe('ToolbarItemActions', () => {
  test('renders children', () => {
    render(<ToolbarItemActions>Actions Content</ToolbarItemActions>);
    expect(screen.getByText('Actions Content')).toBeTruthy();
  });

  test('applies slds-builder-toolbar__actions class', () => {
    const { container } = render(<ToolbarItemActions>Content</ToolbarItemActions>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-builder-toolbar__actions');
  });

  test('has aria-label="Actions"', () => {
    const { container } = render(<ToolbarItemActions>Content</ToolbarItemActions>);
    expect((container.firstChild as HTMLElement).getAttribute('aria-label')).toBe('Actions');
  });
});
