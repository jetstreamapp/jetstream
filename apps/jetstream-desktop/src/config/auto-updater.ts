import { UpdatePolicy, UpdateStatus, UpdateStatusType } from '@jetstream/desktop/types';
import { BrowserWindow } from 'electron';
import logger from 'electron-log';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import isEqual from 'lodash/isEqual';
import { getUserPreferences } from '../services/persistence.service';
import { captureMainException } from './error-tracker';
import { loadUpdatePolicy } from './update-policy';

// Configure logging
autoUpdater.logger = logger;

// Enable auto-download - non-blocking background download
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// State management
let currentUpdateStatus: UpdateStatus = { status: 'idle' };
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between checks to prevent spam

const STARTUP_CHECK_DELAY = 30 * 1000;
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

/** Statuses where a specific update is already being fetched or is sitting ready to install. */
const UPDATE_IN_FLIGHT_STATUSES = new Set<UpdateStatusType>(['available', 'downloading', 'ready']);

let startupCheckTimer: NodeJS.Timeout | undefined;
let periodicCheckTimer: NodeJS.Timeout | undefined;

/** The historical behavior and what an unmanaged machine resolves to - also the fallback when the lookup fails. */
const DEFAULT_UPDATE_POLICY: UpdatePolicy = {
  autoUpdateEnabled: true,
  allowManualCheck: true,
  source: 'default',
  managed: false,
  perMachineInstall: false,
};

/**
 * Null until the policy resolves. Resolution is asynchronous at startup (registry /
 * configuration-profile / file reads), and checks are refused while this is null so a managed
 * install cannot run one through a menu item that is still labelled from the default - on a slow
 * machine those reads are not instantaneous.
 */
let currentUpdatePolicy: UpdatePolicy | null = null;

function sendUpdateStatus(status: UpdateStatus) {
  currentUpdateStatus = status;
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    window.webContents.send('update-status', status);
  });
  logger.info('Update status:', status);
}

export async function initializeAutoUpdater() {
  setupAutoUpdaterListeners();
  try {
    await refreshUpdatePolicy();
  } catch (error) {
    // Never leave checks blocked on a failed lookup. Falling back to the in-memory default is what
    // an unmanaged machine resolves to anyway, and it keeps updates working for ordinary users.
    logger.error('Failed to resolve the update policy, applying defaults:', error);
    applyUpdatePolicy(DEFAULT_UPDATE_POLICY);
  }
}

/**
 * Re-resolve the update policy and reconcile the updater with it. Called at startup and whenever
 * the user changes the in-app setting, so toggling it takes effect without a restart.
 */
export async function refreshUpdatePolicy(): Promise<UpdatePolicy> {
  const policy = await loadUpdatePolicy(getUserPreferences().autoUpdateEnabled);
  applyUpdatePolicy(policy);
  return policy;
}

/** Readers that run before the policy resolves (the menu is built at launch) see the default. */
export function getUpdatePolicy(): UpdatePolicy {
  return currentUpdatePolicy ?? DEFAULT_UPDATE_POLICY;
}

function applyUpdatePolicy(policy: UpdatePolicy) {
  // Every preference save re-resolves the policy, whether or not the update setting was the field
  // that changed. Re-applying an identical policy would reset the four-hour cadence, schedule a
  // fresh startup check, and re-send a `disabled` status over whatever result the user is looking at.
  if (currentUpdatePolicy && isEqual(policy, currentUpdatePolicy)) {
    return;
  }

  currentUpdatePolicy = policy;

  // autoDownload deliberately stays on even when updates are disabled. A download only ever follows
  // a check, and checkForUpdates() is the single gated entry point, so gating checks already gates
  // downloads. Turning it off here instead stranded user-initiated checks on the 'available' status
  // with nothing to download and no button to press.
  autoUpdater.autoDownload = true;

  // A per-machine (all-users) install lives outside the user's profile, so NSIS relaunches the
  // installer elevated to write to it. From the silent install-on-quit path that surfaces as a bare
  // UAC prompt every time the app closes, with nothing on screen explaining it — and a user without
  // admin rights simply cannot answer it, so the same update re-prompts every single day. Updates
  // for these installs only ever run from a deliberate click, where the prompt has context.
  //
  // The user's own "off" does not factor in: it gates checks, not installs, so an update they
  // fetched with a manual check still lands on quit - the UI promises exactly that.
  autoUpdater.autoInstallOnAppQuit = !policy.perMachineInstall;

  // The updater's own two switches are logged alongside the policy because they are what actually
  // decides whether an update downloads and installs - reading the policy alone once hid a bug where
  // autoDownload was off, leaving a found update stranded with nothing to press.
  logger.info('Applying update policy:', policy, {
    autoDownload: autoUpdater.autoDownload,
    autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit,
  });

  clearTimeout(startupCheckTimer);
  clearInterval(periodicCheckTimer);
  startupCheckTimer = undefined;
  periodicCheckTimer = undefined;

  if (!policy.autoUpdateEnabled) {
    // An update already downloading or waiting to install stays offered when the user is the one who
    // turned automatic updates off - they opted out of fetching new ones, not out of installing the
    // one already sitting on their disk. An administrator's "off" does discard it, since they are
    // taking the update path away entirely.
    if (policy.managed || !UPDATE_IN_FLIGHT_STATUSES.has(currentUpdateStatus.status)) {
      sendUpdateStatus({ status: 'disabled', disabledBy: policy.source });
    }
    return;
  }

  startupCheckTimer = setTimeout(() => checkForUpdates(), STARTUP_CHECK_DELAY);
  periodicCheckTimer = setInterval(() => checkForUpdates(), CHECK_INTERVAL);

  // Clear a stale `disabled` status so the UI stops claiming updates are off.
  if (currentUpdateStatus.status === 'disabled') {
    sendUpdateStatus({ status: 'idle' });
  }
}

function setupAutoUpdaterListeners() {
  logger.info('Auto-updater starting...');

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
    sendUpdateStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info('Update available:', info);
    sendUpdateStatus({
      status: 'available',
      version: info.version,
      requiresElevation: getUpdatePolicy().perMachineInstall,
    });
    // Auto-download will start automatically since autoDownload is true
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('Update not available', info);
    sendUpdateStatus({ status: 'up-to-date' });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Error in auto-updater:', err);
    captureMainException(err, { source: 'auto-updater' });
    sendUpdateStatus({
      status: 'error',
      error: err.message || 'Unknown error occurred',
      errorCode: (err as Error & { code?: string }).code,
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage =
      `Download speed: ${progressObj.bytesPerSecond} - ` +
      `Downloaded ${progressObj.percent}% ` +
      `(${progressObj.transferred}/${progressObj.total})`;
    logger.info(logMessage);

    sendUpdateStatus({
      status: 'downloading',
      downloadProgress: {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info('Update downloaded:', info);
    sendUpdateStatus({
      status: 'ready',
      version: info.version,
      requiresElevation: getUpdatePolicy().perMachineInstall,
    });
  });
}

export function checkForUpdates(userInitiated = false) {
  const policy = currentUpdatePolicy;
  if (!policy) {
    logger.info('Skipping update check - the update policy has not resolved yet');
    return;
  }

  if (!policy.allowManualCheck) {
    logger.info('Skipping update check - updates are disabled by policy', policy.source);
    sendUpdateStatus({ status: 'disabled', disabledBy: policy.source });
    return;
  }

  // Automatic checks are what the user turned off; an explicit "Check for Updates" still runs.
  if (!policy.autoUpdateEnabled && !userInitiated) {
    return;
  }

  // Debounce automatic checks to prevent spam
  if (!userInitiated && Date.now() - lastCheckTime < MIN_CHECK_INTERVAL) {
    logger.info('Skipping update check - too soon since last check');
    return;
  }

  lastCheckTime = Date.now();

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      if (result?.updateInfo) {
        logger.info('Update check result:', result.updateInfo.version);
      }
    })
    .catch((error) => {
      logger.error('Update check failed:', error);
      sendUpdateStatus({
        status: 'error',
        error: error.message || 'Failed to check for updates',
        errorCode: (error as Error & { code?: string }).code,
      });
    });
}

export function installUpdate() {
  // A per-machine install has to elevate, so it runs with the installer UI visible - that window is
  // what gives the UAC prompt its context. A per-user install needs neither, so it installs silently
  // and relaunches, matching what quitting the app with a pending update already does. Without this
  // the same update showed the full wizard (EULA, install directory, the lot) when installed from
  // the header button but nothing at all when installed by quitting.
  //
  // isForceRunAfter must be passed explicitly: electron-updater only honors `autoRunAppAfterInstall`
  // on the non-silent path, so a silent install would otherwise never relaunch the app.
  const installSilently = !getUpdatePolicy().perMachineInstall;
  autoUpdater.quitAndInstall(installSilently, true);
}

export function getCurrentUpdateStatus(): UpdateStatus {
  return currentUpdateStatus;
}
