import { logger } from '@jetstream/shared/client-logger';
import { initErrorTracker, setErrorTrackerOptOut } from '@jetstream/shared/ui-utils';
import { Environment } from '@jetstream/types';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { environment } from '../../../environments/environment';
import { desktopUserPreferences } from './AppDesktopState';

/**
 * Wires up crash reporting for the desktop app.
 *
 * The DSN is baked into the renderer bundle at build time; the packaged main process has no
 * build-time environment of its own, so the renderer hands it over at boot.
 *
 * `desktopUserPreferences` is the single source of truth for the "Send crash reports to Jetstream"
 * preference — the main-process menu checkbox broadcasts its new value into the same atom the
 * settings page reads and writes, so the two can never disagree.
 */
export function useDesktopErrorTracker({ version, environment: appEnvironment }: { version: string; environment: Environment }) {
  const [preferences, setPreferences] = useAtom(desktopUserPreferences);

  useEffect(() => {
    window.electronAPI?.configureCrashReporter(environment.sentryDsn).catch((ex) => {
      logger.error('[CRASH REPORTER] Error configuring main process crash reporter', ex);
    });
  }, []);

  // The opt-out is applied before init so nothing is reported while the preference is unknown.
  // initErrorTracker is a no-op while opted out or already initialized, so re-running this
  // re-enables reporting without an app restart when the user turns crash reporting back on.
  useEffect(() => {
    setErrorTrackerOptOut(!preferences.crashReportingEnabled);
    initErrorTracker({ dsn: environment.sentryDsn, environment: appEnvironment, version });
  }, [appEnvironment, preferences.crashReportingEnabled, version]);

  // React to live changes broadcast from the main-process menu checkbox. The merge is a functional
  // update so the listener can subscribe once and still never write a stale copy of the other
  // preferences - the atom holds a promise until the first write, hence the branch.
  useEffect(
    () =>
      window.electronAPI?.onCrashReportingChanged((crashReportingEnabled) =>
        setPreferences((previous) =>
          previous instanceof Promise
            ? previous.then((resolved) => ({ ...resolved, crashReportingEnabled }))
            : { ...previous, crashReportingEnabled },
        ),
      ),
    [setPreferences],
  );
}
