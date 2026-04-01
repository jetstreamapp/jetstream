import { fireEvent, render, screen } from '@testing-library/react';
import { Breadcrumbs } from '../Breadcrumbs';
import { Pill } from '../Pill';
import { Spinner } from '../Spinner';

describe('Spinner', () => {
  test('renders with default medium size', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('slds-spinner_medium');
  });

  test('renders with specified size', () => {
    render(<Spinner size="small" />);
    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('slds-spinner_small');
  });

  test('renders xx-small size', () => {
    render(<Spinner size="xx-small" />);
    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('slds-spinner_xx-small');
  });

  test('includes assistive text "Loading"', () => {
    render(<Spinner />);
    expect(screen.getByText('Loading')).toBeTruthy();
  });

  test('renders container with slds-spinner_container class by default', () => {
    const { container } = render(<Spinner />);
    expect((container.firstChild as HTMLElement).className).toContain('slds-spinner_container');
  });

  test('does not render slds-spinner_container when hasContainer=false', () => {
    const { container } = render(<Spinner hasContainer={false} />);
    expect((container.firstChild as HTMLElement).className).not.toContain('slds-spinner_container');
  });

  test('applies slds-spinner_inline when inline=true', () => {
    const { container } = render(<Spinner inline />);
    expect((container.firstChild as HTMLElement).className).toContain('slds-spinner_inline');
  });
});

describe('Pill', () => {
  test('renders children', () => {
    render(<Pill>Pill Label</Pill>);
    expect(screen.getByText('Pill Label')).toBeTruthy();
  });

  test('has role=option', () => {
    render(<Pill>Label</Pill>);
    expect(screen.getByRole('option')).toBeTruthy();
  });

  test('renders title on the label span', () => {
    render(<Pill title="My Pill">Label</Pill>);
    const label = screen.getByText('Label').closest('.slds-pill__label');
    expect(label?.getAttribute('title')).toBe('My Pill');
  });

  test('renders remove button when onRemove is provided', () => {
    render(<Pill onRemove={() => {}}>Label</Pill>);
    expect(screen.getByTitle('Remove')).toBeTruthy();
  });

  test('does not render remove button when onRemove is not provided', () => {
    render(<Pill>Label</Pill>);
    expect(screen.queryByTitle('Remove')).toBeNull();
  });

  test('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<Pill onRemove={onRemove}>Label</Pill>);
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('applies custom className', () => {
    const { container } = render(<Pill className="custom-class">Label</Pill>);
    expect((container.firstChild as HTMLElement).className).toContain('custom-class');
  });
});

describe('Breadcrumbs', () => {
  const items = [
    { id: 'home', label: 'Home' },
    { id: 'products', label: 'Products' },
    { id: 'detail', label: 'Detail' },
  ];

  test('renders all item labels', () => {
    render(<Breadcrumbs items={items} onClick={() => {}} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Products')).toBeTruthy();
    expect(screen.getByText('Detail')).toBeTruthy();
  });

  test('renders with role=navigation', () => {
    render(<Breadcrumbs items={items} onClick={() => {}} />);
    expect(screen.getByRole('navigation')).toBeTruthy();
  });

  test('renders currentItem when provided', () => {
    render(<Breadcrumbs items={items} currentItem="Current Page" onClick={() => {}} />);
    expect(screen.getByText('Current Page')).toBeTruthy();
  });

  test('does not render currentItem when not provided', () => {
    render(<Breadcrumbs items={items} onClick={() => {}} />);
    expect(screen.queryByText('Current Page')).toBeNull();
  });

  test('calls onClick with the correct item when a breadcrumb is clicked', () => {
    const onClick = vi.fn();
    render(<Breadcrumbs items={items} onClick={onClick} />);
    fireEvent.click(screen.getByText('Products'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(items[1]);
  });

  test('renders empty list when items array is empty', () => {
    render(<Breadcrumbs items={[]} onClick={() => {}} />);
    const ol = document.querySelector('ol');
    expect(ol?.children.length).toBe(0);
  });
});
