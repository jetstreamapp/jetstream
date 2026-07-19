require('dotenv/config');
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

/** @type {Configuration} */
const config = {
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
