import { fireEvent, render, screen } from '@testing-library/react';
import { ProgressStepIndicator } from '../ProgressStepIndicator';
import { ProgressStepIndicatorListItem } from '../ProgressStepIndicatorListItem';

describe('ProgressStepIndicator', () => {
  test('renders children', () => {
    render(
      <ProgressStepIndicator currentStep={0}>
        <ProgressStepIndicatorListItem step={0} isActive />
        <ProgressStepIndicatorListItem step={1} />
        <ProgressStepIndicatorListItem step={2} />
      </ProgressStepIndicator>,
    );
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  test('progressbar shows 0% at first step', () => {
    render(
      <ProgressStepIndicator currentStep={0}>
        <ProgressStepIndicatorListItem step={0} isActive />
        <ProgressStepIndicatorListItem step={1} />
        <ProgressStepIndicatorListItem step={2} />
      </ProgressStepIndicator>,
    );
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('0');
  });

  test('progressbar shows 50% at middle step of 3 children', () => {
    render(
      <ProgressStepIndicator currentStep={1}>
        <ProgressStepIndicatorListItem step={0} isComplete />
        <ProgressStepIndicatorListItem step={1} isActive />
        <ProgressStepIndicatorListItem step={2} />
      </ProgressStepIndicator>,
    );
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('50');
  });

  test('progressbar shows 100% at last step', () => {
    render(
      <ProgressStepIndicator currentStep={2}>
        <ProgressStepIndicatorListItem step={0} isComplete />
        <ProgressStepIndicatorListItem step={1} isComplete />
        <ProgressStepIndicatorListItem step={2} isActive />
      </ProgressStepIndicator>,
    );
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('100');
  });

  test('applies slds-progress_vertical when isVertical=true', () => {
    const { container } = render(
      <ProgressStepIndicator currentStep={0} isVertical>
        <ProgressStepIndicatorListItem step={0} isVertical isActive />
      </ProgressStepIndicator>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('slds-progress_vertical');
  });
});

describe('ProgressStepIndicatorListItem', () => {
  test('renders step button in horizontal mode', () => {
    render(<ProgressStepIndicatorListItem step={0} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  test('active item gets slds-is-active class', () => {
    const { container } = render(<ProgressStepIndicatorListItem step={0} isActive />);
    expect((container.firstChild as HTMLElement).className).toContain('slds-is-active');
  });

  test('completed item gets slds-is-completed class', () => {
    const { container } = render(<ProgressStepIndicatorListItem step={0} isComplete />);
    expect((container.firstChild as HTMLElement).className).toContain('slds-is-completed');
  });

  test('calls onChangeStep with step number when button is clicked', () => {
    const onChangeStep = vi.fn();
    render(<ProgressStepIndicatorListItem step={2} onChangeStep={onChangeStep} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChangeStep).toHaveBeenCalledTimes(1);
    expect(onChangeStep).toHaveBeenCalledWith(2);
  });

  test('disabled button cannot be clicked', () => {
    const onChangeStep = vi.fn();
    render(<ProgressStepIndicatorListItem step={0} disabled onChangeStep={onChangeStep} />);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test('renders custom stepText as button title', () => {
    render(<ProgressStepIndicatorListItem step={0} stepText="Start" />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('title')).toBe('Start');
  });

  test('renders vertical item without a button', () => {
    render(<ProgressStepIndicatorListItem step={0} isVertical />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('vertical completed item shows assistive Complete text', () => {
    render(<ProgressStepIndicatorListItem step={0} isVertical isComplete />);
    expect(screen.getByText('Complete')).toBeTruthy();
  });
});
