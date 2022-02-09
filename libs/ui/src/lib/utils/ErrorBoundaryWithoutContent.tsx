import React from 'react';
/**
 * This component is an error boundary that does not have any fallback content
 * This should be used in places where an error can be ignored
 * e.x. a tooltip that loads content async might fail and we can just ignore it instead of crashing
 */
class ErrorBoundaryWithoutContent extends React.Component<{ children?: React.ReactNode }, { hasError: boolean }> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default ErrorBoundaryWithoutContent;
