import { HTTP, HTTP_SOURCE_DESKTOP } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { isFreshProfile } from '../services/persistence.service';

interface DesktopRequestOptions {
  deviceId?: Maybe<string>;
  accessToken?: Maybe<string>;
}

interface DesktopRequest {
  headers: Record<string, string>;
  requestId: string;
}

/**
 * Identity and host-environment headers sent on every desktop -> server request.
 *
 * This is the only place these headers are built. Requests originate from several unrelated places
 * (auth heartbeat, notifications, data sync, feedback, the socket.io handshake) and previously each
 * one hand-rolled its own header object, which is how they drifted out of sync.
 */
export function getDesktopRequestHeaders({ deviceId, accessToken }: DesktopRequestOptions = {}): DesktopRequest {
  // Correlates a client-side electron-log entry with the server log line for the same request.
  // Returned alongside the headers so a caller that logs it gets it from the type, rather than
  // reading it back out of the header bag where the index signature would hide a missing key.
  const requestId = randomUUID();
  return {
    requestId,
    headers: {
      [HTTP.HEADERS.X_SOURCE]: HTTP_SOURCE_DESKTOP,
      [HTTP.HEADERS.X_APP_VERSION]: app.getVersion(),
      [HTTP.HEADERS.X_CLIENT_PLATFORM]: process.platform,
      [HTTP.HEADERS.X_CLIENT_OS_VERSION]: getOsVersion(),
      [HTTP.HEADERS.X_CLIENT_ARCH]: getArch(),
      [HTTP.HEADERS.X_CLIENT_RUNTIME]: `electron/${process.versions.electron} chrome/${process.versions.chrome}`,
      [HTTP.HEADERS.X_CLIENT_INSTALL]: getInstallDescriptor(),
      [HTTP.HEADERS.X_CLIENT_REQUEST_ID]: requestId,
      ...(deviceId ? { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId } : {}),
      ...(accessToken ? { [HTTP.HEADERS.AUTHORIZATION]: `Bearer ${accessToken}` } : {}),
    },
  };
}

/**
 * The real OS version (`12.7.6`, `10.0.22631`), which the user-agent cannot provide: Chromium
 * freezes macOS at `10_15_7` for every version since Catalina, and reports Windows 10 and 11
 * identically as `Windows NT 10.0`. This is what tells us who is still on an OS an Electron
 * upgrade would strand.
 */
function getOsVersion(): string {
  return process.getSystemVersion();
}

/**
 * `process.arch` reports the architecture of the binary, not the machine, so an x64 build on Apple
 * Silicon reports `x64` whether or not it is being translated. Translation is worth distinguishing:
 * a translated renderer starts an order of magnitude slower than a native one.
 */
function getArch(): string {
  return app.runningUnderARM64Translation === true ? `${process.arch}-translated` : process.arch;
}

function getInstallDescriptor(): string {
  const descriptors = [app.isPackaged ? 'packaged' : 'dev'];
  if (isFreshProfile()) {
    descriptors.push('fresh-profile');
  }
  return descriptors.join(',');
}
