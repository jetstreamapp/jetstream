import { getBrowserExtensionVersion, initErrorTracker, setErrorTrackerOptOut } from '@jetstream/shared/ui-utils';
import { useEffect } from 'react';
import { environment } from '../environments/environment';

/**
 * Starts error tracking for an extension page (each page is its own document, so each one initializes).
 *
 * The "Send crash reports to Jetstream" setting is applied _before_ init so nothing is reported while
 * the setting is still being read from `browser.storage`. `initErrorTracker` is a no-op while opted
 * out or already initialized, which also makes this re-enable reporting without a page reload when
 * the user turns the setting back on.
 */
export function useExtensionErrorTracker(crashReportingEnabled: boolean) {
  useEffect(() => {
    setErrorTrackerOptOut(!crashReportingEnabled);
    initErrorTracker({
      dsn: environment.sentryDsn,
      environment: environment.production ? 'production' : 'development',
      version: getBrowserExtensionVersion(),
    });
  }, [crashReportingEnabled]);
}
