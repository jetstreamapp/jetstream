/** @jsx jsx */
import { css, jsx, SerializedStyles } from '@emotion/react';
import { Component, createRef, RefObject } from 'react';

export interface AutoFullHeightContainerProps {
  className?: string;
  baseCss?: SerializedStyles;
  bottomBuffer?: number;
  bufferIfNotRendered?: number;
  /** If true, then container will always be the full height no matter how much content the data has */
  fillHeight?: boolean;
  // sets `height:` if true
  setHeightAttr?: boolean;
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
    return this.ref?.current?.getBoundingClientRect().top || this.props.bufferIfNotRendered || 0;
  };

  render() {
    const { bottomBuffer, bufferIfNotRendered, className, baseCss, fillHeight = true, setHeightAttr, children } = this.props;
    const topPosition = this.state.topPosition || bufferIfNotRendered || 0;
    const heightStr = `calc(100vh - ${topPosition + (bottomBuffer || 0)}px);`;
    return (
      <div
        className={className}
        ref={this.ref}
        css={css`
          ${baseCss || ''}
          max-height: ${heightStr}
          ${fillHeight && `min-height: ${heightStr}`}
          ${setHeightAttr && `height: ${heightStr}`}
          overflow-y: auto;
        `}
      >
        {children}
      </div>
    );
  }
}

export default AutoFullHeightContainer;
