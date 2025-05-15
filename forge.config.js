const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
// const {
//   utils: { fromBuildIdentifier },
// } = require('@electron-forge/core');

const path = require('node:path');

const APPLE_ID = process.env.APPLE_ID;
const APPLE_PASSWORD = process.env.APPLE_PASSWORD;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;

if (!APPLE_ID || !APPLE_PASSWORD || !APPLE_TEAM_ID) {
  console.error('Missing Apple ID, password, or team ID. Please set them in your environment variables.');
  process.exit(1);
}

/**
 *
 * @type {import('@electron-forge/shared-types').ForgeConfig}
 */
const config = {
  // buildIdentifier: process.env.IS_BETA ? 'beta' : 'prod',
  packagerConfig: {
    asar: true,
    name: 'Jetstream',
    // appBundleId: fromBuildIdentifier({ beta: 'app.getjetstream.beta', prod: 'app.getjetstream' }),
    appBundleId: 'app.getjetstream',
    appVersion: '1.0.0',
    appCategoryType: 'public.app-category.business',
    appCopyright: `Copyright © ${new Date().getFullYear()} Jetstream Solutions`,
    darwinDarkModeSupport: false,
    osxSign: {},
    osxNotarize: {
      appleId: APPLE_ID,
      appleIdPassword: APPLE_PASSWORD,
      teamId: APPLE_TEAM_ID,
    },
    icon: path.resolve('assets/icons/icon'),
    protocols: [
      {
        name: 'Jetstream Protocol',
        schemes: ['jetstream'],
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    // {
    //   name: '@electron-forge/maker-squirrel',
    //   config: {},
    // },
    {
      name: '@electron-forge/maker-dmg',
      /**
       * @type {import('@electron-forge/maker-dmg').MakerDMGConfig}
       */
      config: {
        format: 'ULFO',
        icon: path.resolve('assets/icons/icon.icns'),
        overwrite: true,
      },
      platforms: ['darwin'],
    },
    // {
    //   name: '@electron-forge/maker-deb',
    //   config: {
    //    "mimeType": ["x-scheme-handler/jetstream"]
    // },
    // },
    // {
    //   name: '@electron-forge/maker-rpm',
    //   config: {},
    // },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};

module.exports = config;
