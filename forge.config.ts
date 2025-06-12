import 'dotenv/config';

import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { PublisherS3 } from '@electron-forge/publisher-s3';
import type { ForgeConfig, ForgePackagerOptions } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';

const isDarwin = process.platform == 'darwin';
const isMas = isDarwin && process.argv.some((value) => value.includes('--platform=mas'));

const packagerConfig: ForgePackagerOptions = {
  asar: true,
  name: 'Jetstream',
  appBundleId: 'app.getjetstream',
  appCategoryType: 'public.app-category.business',
  appCopyright: `Copyright © ${new Date().getFullYear()} Jetstream Solutions`,
  icon: path.resolve('assets/icons/icon'),
  ignore: ['.env'],
  protocols: [
    {
      name: 'Jetstream Protocol',
      schemes: ['jetstream'],
    },
  ],
  extendInfo: {
    // TODO: figure out how to do this on Windows
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
};

if (isDarwin) {
  const APPLE_ID = process.env.APPLE_ID;
  const APPLE_PASSWORD = process.env.APPLE_PASSWORD;
  const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
  const PROVISIONING_PROFILE_PATH_DARWIN = path.resolve(
    process.env.PROVISIONING_PROFILE_PATH_DARWIN || '../../build-resources/Jetstream_Mac_App_Profile.provisionprofile'
  );
  const PROVISIONING_PROFILE_PATH_MAS = path.resolve(
    process.env.PROVISIONING_PROFILE_PATH_MAS || '../../build-resources/Jetstream_Mac_App_Store_Profile.provisionprofile'
  );

  if (!APPLE_ID) {
    console.error('Missing APPLE_ID environment variable.');
    process.exit(1);
  }
  if (!APPLE_PASSWORD) {
    console.error('Missing APPLE_PASSWORD environment variable.');
    process.exit(1);
  }
  if (!APPLE_TEAM_ID) {
    console.error('Missing APPLE_TEAM_ID.');
    process.exit(1);
  }

  packagerConfig.darwinDarkModeSupport = false;
  if (isMas) {
    // DEVELOPMENT BUILD
    packagerConfig.osxSign = {
      identity: `Apple Development`,
      provisioningProfile: path.resolve('../../build-resources/JetstreamAppDevelopmentProfile.provisionprofile'),
    };
    // packagerConfig.osxSign = {
    // FIXME: this needs to be "Apple Distribution"
    //   identity: `Apple Distribution: JETSTREAM SOLUTIONS, LLC (${APPLE_TEAM_ID})`,
    //   provisioningProfile: PROVISIONING_PROFILE_PATH_MAS,
    // };
    packagerConfig.osxNotarize = {
      appleId: APPLE_ID,
      appleIdPassword: APPLE_PASSWORD,
      teamId: APPLE_TEAM_ID,
    };
  } else {
    packagerConfig.osxSign = {
      identity: `Developer ID Application: JETSTREAM SOLUTIONS, LLC (${APPLE_TEAM_ID})`,
      provisioningProfile: PROVISIONING_PROFILE_PATH_DARWIN,
    };
    packagerConfig.osxNotarize = {
      appleId: APPLE_ID,
      appleIdPassword: APPLE_PASSWORD,
      teamId: APPLE_TEAM_ID,
    };
  }
}

const config: ForgeConfig = {
  packagerConfig,
  rebuildConfig: {},
  makers: [
    new MakerZIP(
      (arch) => ({
        macUpdateManifestBaseUrl: `https://desktop-updates.s3.us-east-005.backblazeb2.com/jetstream/${arch}`,
      }),
      ['darwin', 'win32']
    ),
    new MakerDMG(
      {
        format: 'ULFO',
        icon: path.resolve('assets/icons/icon.icns'),
        overwrite: true,
      },
      ['darwin']
    ),
    new MakerSquirrel(
      (arch) => ({
        authors: 'Jetstream Solutions, LLC',
        name: 'Jetstream',
        description:
          'The Jetstream platform makes managing your Salesforce instances a breeze. Use Jetstream to work with your data and metadata to get your work done faster.',
        // iconUrl: 'https://getjetstream.app/assets/icons/icon_256x256.png',
        windowsSign: {
          // TODO
        },
        remoteReleases: `https://desktop-updates.s3.us-east-005.backblazeb2.com/jetstream/win32/${arch}`,
        setupIcon: path.resolve('assets/icons/icon.ico'),
        loadingGif: path.resolve('assets/images/jetstream-icon.gif'),
      }),
      ['win32']
    ),
  ],
  publishers: [
    new PublisherS3({
      accessKeyId: process.env.BACKBLAZE_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKBLAZE_SECRET_ACCESS_KEY,
      endpoint: 'https://s3.us-east-005.backblazeb2.com',
      bucket: 'desktop-updates',
      region: 'us-east-005',
      folder: 'jetstream',
      public: true,
    }),
    // new PublisherGithub({
    //   repository: {
    //     owner: 'jetstreamapp',
    //     name: 'jetstream',
    //   },
    //   prerelease: true,
    //   generateReleaseNotes: true,
    //   tagPrefix: 'desktop-v',
    // }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
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
