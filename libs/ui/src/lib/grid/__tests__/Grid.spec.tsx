import { render, screen } from '@testing-library/react';
import { Grid } from '../Grid';
import { GridCol } from '../GridCol';

describe('Grid', () => {
  test('renders children', () => {
    render(<Grid>Grid Content</Grid>);
    expect(screen.getByText('Grid Content')).toBeTruthy();
  });

  test('always applies slds-grid class', () => {
    const { container } = render(<Grid>Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-grid');
  });

  test('applies slds-wrap when wrap=true', () => {
    const { container } = render(<Grid wrap>Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-wrap');
  });

  test('applies slds-nowrap when noWrap=true', () => {
    const { container } = render(<Grid noWrap>Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-nowrap');
  });

  test('applies slds-grid_vertical when vertical=true', () => {
    const { container } = render(<Grid vertical>Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-grid_vertical');
  });

  test('applies slds-gutters when gutters=true', () => {
    const { container } = render(<Grid gutters>Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-gutters');
  });

  test('applies alignment class when align is provided', () => {
    const { container } = render(<Grid align="center">Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-grid_align-center');
  });

  test('applies vertical alignment class when verticalAlign is provided', () => {
    const { container } = render(<Grid verticalAlign="center">Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-grid_vertical-align-center');
  });

  test('applies slds-has-flexi-truncate when flexiTruncate=true', () => {
    const { container } = render(<Grid flexiTruncate>Content</Grid>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-has-flexi-truncate');
  });

  test('sets data-testid from testId prop', () => {
    render(<Grid testId="my-grid">Content</Grid>);
    expect(screen.getByTestId('my-grid')).toBeTruthy();
  });

  test('passes extra divProps to the container', () => {
    const { container } = render(<Grid divProps={{ 'data-custom': 'value' }}>Content</Grid>);
    expect((container.firstChild as HTMLElement).getAttribute('data-custom')).toBe('value');
  });
});

describe('GridCol', () => {
  test('renders children', () => {
    render(<GridCol>Column Content</GridCol>);
    expect(screen.getByText('Column Content')).toBeTruthy();
  });

  test('applies slds-col class by default', () => {
    const { container } = render(<GridCol>Content</GridCol>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-col');
  });

  test('applies size class when size is provided', () => {
    const { container } = render(<GridCol size={6}>Content</GridCol>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-size_6-of-12');
  });

  test('applies custom maxSize when provided', () => {
    const { container } = render(<GridCol size={3} maxSize={6}>Content</GridCol>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-size_3-of-6');
  });

  test('applies slds-grow when grow=true', () => {
    const { container } = render(<GridCol grow>Content</GridCol>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-grow');
  });

  test('applies slds-grow-none when growNone=true', () => {
    const { container } = render(<GridCol growNone>Content</GridCol>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-grow-none');
  });

  test('applies slds-no-flex when noFlex=true', () => {
    const { container } = render(<GridCol noFlex>Content</GridCol>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-no-flex');
  });

  test('applies bump class when bump is provided', () => {
    const { container } = render(<GridCol bump="left">Content</GridCol>);
    expect((container.firstChild as HTMLElement).className).toContain('slds-col_bump-left');
  });

  test('does not apply slds-col when bump is provided', () => {
    const { container } = render(<GridCol bump="right">Content</GridCol>);
    const classNames = (container.firstChild as HTMLElement).className.split(' ');
    expect(classNames).not.toContain('slds-col');
  });
});
