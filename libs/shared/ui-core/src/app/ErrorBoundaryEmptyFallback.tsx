import { logger } from '@jetstream/shared/client-logger';
import { tracker } from '@jetstream/shared/ui-utils';
import { ensureError } from '@jetstream/shared/utils';
import { FunctionComponent, useEffect } from 'react';
import { FallbackProps } from 'react-error-boundary';

// Empty fallback for ErrorBoundary when we don't want to show anything and don't want to blow up the app
export const ErrorBoundaryEmptyFallback: FunctionComponent<FallbackProps> = ({ error: _error }) => {
  useEffect(() => {
    if (_error) {
      try {
        const error = ensureError(_error);
        logger.error(error);
        tracker.error(`[UNCAUGHT] ${error.message}`, error, {
          errorName: error.name,
          message: error.message,
          stack: error.stack,
        });
      } catch (ex) {
        try {
          tracker.error('An unknown error occurred logging error event', { message: ex.message, stack: ex.stack });
        } catch (innerEx) {
          logger.error('Error logging event to error tracker');
          logger.error(innerEx);
        }
      }
    }
  }, [_error]);

  return null;
};

export default ErrorBoundaryEmptyFallback;

