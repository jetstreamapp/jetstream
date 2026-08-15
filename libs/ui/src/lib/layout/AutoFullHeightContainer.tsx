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
  /**
   * The available height is measured once on mount. Change this value whenever surrounding content
   * grows or collapses (e.g. a section above was expanded) to re-measure and reclaim the space.
   */
  recalculateKey?: string | number | boolean;
  maxHeight?: string;
  /**
   * Floor for the calculated height, e.g. `50vh`. The height is derived from how far down the page the
   * container starts, so content above it (a stack of validation errors, a banner) can squeeze it to
   * nothing - this keeps it usable and lets the page scroll instead.
   */
  minHeight?: string;
  children?: React.ReactNode;
}

export interface AutoFullHeightContainerState {
  topPosition: number;
  hasRefCalculated: boolean;
}

export class AutoFullHeightContainer extends Component<AutoFullHeightContainerProps, AutoFullHeightContainerState> {
  ref!: HTMLDivElement;

  constructor(props: AutoFullHeightContainerProps) {
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

  componentDidUpdate(prevProps: AutoFullHeightContainerProps) {
    if (prevProps.recalculateKey !== this.props.recalculateKey) {
      // A hidden container (e.g. an inactive tab) measures 0 - keep the last known position instead of the fallback
      const topPosition = this.ref?.getBoundingClientRect().top || 0;
      if (topPosition > 0 && topPosition !== this.state.topPosition) {
        // oxlint-disable-next-line react/no-did-update-set-state
        this.setState({ topPosition });
      }
    }
  }

  getElementTopPosition = () => {
    return this.ref?.getBoundingClientRect().top || this.props.bufferIfNotRendered || 0;
  };

  render() {
    const {
      bottomBuffer,
      bufferIfNotRendered,
      className,
      baseCss,
      fillHeight = true,
      setHeightAttr,
      maxHeight,
      minHeight,
      children,
    } = this.props;
    const topPosition = this.state.topPosition || bufferIfNotRendered || 0;
    let maxHeightStr = `calc(100vh - ${topPosition + (bottomBuffer || 0)}px)`;
    // make the min height string slightly smaller in attempt to limit possible scrollbar creep
    let minHeightStr = `calc(100vh - ${topPosition + (bottomBuffer || 0) + 10}px)`;
    if (minHeight) {
      maxHeightStr = `max(${maxHeightStr}, ${minHeight})`;
      minHeightStr = `max(${minHeightStr}, ${minHeight})`;
    }
    if (maxHeight) {
      maxHeightStr = `min(${maxHeightStr}, ${maxHeight})`;
    }
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
