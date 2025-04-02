import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Icon } from '@jetstream/ui';
import * as Sentry from '@sentry/react';
import { FunctionComponent, ReactNode } from 'react';
import { FallbackProps, ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Link } from 'react-router-dom';
import { EmailSupport } from './EmailSupport';

function logError(error: Error, info: { componentStack: string }) {
  try {
    logger.error(error);
    Sentry.captureReactException(error, info);
    logger.error(info.componentStack);
  } catch (ex) {
    logger.error('Error logging event to sentry');
    logger.error(ex);
  }
}

export const ErrorBoundary = ({ children }: { children: ReactNode }) => {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorBoundaryFallback} onError={logError}>
      {children}
    </ReactErrorBoundary>
  );
};

const ErrorBoundaryFallback: FunctionComponent<FallbackProps> = ({ error, resetErrorBoundary }) => {
  function resetPage() {
    window.location.reload();
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
      <hr className="slds-m-vertical_medium" />
      <EmailSupport />
    </div>
  );
};

export default ErrorBoundaryFallback;
