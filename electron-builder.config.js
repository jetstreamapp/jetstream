require('dotenv/config');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** @typedef {import('electron-builder').Configuration} Configuration */

const ENV = {
  IS_CODESIGNING_ENABLED: process.env.IS_CODESIGNING_ENABLED === 'true',
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  PROVISIONING_PROFILE_PATH_DARWIN: process.env.PROVISIONING_PROFILE_PATH_DARWIN,
  PROVISIONING_PROFILE_PATH_MAS: process.env.PROVISIONING_PROFILE_PATH_MAS,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
};

/**
 * Fail fast with a clear message when signing is enabled but credentials are
 * missing, instead of failing deep inside electron-builder's signing step.
 */
function assertRequiredEnvVars(platform, requiredKeys) {
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);
  if (missingKeys.length > 0) {
    throw new Error(`Code signing is enabled for ${platform} but these environment variables are missing: ${missingKeys.join(', ')}`);
  }
}

/** @type {Configuration['mac']} */
let macSigningConfig = {
  identity: null,
};

/** @type {Configuration['win']} */
let winSigningConfig = {};

// Only configure (and validate) signing for the platform actually being built.
// Each platform is built on its own runner, so process.platform is the target.
if (ENV.IS_CODESIGNING_ENABLED && process.platform === 'darwin') {
  assertRequiredEnvVars('macOS', ['APPLE_TEAM_ID', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']);
  macSigningConfig = {
    forceCodeSigning: true,
    identity: `JETSTREAM SOLUTIONS, LLC (${ENV.APPLE_TEAM_ID})`,
    provisioningProfile: path.resolve(
      ENV.PROVISIONING_PROFILE_PATH_DARWIN || '../../build-resources/Jetstream_Mac_App_Profile.provisionprofile',
    ),
    // Relies on env vars: APPLE_API_KEY, APPLE_API_KEY_ID and APPLE_API_ISSUER
    // https://github.com/electron/notarize
    notarize: true,
    requirements: null,
    signIgnore: null,
  };
}

if (ENV.IS_CODESIGNING_ENABLED && process.platform === 'win32') {
  assertRequiredEnvVars('Windows', ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']);
  winSigningConfig = {
    forceCodeSigning: true,
    azureSignOptions: {
      publisherName: 'Jetstream Solutions, LLC',
      endpoint: 'https://eus.codesigning.azure.net',
      certificateProfileName: 'jetstream-certificate-profile',
      codeSigningAccountName: 'jetstream-desktop',
    },
  };
}

/**
 * `@electron/asar` is not a direct dependency of the build dir — resolve it through
 * electron-builder -> app-builder-lib, which always ships a compatible version.
 */
function resolveElectronAsar() {
  const requireFromElectronBuilder = createRequire(require.resolve('electron-builder/package.json'));
  const requireFromAppBuilderLib = createRequire(requireFromElectronBuilder.resolve('app-builder-lib/package.json'));
  return requireFromAppBuilderLib('@electron/asar');
}

/**
 * Fail the build if the packaged app.asar is missing any module in the production dependency
 * closure. electron-builder's pnpm collector (<= 26.15.x) can silently drop a transitive
 * dependency when pnpm's `list --json` output only expands it beneath a deduped subtree — it
 * logs warn-level "cannot find path for dependency" / "unresolved duplicate dependency
 * references" lines and keeps going. Desktop 4.12.0 shipped without `supports-color` (required
 * by chalk@4) that way and crashed on startup on every install. This hook turns that class of
 * silent packaging corruption into a hard build failure.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
async function verifyAsarDependencyClosure(context) {
  const asar = resolveElectronAsar();

  const resourcesDir =
    context.electronPlatformName === 'darwin' || context.electronPlatformName === 'mas'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  if (!fs.existsSync(asarPath)) {
    throw new Error(`afterPack dependency verification: app.asar not found at ${asarPath}`);
  }

  // Normalize the archive listing to posix-style paths without a leading slash.
  const packagedFiles = new Set(asar.listPackage(asarPath).map((entry) => entry.split(path.sep).join('/').replace(/^\//, '')));

  // @electron/asar resolves archive paths by splitting on path.sep, so the posix-style paths
  // used throughout this walk must be converted to backslashes on Windows before extraction —
  // with forward slashes the lookup silently misses and every read appears to fail.
  const readPackagedJson = (relativePath) => {
    try {
      return JSON.parse(asar.extractFile(asarPath, relativePath.split('/').join(path.sep)).toString('utf-8'));
    } catch {
      // Files excluded from the archive via asarUnpack live next to it on disk.
      const unpackedPath = path.join(resourcesDir, 'app.asar.unpacked', relativePath);
      if (fs.existsSync(unpackedPath)) {
        return JSON.parse(fs.readFileSync(unpackedPath, 'utf-8'));
      }
      return null;
    }
  };

  // Resolve a dependency the way Node does: nearest nested node_modules first, then walk up.
  const resolvePackagedDependency = (dependentDir, depName) => {
    let currentDir = dependentDir;
    while (true) {
      const candidate = currentDir === '' ? `node_modules/${depName}` : `${currentDir}/node_modules/${depName}`;
      if (packagedFiles.has(`${candidate}/package.json`)) {
        return candidate;
      }
      if (currentDir === '') {
        return null;
      }
      const parent = currentDir.split('/').slice(0, -1).join('/');
      currentDir = parent === currentDir ? '' : parent;
    }
  };

  const rootPackageJson = readPackagedJson('package.json');
  if (!rootPackageJson) {
    throw new Error('afterPack dependency verification: could not read package.json from app.asar');
  }

  const missing = [];
  const visited = new Set();
  const queue = Object.keys(rootPackageJson.dependencies ?? {}).map((depName) => ({ depName, dependentDir: '', optional: false }));

  while (queue.length > 0) {
    const { depName, dependentDir, optional } = queue.shift();
    const packageDir = resolvePackagedDependency(dependentDir, depName);
    if (packageDir == null) {
      // Optional dependencies (e.g. platform-specific binaries) are legitimately absent.
      if (!optional) {
        missing.push(`${depName} (required by ${dependentDir || 'the app'})`);
      }
      continue;
    }
    if (visited.has(packageDir)) {
      continue;
    }
    visited.add(packageDir);

    const packageJson = readPackagedJson(`${packageDir}/package.json`);
    if (!packageJson) {
      throw new Error(`afterPack dependency verification: could not read ${packageDir}/package.json from app.asar`);
    }
    const optionalDeps = packageJson.optionalDependencies ?? {};
    for (const childName of Object.keys({ ...packageJson.dependencies, ...optionalDeps })) {
      queue.push({ depName: childName, dependentDir: packageDir, optional: childName in optionalDeps });
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `app.asar is missing ${missing.length} production dependenc${missing.length === 1 ? 'y' : 'ies'}: ${missing.join(', ')}. ` +
        `electron-builder's node-module collector dropped them (look for "cannot find path for dependency" warnings above). ` +
        `The packaged app would crash at runtime with "Cannot find module".`,
    );
  }
  console.log(`afterPack dependency verification passed: ${visited.size} packaged modules, dependency closure complete`);
}

// Generous because the x64 slice runs under Rosetta 2 on GitHub's arm64 macOS runners, where
// first-launch binary translation of the Electron framework alone can take well over a minute
// (the 4.13.0 release run needed ~80s just to reach "App starting..."). The app's own renderer
// timer (smoke-test.ts, 180s) starts later — at window creation — and catches post-boot hangs
// with a specific message; this outer timer is the backstop for a failure to boot at all. Keep
// it comfortably larger than boot time + the in-app timer so the inner one always fires first.
const SMOKE_TEST_LAUNCH_TIMEOUT_MS = 420_000;

/**
 * Launch the freshly packaged app binary with `--smoke-test` and require it to boot to a fully
 * loaded renderer before publishing (see apps/jetstream-desktop/src/config/smoke-test.ts for the
 * in-app side). This is the runtime complement to verifyAsarDependencyClosure above: the static
 * walk proves every module is *present*, this proves the artifact actually *starts* — catching
 * broken native modules, bad env inlining, missing client assets, or anything else that only
 * fails at runtime.
 *
 * Runs per platform+arch from afterPack, which is before signing/notarization and before any
 * upload, so a broken build can never reach the release feed. Launching the not-yet-signed app
 * directly is fine on both platforms (Gatekeeper only gates quarantined downloads).
 *
 * On arm64 macOS hosts the x64 slice runs under Rosetta 2 (installed on GitHub's macOS runners).
 * Set SKIP_PACKAGED_SMOKE_TEST=true to bypass on machines that can't execute a foreign arch or
 * have no display.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
async function smokeTestPackagedApp(context) {
  if (process.env.SKIP_PACKAGED_SMOKE_TEST === 'true') {
    console.warn('packaged smoke test: skipped via SKIP_PACKAGED_SMOKE_TEST');
    return;
  }

  const productFilename = context.packager.appInfo.productFilename;
  let executablePath;
  if (context.electronPlatformName === 'darwin') {
    executablePath = path.join(context.appOutDir, `${productFilename}.app`, 'Contents', 'MacOS', productFilename);
  } else if (context.electronPlatformName === 'win32') {
    executablePath = path.join(context.appOutDir, `${productFilename}.exe`);
  } else {
    console.warn(`packaged smoke test: no launcher for platform ${context.electronPlatformName}, skipping`);
    return;
  }
  if (!fs.existsSync(executablePath)) {
    throw new Error(`packaged smoke test: executable not found at ${executablePath}`);
  }

  // An isolated userData dir keeps the run hermetic: no state from a previous run or a locally
  // installed Jetstream, and no single-instance-lock collision with one already running.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jetstream-smoke-test-'));

  console.log(`packaged smoke test: launching ${executablePath}`);
  try {
    await new Promise((resolve, reject) => {
      // The runAsNode fuse is enabled, so an inherited ELECTRON_RUN_AS_NODE (set by e.g. VSCode
      // terminals) would make the app run as plain Node and crash before Electron even starts.
      // NODE_OPTIONS (set in CI) is dropped too: the enableNodeOptionsEnvironmentVariable fuse is
      // disabled, so Electron would just log a loud startup error about it on every launch.
      const { ELECTRON_RUN_AS_NODE, NODE_OPTIONS, ...spawnEnv } = process.env;
      const child = spawn(executablePath, [`--user-data-dir=${userDataDir}`, '--smoke-test'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: spawnEnv,
      });

      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, SMOKE_TEST_LAUNCH_TIMEOUT_MS);

      // Mirror the app's [SMOKE TEST] output (and any crash spew) into the build log.
      child.stdout.on('data', (data) => process.stdout.write(data));
      child.stderr.on('data', (data) => process.stderr.write(data));

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`packaged smoke test: failed to launch ${executablePath}: ${error.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (timedOut) {
          reject(new Error(`packaged smoke test: app did not exit within ${SMOKE_TEST_LAUNCH_TIMEOUT_MS / 1000}s and was killed`));
        } else if (code !== 0) {
          reject(new Error(`packaged smoke test: app exited with code ${code} - the packaged build is broken at startup`));
        } else {
          console.log('packaged smoke test: passed');
          resolve(undefined);
        }
      });
    });
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
async function afterPack(context) {
  await verifyAsarDependencyClosure(context);
  await smokeTestPackagedApp(context);
}

/** @type {Configuration} */
const config = {
  afterPack,
  appId: 'app.getjetstream',
  productName: 'Jetstream',
  copyright: `Copyright © ${new Date().getFullYear()} Jetstream Solutions`,

  directories: {
    output: 'out',
    buildResources: 'assets',
  },

  files: [
    '**/*',
    '!.env',
    '!**/*.map',
    '!**/*.ts',
    '!electron-builder.config.js',
    '!pnpm-lock.yaml',
    '!node_modules/.cache',
    '!node_modules/.prisma',
  ],

  electronFuses: {
    runAsNode: true,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },

  asar: true,
  compression: ENV.IS_CODESIGNING_ENABLED ? 'store' : 'normal',
  npmRebuild: true,
  nodeGypRebuild: false,

  // macOS Configuration
  mac: {
    category: 'public.app-category.business',
    icon: 'assets/icons/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    darkModeSupport: false,
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'CSV File',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: ['public.comma-separated-values-text'],
          CFBundleTypeExtensions: ['csv'],
        },
        {
          CFBundleTypeName: 'Excel File',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: ['org.openxmlformats.spreadsheetml.sheet'],
          CFBundleTypeExtensions: ['xlsx'],
        },
      ],
    },
    ...macSigningConfig,
  },

  // Windows Configuration
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] }, // Allows installing for user or for all users
      { target: 'portable', arch: ['x64'] }, // For restricted enterprise environments - does not require installation
    ],
    icon: 'assets/icons/icon.png',
    legalTrademarks: 'Jetstream Solutions, LLC',
    ...winSigningConfig,
  },

  // NSIS Installer Configuration (replaces both WiX and Squirrel)
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    license: 'DESKTOP_EULA.md',
    warningsAsErrors: false,
    createStartMenuShortcut: true,
    shortcutName: 'Jetstream',
    deleteAppDataOnUninstall: false,
    differentialPackage: false, // Enable delta updates
    include: 'assets/installer.nsh',
    runAfterFinish: true, // Auto-restart app after successful installation
  },

  // Portable app for restricted environments
  portable: {
    requestExecutionLevel: 'user',
    unpackDirName: 'jetstream-portable',
    /**
     * Pinned to what electron-builder's default template already produces ("Jetstream 4.14.0.exe").
     * The portable build is not listed in latest.yml, so the download API reconstructs this name
     * from the release version (apps/api/src/app/services/desktop-asset.service.ts) — changing it
     * here without changing it there makes the portable download 404.
     */
    artifactName: '${productName} ${version}.${ext}',
  },

  // Protocol Handlers
  protocols: [
    {
      name: 'Jetstream Protocol',
      schemes: ['jetstream'],
    },
  ],

  publish:
    ENV.IS_CODESIGNING_ENABLED && ENV.AWS_ACCESS_KEY_ID && ENV.AWS_SECRET_ACCESS_KEY && ENV.AWS_ENDPOINT_URL
      ? [
          // Primary feed clients read from — a subdomain we control, decoupled from any
          // storage vendor. Backed by Cloudflare R2.
          {
            provider: 'generic',
            url: 'https://release-updates.getjetstream.app/jetstream/releases',
            /**
             * The auto-updater validates the publisher names exactly and will fail if they don't match.
             *
             * Azure: Jetstream Solutions, LLC
             * Digicert: JETSTREAM SOLUTIONS, LLC
             */
            publisherName: ['Jetstream Solutions, LLC', 'JETSTREAM SOLUTIONS, LLC'],
          },
          // Used for publishing, clients always use the first entry (generic provider above)
          {
            provider: 's3',
            endpoint: ENV.AWS_ENDPOINT_URL,
            bucket: 'desktop-updates',
            path: `jetstream/releases`,
            region: 'auto',
            acl: null,
          },
        ]
      : null,

  // Auto-updater configuration
  generateUpdatesFilesForAllChannels: false,
  detectUpdateChannel: false,
};

module.exports = config;
