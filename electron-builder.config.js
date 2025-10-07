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
  WINDOWS_CERT_SHA1: process.env.WINDOWS_CERT_SHA1,
};

/** @type {Configuration['mac']} */
let macSigningConfig = {
  identity: null,
};

/** @type {Configuration['win']} */
let winSigningConfig = {};

if (ENV.IS_CODESIGNING_ENABLED) {
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
  winSigningConfig = {
    forceCodeSigning: true,
    signtoolOptions: {
      certificateSha1: ENV.WINDOWS_CERT_SHA1,
      signingHashAlgorithms: ['sha256'],
      sign: './windows-sign.js',
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
    '!windows-sign.js',
    '!yarn.lock',
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
    ENV.IS_CODESIGNING_ENABLED && ENV.AWS_ACCESS_KEY_ID && ENV.AWS_SECRET_ACCESS_KEY
      ? [
          {
            provider: 's3',
            // Local testing with MinIO
            // endpoint: 'http://localhost:9000',
            endpoint: 'https://s3.us-east-005.backblazeb2.com',
            bucket: 'desktop-updates',
            path: `jetstream/releases`,
          },
        ]
      : null,

  // Auto-updater configuration
  generateUpdatesFilesForAllChannels: false,
  detectUpdateChannel: false,
};

module.exports = config;
