require('dotenv/config');
const { createRequire } = require('node:module');
const fs = require('node:fs');
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

  const readPackagedJson = (relativePath) => {
    try {
      return JSON.parse(asar.extractFile(asarPath, relativePath).toString('utf-8'));
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

/** @type {Configuration} */
const config = {
  afterPack: verifyAsarDependencyClosure,
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
