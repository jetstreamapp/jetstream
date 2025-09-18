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

const ENV = {
  IS_CODESIGNING_ENABLED: process.env.IS_CODESIGNING_ENABLED === 'true',
  APPLE_ID: process.env.APPLE_ID,
  APPLE_PASSWORD: process.env.APPLE_PASSWORD,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  PROVISIONING_PROFILE_PATH_DARWIN: process.env.PROVISIONING_PROFILE_PATH_DARWIN,
  PROVISIONING_PROFILE_PATH_MAS: process.env.PROVISIONING_PROFILE_PATH_MAS,
  BACKBLAZE_ACCESS_KEY_ID: process.env.BACKBLAZE_ACCESS_KEY_ID,
  BACKBLAZE_SECRET_ACCESS_KEY: process.env.BACKBLAZE_SECRET_ACCESS_KEY,
};

const windowsSign: ForgePackagerOptions['windowsSign'] = {
  signToolPath: 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe',
  signWithParams: '/sha1 6526a53309171bf43d3321cee5719c06b2ba28e9',
  timestampServer: 'http://timestamp.digicert.com',
  hashes: ['sha256' as any],
};

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
  windowsSign: ENV.IS_CODESIGNING_ENABLED ? windowsSign : undefined,
  junk: true,
  overwrite: true,
  prune: true,
};

if (isDarwin && ENV.IS_CODESIGNING_ENABLED) {
  const APPLE_ID = ENV.APPLE_ID;
  const APPLE_PASSWORD = ENV.APPLE_PASSWORD;
  const APPLE_TEAM_ID = ENV.APPLE_TEAM_ID;
  const PROVISIONING_PROFILE_PATH_DARWIN = path.resolve(
    ENV.PROVISIONING_PROFILE_PATH_DARWIN || '../../build-resources/Jetstream_Mac_App_Profile.provisionprofile',
  );
  const PROVISIONING_PROFILE_PATH_MAS = path.resolve(
    ENV.PROVISIONING_PROFILE_PATH_MAS || '../../build-resources/Jetstream_Mac_App_Store_Profile.provisionprofile',
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
        macUpdateManifestBaseUrl: `https://releases.getjetstream.app/jetstream/macos/${arch}`,
      }),
      ['darwin', 'win32'],
    ),
    new MakerDMG(
      {
        format: 'ULFO',
        icon: path.resolve('assets/icons/icon.icns'),
        overwrite: true,
      },
      ['darwin'],
    ),
    new MakerSquirrel(
      (arch) => ({
        name: 'Jetstream',
        authors: 'Jetstream Solutions, LLC',
        exe: 'jetstream.exe',
        noMsi: true,
        description:
          'The Jetstream platform makes managing your Salesforce instances a breeze. Use Jetstream to work with your data and metadata to get your work done faster.',
        // iconUrl: 'https://getjetstream.app/assets/icons/icon_256x256.png',
        setupIcon: path.resolve('assets/icons/icon.ico'),
        loadingGif: path.resolve('assets/images/jetstream-icon.gif'),
        windowsSign: ENV.IS_CODESIGNING_ENABLED ? (windowsSign as any) : undefined,
        remoteReleases: `https://releases.getjetstream.app/jetstream/windows/${arch}`,
        noDelta: true,
      }),
      ['win32'],
    ),
  ],
  publishers: [
    new PublisherS3({
      accessKeyId: ENV.BACKBLAZE_ACCESS_KEY_ID,
      secretAccessKey: ENV.BACKBLAZE_SECRET_ACCESS_KEY,
      bucket: 'desktop-updates',
      endpoint: `https://s3.us-east-005.backblazeb2.com`,
      region: 'us-east-005',
      folder: 'jetstream',
      public: true,
      keyResolver: (filename: string, platform: string, arch: string) => {
        if (platform == 'win32') {
          platform = 'windows';
        }
        if (platform == 'darwin') {
          platform = 'macos';
        }
        return `jetstream/${platform}/${arch}/${filename}`;
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};

module.exports = config;
