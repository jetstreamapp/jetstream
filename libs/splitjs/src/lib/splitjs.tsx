/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Library was not being updated from author
 * https://github.com/nathancahill/split/blob/master/packages/react-split/src/index.js
 * https://github.com/nathancahill/split/issues/724
 */
import React from 'react';
import Split from 'split.js';

export interface SplitWrapperProps extends Split.Options {
  className?: string;
  collapsed?: boolean | number;
  children?: React.ReactNode;
}

export class SplitWrapper extends React.Component<SplitWrapperProps> {
  parent: (HTMLDivElement & { children: any }) | null = null;
  split: Split.Instance | null = null;

  override componentDidMount() {
    const { children, gutter, ...rest } = this.props;
    const options = rest as Split.Options;

    options.gutter = (index, direction) => {
      let gutterElement;

      if (gutter) {
        gutterElement = gutter(index, direction);
      } else {
        gutterElement = document.createElement('div');
        gutterElement.className = `gutter gutter-${direction}`;
      }

      (gutterElement as any).__isSplitGutter = true;
      return gutterElement;
    };

    this.split = Split(this.parent?.children as any, options);
  }

  override componentDidUpdate(prevProps: SplitWrapperProps) {
    const { children, minSize, sizes, collapsed, ...rest } = this.props;
    const options = rest as Split.Options;
    const { minSize: prevMinSize, sizes: prevSizes, collapsed: prevCollapsed } = prevProps;

    const otherProps = ['maxSize', 'expandToMin', 'gutterSize', 'gutterAlign', 'snapOffset', 'dragInterval', 'direction', 'cursor'];

    let needsRecreate = otherProps
      .map((prop) => this.props[prop as keyof SplitWrapperProps] !== prevProps[prop as keyof SplitWrapperProps])
      .reduce((accum, same) => accum || same, false);

    // Compare minSize when both are arrays, when one is an array and when neither is an array
    if (Array.isArray(minSize) && Array.isArray(prevMinSize)) {
      let minSizeChanged = false;

      minSize.forEach((minSizeI, i) => {
        minSizeChanged = minSizeChanged || minSizeI !== prevMinSize[i];
      });

      needsRecreate = needsRecreate || minSizeChanged;
    } else if (Array.isArray(minSize) || Array.isArray(prevMinSize)) {
      needsRecreate = true;
    } else {
      needsRecreate = needsRecreate || minSize !== prevMinSize;
    }

    // Destroy and re-create split if options changed
    if (needsRecreate) {
      options.minSize = minSize;
      options.sizes = sizes || this.split?.getSizes();
      this.split?.destroy(true, true);
      options.gutter = ((index: number, direction: 'horizontal' | 'vertical', pairB: any) => pairB.previousSibling) as any;
      this.split = Split(Array.from(this.parent?.children as any).filter((element: any) => !element.__isSplitGutter) as any, options);
    } else if (sizes) {
      // If only the size has changed, set the size. No need to do this if re-created.
      let sizeChanged = false;

      sizes.forEach((sizeI, i) => {
        sizeChanged = sizeChanged || sizeI !== prevSizes?.[i];
      });

      if (sizeChanged) {
        this.split?.setSizes(this.props.sizes || []);
      }
    }

    // Collapse after re-created or when collapsed changed.
    if (Number.isInteger(collapsed) && (collapsed !== prevCollapsed || needsRecreate)) {
      this.split?.collapse(collapsed as number);
    }
  }

  override componentWillUnmount() {
    if (this.split) {
      this.split?.destroy();
      this.split = null;
    }
  }

  override render() {
    const {
      sizes,
      minSize,
      maxSize,
      expandToMin,
      gutterSize,
      gutterAlign,
      snapOffset,
      dragInterval,
      direction,
      cursor,
      gutter,
      elementStyle,
      gutterStyle,
      onDrag,
      onDragStart,
      onDragEnd,
      collapsed,
      children,
      ...rest
    } = this.props;

    return (
      <div
        ref={(parent) => {
          this.parent = parent;
        }}
        {...rest}
      >
        {children}
      </div>
    );
  }
}

export default SplitWrapper;
