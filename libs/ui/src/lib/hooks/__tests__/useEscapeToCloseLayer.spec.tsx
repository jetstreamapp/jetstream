import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyboardEvent as ReactKeyboardEvent, useState } from 'react';
import { EscapeLayerPropagationContext, useEscapeToCloseLayer } from '../useEscapeToCloseLayer';

/** The hook is the only behavior under test, so a layer renders nothing of its own. */
function Layer({ isOpen, onEscape }: { isOpen: boolean; onEscape: () => void }) {
  useEscapeToCloseLayer(isOpen, onEscape);
  return null;
}

interface ReactHandlerProps {
  /**
   * React-level handlers on the key target. React delegates every event from its root container, so
   * when these never fire, no React handler anywhere in the tree saw the press — including the
   * `onKeyUp` a hosting Modal closes on.
   */
  onTargetKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onTargetKeyUp?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

/** One self-closing layer, the way a popover registers itself. */
function SingleLayerHarness({
  onEscape,
  initiallyOpen = true,
  onTargetKeyDown,
  onTargetKeyUp,
}: ReactHandlerProps & { onEscape: () => void; initiallyOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  return (
    <div>
      <Layer
        isOpen={isOpen}
        onEscape={() => {
          setIsOpen(false);
          onEscape();
        }}
      />
      <button type="button" onKeyDown={onTargetKeyDown} onKeyUp={onTargetKeyUp}>
        Key target
      </button>
      <span data-testid="layer-state">{isOpen ? 'open' : 'closed'}</span>
    </div>
  );
}

/** Outer layer opens on mount; the inner one opens later, like a combobox inside an already-open popover. */
function NestedLayersHarness({ onOuterEscape, onInnerEscape }: { onOuterEscape: () => void; onInnerEscape: () => void }) {
  const [isOuterOpen, setIsOuterOpen] = useState(true);
  const [isInnerOpen, setIsInnerOpen] = useState(false);
  return (
    <div>
      <Layer
        isOpen={isOuterOpen}
        onEscape={() => {
          setIsOuterOpen(false);
          onOuterEscape();
        }}
      />
      <Layer
        isOpen={isInnerOpen}
        onEscape={() => {
          setIsInnerOpen(false);
          onInnerEscape();
        }}
      />
      <button type="button" onClick={() => setIsInnerOpen(true)}>
        Open inner
      </button>
      <span data-testid="layer-state">{`outer:${isOuterOpen ? 'open' : 'closed'} inner:${isInnerOpen ? 'open' : 'closed'}`}</span>
    </div>
  );
}

/** The inner layer can be unmounted while still open, without ever flipping its `isOpen` to false. */
function UnmountableInnerLayerHarness({ onOuterEscape, onInnerEscape }: { onOuterEscape: () => void; onInnerEscape: () => void }) {
  const [isInnerMounted, setIsInnerMounted] = useState(true);
  return (
    <div>
      <Layer isOpen onEscape={onOuterEscape} />
      {isInnerMounted && <Layer isOpen onEscape={onInnerEscape} />}
      <button type="button" onClick={() => setIsInnerMounted(false)}>
        Unmount inner
      </button>
    </div>
  );
}

/** A full press: keydown then keyup, so a consumed press never leaves its one-shot keyup swallower behind for the next test. */
function pressEscape(target: Element) {
  fireEvent.keyDown(target, { key: 'Escape' });
  fireEvent.keyUp(target, { key: 'Escape' });
}

const documentListenerCleanups: Array<() => void> = [];

/** Bubble-phase document listener, the same phase floating-ui's useDismiss listens in. */
function listenOnDocument(type: 'keydown' | 'keyup') {
  const listener = vi.fn();
  document.addEventListener(type, listener);
  documentListenerCleanups.push(() => document.removeEventListener(type, listener));
  return listener;
}

afterEach(() => {
  documentListenerCleanups.splice(0).forEach((cleanup) => cleanup());
});

describe('useEscapeToCloseLayer', () => {
  it('closes a single open layer on Escape and fires the callback exactly once', async () => {
    const onEscape = vi.fn();
    const { baseElement } = render(<SingleLayerHarness onEscape={onEscape} />);
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);

    pressEscape(screen.getByRole('button', { name: 'Key target' }));

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('layer-state').textContent).toBe('closed');
  });

  it('consumes the Escape keydown so nothing below the document capture phase sees it', () => {
    const onEscape = vi.fn();
    const onTargetKeyDown = vi.fn();
    const documentKeyDown = listenOnDocument('keydown');
    render(<SingleLayerHarness onEscape={onEscape} onTargetKeyDown={onTargetKeyDown} />);
    const target = screen.getByRole('button', { name: 'Key target' });

    // fireEvent returns false when the event's default was prevented
    const wasNotPrevented = fireEvent.keyDown(target, { key: 'Escape' });
    fireEvent.keyUp(target, { key: 'Escape' });

    expect(wasNotPrevented).toBe(false);
    expect(onTargetKeyDown).not.toHaveBeenCalled();
    expect(documentKeyDown).not.toHaveBeenCalled();
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores keys other than Escape and lets them through untouched', () => {
    const onEscape = vi.fn();
    const onTargetKeyDown = vi.fn();
    render(<SingleLayerHarness onEscape={onEscape} onTargetKeyDown={onTargetKeyDown} />);
    const target = screen.getByRole('button', { name: 'Key target' });

    fireEvent.keyDown(target, { key: 'Enter' });
    fireEvent.keyUp(target, { key: 'Enter' });

    expect(onEscape).not.toHaveBeenCalled();
    expect(onTargetKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('layer-state').textContent).toBe('open');
  });

  it('ignores an auto-repeated Escape keydown so a held key does not re-run the callback', () => {
    const onEscape = vi.fn();
    render(<SingleLayerHarness onEscape={onEscape} />);
    const target = screen.getByRole('button', { name: 'Key target' });

    fireEvent.keyDown(target, { key: 'Escape', repeat: true });

    expect(onEscape).not.toHaveBeenCalled();
    expect(screen.getByTestId('layer-state').textContent).toBe('open');
  });

  it('closes only the innermost of two nested layers per press, from the inside out', () => {
    const onOuterEscape = vi.fn();
    const onInnerEscape = vi.fn();
    render(<NestedLayersHarness onOuterEscape={onOuterEscape} onInnerEscape={onInnerEscape} />);
    const openInnerButton = screen.getByRole('button', { name: 'Open inner' });
    fireEvent.click(openInnerButton);
    expect(screen.getByTestId('layer-state').textContent).toBe('outer:open inner:open');

    pressEscape(openInnerButton);

    expect(onInnerEscape).toHaveBeenCalledTimes(1);
    expect(onOuterEscape).not.toHaveBeenCalled();
    expect(screen.getByTestId('layer-state').textContent).toBe('outer:open inner:closed');

    pressEscape(openInnerButton);

    expect(onInnerEscape).toHaveBeenCalledTimes(1);
    expect(onOuterEscape).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('layer-state').textContent).toBe('outer:closed inner:closed');
  });

  it('swallows the keyup that follows a consumed Escape keydown, then lets later keyups through again', () => {
    const onTargetKeyUp = vi.fn();
    const documentKeyUp = listenOnDocument('keyup');
    render(<SingleLayerHarness onEscape={vi.fn()} onTargetKeyUp={onTargetKeyUp} />);
    const target = screen.getByRole('button', { name: 'Key target' });

    fireEvent.keyDown(target, { key: 'Escape' });
    // The layer has already closed by now (state flipped, effect torn down), yet the keyup must still be swallowed
    expect(screen.getByTestId('layer-state').textContent).toBe('closed');
    fireEvent.keyUp(target, { key: 'Escape' });

    expect(onTargetKeyUp).not.toHaveBeenCalled();
    expect(documentKeyUp).not.toHaveBeenCalled();

    // The swallower is one-shot: an unrelated later Escape keyup reaches everyone
    fireEvent.keyUp(target, { key: 'Escape' });

    expect(onTargetKeyUp).toHaveBeenCalledTimes(1);
    expect(documentKeyUp).toHaveBeenCalledTimes(1);
  });

  it('lets a modifier keyup through and still swallows the Escape keyup that comes after it', () => {
    const onTargetKeyUp = vi.fn();
    render(<SingleLayerHarness onEscape={vi.fn()} onTargetKeyUp={onTargetKeyUp} />);
    const target = screen.getByRole('button', { name: 'Key target' });

    // Shift+Escape released Shift-first: the modifier keyup must not detach the one-shot swallower
    fireEvent.keyDown(target, { key: 'Escape', shiftKey: true });
    fireEvent.keyUp(target, { key: 'Shift' });
    fireEvent.keyUp(target, { key: 'Escape' });

    expect(onTargetKeyUp).toHaveBeenCalledTimes(1);
    expect(onTargetKeyUp.mock.calls[0][0].key).toBe('Shift');
  });

  it('does nothing while isOpen is false', () => {
    const onEscape = vi.fn();
    const onTargetKeyDown = vi.fn();
    const onTargetKeyUp = vi.fn();
    render(
      <SingleLayerHarness onEscape={onEscape} initiallyOpen={false} onTargetKeyDown={onTargetKeyDown} onTargetKeyUp={onTargetKeyUp} />,
    );

    pressEscape(screen.getByRole('button', { name: 'Key target' }));

    expect(onEscape).not.toHaveBeenCalled();
    expect(onTargetKeyDown).toHaveBeenCalledTimes(1);
    expect(onTargetKeyUp).toHaveBeenCalledTimes(1);
  });

  it('unregisters on unmount so Escape afterwards neither fires the callback nor is consumed', () => {
    const onEscape = vi.fn();
    const documentKeyDown = listenOnDocument('keydown');
    const { unmount } = render(<SingleLayerHarness onEscape={onEscape} />);
    unmount();

    pressEscape(document.body);

    expect(onEscape).not.toHaveBeenCalled();
    expect(documentKeyDown).toHaveBeenCalledTimes(1);
  });

  it('drops an unmounted inner layer from the stack so the outer layer becomes the Escape owner again', () => {
    const onOuterEscape = vi.fn();
    const onInnerEscape = vi.fn();
    render(<UnmountableInnerLayerHarness onOuterEscape={onOuterEscape} onInnerEscape={onInnerEscape} />);
    const unmountInnerButton = screen.getByRole('button', { name: 'Unmount inner' });
    fireEvent.click(unmountInnerButton);

    pressEscape(unmountInnerButton);

    expect(onInnerEscape).not.toHaveBeenCalled();
    expect(onOuterEscape).toHaveBeenCalledTimes(1);
  });

  it('always invokes the latest onEscape callback, not the one from the render that opened the layer', () => {
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const { rerender } = render(<Layer isOpen onEscape={firstCallback} />);
    rerender(<Layer isOpen onEscape={latestCallback} />);

    pressEscape(document.body);

    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
  });

  describe('propagate mode', () => {
    it('still closes the layer but lets the keydown continue to React handlers', () => {
      const onEscape = vi.fn();
      const onTargetKeyDown = vi.fn();
      const documentKeyDown = listenOnDocument('keydown');
      render(
        <EscapeLayerPropagationContext.Provider value="propagate">
          <SingleLayerHarness onEscape={onEscape} onTargetKeyDown={onTargetKeyDown} />
        </EscapeLayerPropagationContext.Provider>,
      );
      const target = screen.getByRole('button', { name: 'Key target' });

      const wasNotPrevented = fireEvent.keyDown(target, { key: 'Escape' });
      fireEvent.keyUp(target, { key: 'Escape' });

      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('layer-state').textContent).toBe('closed');
      expect(wasNotPrevented).toBe(true);
      expect(onTargetKeyDown).toHaveBeenCalledTimes(1);
      expect(onTargetKeyDown.mock.calls[0][0].key).toBe('Escape');
      expect(documentKeyDown).toHaveBeenCalledTimes(1);
    });

    it('still swallows the Escape keyup so a hosting Modal cannot close on the same press', () => {
      const onTargetKeyUp = vi.fn();
      const documentKeyUp = listenOnDocument('keyup');
      render(
        <EscapeLayerPropagationContext.Provider value="propagate">
          <SingleLayerHarness onEscape={vi.fn()} onTargetKeyUp={onTargetKeyUp} />
        </EscapeLayerPropagationContext.Provider>,
      );

      pressEscape(screen.getByRole('button', { name: 'Key target' }));

      expect(onTargetKeyUp).not.toHaveBeenCalled();
      expect(documentKeyUp).not.toHaveBeenCalled();
    });

    it('only the topmost layer handles the press even when that layer propagates', () => {
      const onOuterEscape = vi.fn();
      const onInnerEscape = vi.fn();
      render(
        <div>
          <Layer isOpen onEscape={onOuterEscape} />
          <EscapeLayerPropagationContext.Provider value="propagate">
            <Layer isOpen onEscape={onInnerEscape} />
          </EscapeLayerPropagationContext.Provider>
        </div>,
      );

      pressEscape(document.body);

      expect(onInnerEscape).toHaveBeenCalledTimes(1);
      expect(onOuterEscape).not.toHaveBeenCalled();
    });
  });
});
