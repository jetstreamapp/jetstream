import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { ariaDisabledButtonProps } from '../aria-disabled-button.utils';

/**
 * Bubble-phase listener on an element ABOVE React's root container, the way a clickable row or card
 * outside the React tree sees its children's clicks (a listener on the root itself runs before React
 * dispatches, so it could not observe a stopPropagation made from a React handler).
 */
function listenAboveReact() {
  const ancestor = document.createElement('div');
  const container = document.createElement('div');
  ancestor.appendChild(container);
  document.body.appendChild(ancestor);
  const onAncestorClick = vi.fn();
  ancestor.addEventListener('click', onAncestorClick);
  return { container, onAncestorClick };
}

describe('ariaDisabledButtonProps', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('runs the handler and lets the click reach ancestors while enabled', async () => {
    const onClick = vi.fn();
    const { container, onAncestorClick } = listenAboveReact();
    const { baseElement } = render(
      <button type="button" {...ariaDisabledButtonProps(false, onClick)}>
        Save
      </button>,
      { container },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onAncestorClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBeNull();
    await axeScan(baseElement);
  });

  it('while disabled, blocks the handler and hides the click from ancestors, like a native disabled button', async () => {
    const onClick = vi.fn();
    const { container, onAncestorClick } = listenAboveReact();
    const { baseElement } = render(
      <button type="button" {...ariaDisabledButtonProps(true, onClick)}>
        Save
      </button>,
      { container },
    );
    const button = screen.getByRole('button', { name: 'Save' });
    button.focus();

    const notPrevented = fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(onAncestorClick).not.toHaveBeenCalled();
    expect(notPrevented).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);
    await axeScan(baseElement);
  });
});
