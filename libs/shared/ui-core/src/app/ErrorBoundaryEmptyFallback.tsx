import { logger } from '@jetstream/shared/client-logger';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { ensureError } from '@jetstream/shared/utils';
import { FunctionComponent, useEffect } from 'react';
import { FallbackProps } from 'react-error-boundary';

// Empty fallback for ErrorBoundary when we don't want to show anything and don't want to blow up the app
export const ErrorBoundaryEmptyFallback: FunctionComponent<FallbackProps> = ({ error: _error }) => {
  const rollbar = useRollbar();

  useEffect(() => {
    if (_error && rollbar) {
      try {
        const error = ensureError(_error);
        logger.error(error);
        rollbar.error(`[UNCAUGHT] ${error.message}`, error, {
          errorName: error.name,
          message: error.message,
          stack: error.stack,
        });
      } catch (ex) {
        try {
          rollbar.error('An unknown error occurred logging error event', { message: ex.message, stack: ex.stack });
        } catch (ex) {
          logger.error('Error logging event to rollbar');
          logger.error(ex);
        }
      }
    }
  }, [_error, rollbar]);

  return null;
};

export default ErrorBoundaryEmptyFallback;
