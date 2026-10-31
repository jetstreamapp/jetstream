import logger from 'electron-log';
import tls from 'node:tls';

/**
 * Node's TLS clients - the global `fetch` behind every Salesforce API call and the OAuth token exchange - trust
 * only Node's bundled Mozilla CA list. Chromium (app windows, `net.fetch`) trusts the operating system store.
 * Networks that inspect TLS traffic install their inspection CA in the OS store, so without this, Salesforce
 * requests from the main process fail with certificate errors while everything else works.
 *
 * `NODE_EXTRA_CA_CERTS` cannot be the answer: the disabled `enableNodeOptionsEnvironmentVariable` fuse makes
 * Electron drop it, along with `NODE_OPTIONS`.
 *
 * `setDefaultCACertificates` replaces the whole list and only applies to new connections - pooled keep-alive
 * connections keep the trust they were opened with until they close.
 */

let bundledCertificates: string[] | null = null;
let isSystemTrustApplied = false;

export function applySystemCertificateTrust(enabled: boolean) {
  if (enabled === isSystemTrustApplied) {
    return;
  }
  try {
    // Captured before the first change, so turning trust off restores exactly what Node started with
    bundledCertificates ??= tls.getCACertificates('default');
    if (enabled) {
      const systemCertificates = tls.getCACertificates('system');
      tls.setDefaultCACertificates([...bundledCertificates, ...systemCertificates]);
      logger.info(`Trusting ${systemCertificates.length} certificate authorities from the operating system store`);
    } else {
      tls.setDefaultCACertificates(bundledCertificates);
      logger.info('Stopped trusting certificate authorities from the operating system store');
    }
    isSystemTrustApplied = enabled;
  } catch (ex) {
    logger.error('Unable to update trusted certificate authorities', ex);
  }
}
