import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { tracker } from '@jetstream/shared/ui-utils';
import { ensureError } from '@jetstream/shared/utils';
import { Icon } from '@jetstream/ui';
import { UserProfileUnavailableError } from '@jetstream/ui/app-state';
import { FunctionComponent, useEffect } from 'react';
import { FallbackProps } from 'react-error-boundary';
import { Link } from 'react-router';

// componentStack is deprecated in version 3.0 and must be added as a listener to every place ErrorBoundary is used
export const ErrorBoundaryFallback: FunctionComponent<FallbackProps> = ({ error: _error, resetErrorBoundary }) => {
  useEffect(() => {
    if (_error) {
      try {
        const error = ensureError(_error);
        logger.error(error);
        tracker.error(`[UNCAUGHT] ${error.message}`, error, { errorName: error.name });
      } catch (ex) {
        try {
          tracker.error('An unknown error occurred logging error event', ex);
        } catch (innerEx) {
          logger.error('Error logging event to error tracker');
          logger.error(innerEx);
        }
      }
    }
  }, [_error]);

  function resetPage() {
    window.location.reload();
  }

  // The profile fetch happens once per page load and its rejected promise lives as long as the page,
  // so re-rendering the tree cannot recover from this one - only a reload can. Say what happened
  // instead of the generic copy below, since this is usually a passing network or server problem.
  if (_error instanceof UserProfileUnavailableError) {
    return (
      <div className="slds-card slds-box">
        <p>We were unable to load your account, so Jetstream could not finish starting up.</p>
        <p className="slds-m-top_x-small">
          This is usually caused by a temporary network or server problem. Reload the page to try again - if it keeps happening, email{' '}
          <a href="mailto:support@getjetstream.app" target="_blank" rel="noreferrer">
            support@getjetstream.app
          </a>
          .
        </p>
        <div className="slds-m-top_large">
          <button className="slds-button slds-button_brand" onClick={resetPage}>
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="slds-card slds-box">
      <p>Oops. It appears that we ran into an unexpected error. The Jetstream team has been notified of the error.</p>
      <p>
        You can also{' '}
        <Link to={APP_ROUTES.FEEDBACK_SUPPORT.ROUTE}>
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
