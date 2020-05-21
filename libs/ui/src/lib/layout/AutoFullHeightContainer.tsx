/** @jsx jsx */
import { css, jsx, SerializedStyles } from '@emotion/core';
import { Component, createRef, RefObject } from 'react';

export interface AutoFullHeightContainerProps {
  className?: string;
  baseCss?: SerializedStyles;
  bottomBuffer?: number;
  /** If true, then container will always be the full height no matter how much content the data has */
  fillHeight?: boolean;
}

export interface AutoFullHeightContainerState {
  topPosition: number;
}

export class AutoFullHeightContainer extends Component<AutoFullHeightContainerProps, AutoFullHeightContainerState> {
  ref: RefObject<HTMLDivElement>;

  constructor(props) {
    super(props);
    this.ref = createRef<HTMLDivElement>();
    this.state = { topPosition: 0 };
  }

  componentDidMount() {
    this.setState({
      topPosition: this.getElementTopPosition(),
    });
  }

  getElementTopPosition = () => {
    return this.ref?.current?.getBoundingClientRect().top || 0;
  };

  render() {
    const { bottomBuffer, className, baseCss, fillHeight, children } = this.props;
    const { topPosition } = this.state;
    return (
      <div
        className={className}
        ref={this.ref}
        css={css`
          ${baseCss || ''}
          max-height: calc(100vh - ${topPosition + (bottomBuffer || 10)}px);
          ${fillHeight && `min-height: calc(100vh - ${topPosition + (bottomBuffer || 10)}px);`}
          overflow-y: auto;
        `}
      >
        {children}
      </div>
    );
  }
}

export default AutoFullHeightContainer;
