/* eslint-disable @typescript-eslint/no-explicit-any */
import { Maybe } from '@jetstream/types';
import { addEventListener } from 'consolidated-events';
import contains from 'document.contains';
import React, { Component } from 'react';

export interface OutsideClickHandlerProps {
  className?: string;
  disabled?: boolean;
  useCapture?: boolean;
  display?: 'block' | 'flex' | 'inline' | 'inline-block' | 'contents';
  /**
   * If some items are in a portal, then provide a ref to the portal container
   * and it will be considered for a valid click without firing onOutsideClick().
   */
  additionalParentRef?: Maybe<HTMLElement>;
  onOutsideClick: (event: MouseEvent) => void;
  children?: React.ReactNode;
}

// Copied / inspired:
// https://github.com/airbnb/react-outside-click-handler/blob/master/src/OutsideClickHandler.jsx
export class OutsideClickHandler extends Component<OutsideClickHandlerProps, never> {
  static defaultProps = { useCapture: true, display: 'block' };
  removeMouseDown;
  removeMouseUp;
  childNode;

  constructor(props) {
    super(props);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
  }

  componentDidMount() {
    const { disabled, useCapture } = this.props;

    if (!disabled) {
      this.addMouseDownEventListener(useCapture);
    }
  }

  componentDidUpdate({ disabled: prevDisabled }: OutsideClickHandlerProps) {
    const { disabled, useCapture } = this.props;
    if (prevDisabled !== disabled) {
      if (disabled) {
        this.removeEventListeners();
      } else {
        this.addMouseDownEventListener(useCapture);
      }
    }
  }

  componentWillUnmount() {
    this.removeEventListeners();
  }

  onMouseDown = (event) => {
    const { useCapture, additionalParentRef } = this.props;

    let isDescendantOfRoot = this.childNode && contains(this.childNode, event.target);
    if (!isDescendantOfRoot && additionalParentRef) {
      isDescendantOfRoot = contains(additionalParentRef, event.target);
    }
    if (!isDescendantOfRoot) {
      if (this.removeMouseUp) {
        this.removeMouseUp();
        this.removeMouseUp = null;
      }
      this.removeMouseUp = addEventListener(document, 'mouseup', this.onMouseUp, { capture: useCapture });
    }
  };

  // Use mousedown/mouseup to enforce that clicks remain outside the root's
  // descendant tree, even when dragged. This should also get triggered on
  // touch devices.
  onMouseUp = (event: MouseEvent) => {
    const { onOutsideClick, additionalParentRef } = this.props;

    let isDescendantOfRoot = this.childNode && contains(this.childNode, event.target);
    if (!isDescendantOfRoot && additionalParentRef) {
      isDescendantOfRoot = contains(additionalParentRef, event.target);
    }
    if (this.removeMouseUp) {
      this.removeMouseUp();
      this.removeMouseUp = null;
    }

    if (!isDescendantOfRoot) {
      onOutsideClick(event);
    }
  };

  setChildNodeRef = (ref) => {
    this.childNode = ref;
  };

  addMouseDownEventListener = (useCapture) => {
    this.removeMouseDown = addEventListener(document, 'mousedown', this.onMouseDown, { capture: useCapture });
  };

  removeEventListeners = () => {
    if (this.removeMouseDown) this.removeMouseDown();
    if (this.removeMouseUp) this.removeMouseUp();
  };

  render() {
    const { className, display, children } = this.props;
    return (
      <div ref={this.setChildNodeRef} style={{ display }} className={className}>
        {children}
      </div>
    );
  }
}

export default OutsideClickHandler;
