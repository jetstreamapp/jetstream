import { shell } from 'electron';
import log from 'electron-log/main';

/**
 * Schemes that are safe to hand to the OS via shell.openExternal.
 * Everything else (file:, smb:/UNC, and custom-protocol handlers) can be coerced by the OS into
 * launching a local file or another application, so those are blocked.
 */
const EXTERNAL_URL_ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/**
 * Open a URL in the user's default browser, but only if it uses a safe scheme.
 * Use this everywhere instead of calling shell.openExternal directly so a renderer-supplied or
 * server-supplied URL cannot trigger a dangerous scheme.
 */
export function openExternalSafe(rawUrl: string): void {
  try {
    const { protocol } = new URL(rawUrl);
    if (EXTERNAL_URL_ALLOWED_PROTOCOLS.has(protocol)) {
      // Fire-and-forget, but swallow rejections here so a failed OS open cannot become an
      // unhandled promise rejection in the main process and callers don't need to handle it.
      void shell.openExternal(rawUrl).catch((error) => {
        log.warn(`Failed to open external URL: ${error instanceof Error ? error.message : String(error)}`);
      });
    } else {
      log.warn(`Blocked shell.openExternal for disallowed scheme: ${protocol}`);
    }
  } catch {
    log.warn('Blocked shell.openExternal for an invalid URL');
  }
}
