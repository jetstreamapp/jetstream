import { css, SerializedStyles } from '@emotion/react';
import { Component } from 'react';

export interface AutoFullHeightContainerProps {
  className?: string;
  baseCss?: SerializedStyles;
  /** Number of pixels from the bottom of the page to compensate for  */
  bottomBuffer?: number;
  /** What should the top be set to if not yet rendered */
  bufferIfNotRendered?: number;
  /** If true, then container will always be the full height no matter how much content the data has */
  fillHeight?: boolean;
  // sets `height:` if true
  setHeightAttr?: boolean;
  /** Set to true if used in a modal where the dom is not updated on the initial render */
  delayForSecondTopCalc?: boolean;
  maxHeight?: string;
  children?: React.ReactNode;
}

export interface AutoFullHeightContainerState {
  topPosition: number;
  hasRefCalculated: boolean;
}

export class AutoFullHeightContainer extends Component<AutoFullHeightContainerProps, AutoFullHeightContainerState> {
  ref: HTMLDivElement;

  constructor(props) {
    super(props);
    this.state = { topPosition: 0, hasRefCalculated: false };
  }

  setRef = (element: HTMLDivElement) => {
    this.ref = element;
    if (this.ref && !this.state.hasRefCalculated) {
      this.setState({
        topPosition: this.getElementTopPosition(),
        hasRefCalculated: true,
      });
      if (this.props.delayForSecondTopCalc) {
        setTimeout(() => {
          this.setState({
            topPosition: this.getElementTopPosition(),
          });
        }, 10);
      }
    }
  };

  getElementTopPosition = () => {
    return this.ref?.getBoundingClientRect().top || this.props.bufferIfNotRendered || 0;
  };

  render() {
    const { bottomBuffer, bufferIfNotRendered, className, baseCss, fillHeight = true, setHeightAttr, maxHeight, children } = this.props;
    const topPosition = this.state.topPosition || bufferIfNotRendered || 0;
    let maxHeightStr = `calc(100vh - ${topPosition + (bottomBuffer || 0)}px)`;
    if (maxHeight) {
      maxHeightStr = `min(${maxHeightStr}, ${maxHeight})`;
    }
    // make the min height string slightly smaller in attempt to limit possible scrollbar creep
    const minHeightStr = `calc(100vh - ${topPosition + (bottomBuffer || 0) + 10}px)`;
    return (
      <div
        className={className}
        ref={this.setRef}
        css={css`
          position: relative;
          ${baseCss || ''}
          max-height: ${maxHeightStr};
          ${fillHeight && `min-height: ${minHeightStr};`}
          ${setHeightAttr && `height: ${maxHeightStr};`}
          overflow-y: auto;
        `}
      >
        {children}
      </div>
    );
  }
}

export default AutoFullHeightContainer;
