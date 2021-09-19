import { Fragment, FunctionComponent, useEffect } from 'react';
import { FallbackProps } from 'react-error-boundary';
import { logger } from '@jetstream/shared/client-logger';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { Link } from 'react-router-dom';
import { Icon } from '@jetstream/ui';

// Check if error message was from a failed loading of chunk
const chunkLoadingRegex = /Loading chunk [\d]+ failed/i;

// componentStack is depreacted in version 3.0 and must be added as a listener to every place ErrorBoundary is used
export const ErrorBoundaryFallback: FunctionComponent<FallbackProps> = ({ error, /** componentStack, */ resetErrorBoundary }) => {
  const rollbar = useRollbar();

  useEffect(() => {
    if (error && rollbar) {
      try {
        // if loading chunk failed, refresh the browser
        if (chunkLoadingRegex.test(error.message)) {
          window.location.reload();
          return;
        }
        logger.error(error);
        // logger.error(componentStack);
        rollbar.error(error.message, {
          error,
          // componentStack,
        });
      } catch (ex) {
        try {
          rollbar.error('An unknown error occurred logging error event');
        } catch (ex) {
          logger.error('Error logging event to rollbar');
          logger.error(ex);
        }
      }
    }
  }, [/** componentStack, */ error, rollbar]);

  function resetPage() {
    window.location.reload();
  }

  return (
    <div className="slds-card slds-box">
      <p>Oops. It appears that we ran into an unexpected error. The Jetstream team has been notified of the error.</p>
      <p>
        You can also{' '}
        <Link to="/feedback" target="_blank">
          submit a bug report
          <Icon
            type="utility"
            icon="new_window"
            className="slds-icon slds-text-link slds-icon_xx-small slds-m-left_xx-small"
            omitContainer
          />
        </Link>{' '}
        or request support by emailing{' '}
        <a href="mailto:support@getjetstream.app" target="_blank" rel="noreferrer">
          support@getjetstream.app
        </a>
        .
      </p>
      {resetErrorBoundary && (
        <div className="slds-m-top_large">
          <button className="slds-button slds-button_brand" onClick={resetErrorBoundary}>
            Try Again
          </button>
          <button className="slds-button slds-button_neutral" onClick={resetPage}>
            Refresh Page
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorBoundaryFallback;
