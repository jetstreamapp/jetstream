/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  // Application metadata
  appId: 'app.getjetstream',
  productName: 'Jetstream',
  copyright: `Copyright ©${new Date().getFullYear()} Jetstream Solutions`,

  // Directories
  directories: {
    output: 'dist/desktop-build', // Where the build output is stored
    // buildResources: 'desktop-build', // Resources needed for building
    // app: 'app', // Source directory (where package.json is located)
  },

  // Files to include in the build
  files: [
    {
      from: 'dist/apps/jetstream-desktop/**/*',
      to: '.',
    },
    {
      from: 'dist/apps/jetstream-desktop-client/**/*',
      to: 'client',
    },
    '!package.json',
    // Add any other files you need
  ],

  // forceCodeSigning: true,
  // generateUpdatesFilesForAllChannels: true,

  // TODO:
  icon: 'build/icon.png',

  // The icons/resources used for the application
  extraResources: ['desktop-build/**/*'],

  // macOS specific configuration
  mac: {
    category: 'public.app-category.productivity',
    target: ['dmg', 'zip'],
    icon: 'build/icon.icns',
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // notarize: true,
    // publish: {
    //   provider: 'github',
    //   repo: 'jetstream',
    //   owner: 'yourname',
    //   private: false,
    //   releaseType: 'release',
    // },
  },

  // Windows specific configuration
  // win: {
  //   target: ['nsis', 'msi', 'portable'],
  //   icon: 'build/icon.ico',
  //   // publish: {
  //   //   publisherName: ['Jetstream Solutions'],
  //   // },
  // },

  // NSIS installer configuration (Windows)
  // nsis: {
  //   oneClick: false,
  //   allowToChangeInstallationDirectory: true,
  //   createDesktopShortcut: true,
  //   createStartMenuShortcut: true,
  //   shortcutName: 'Jetstream',
  // },

  // Linux specific configuration
  // linux: {
  //   target: ['AppImage', 'deb', 'rpm'],
  //   category: 'Development',
  //   icon: 'build/icons',
  // },

  // Auto-update configuration
  // publish: {
  //   provider: 'github', // or other providers like 's3', 'spaces', etc.
  //   repo: 'jetstream',
  //   owner: 'yourname',
  //   private: false,
  //   releaseType: 'release',
  // },

  // Configuration for the "afterSign" hook
  // afterSign: 'scripts/notarize.js',

  // Artifacts configuration
  artifactName: '${productName}-${version}-${arch}.${ext}',

  // DMG configuration (macOS)
  dmg: {
    background: 'build/background.png',
    icon: 'build/icon.icns',
    iconSize: 100,
    window: {
      width: 540,
      height: 380,
    },
  },

  // MAS (Mac App Store) configuration
  mas: {
    entitlements: 'build/entitlements.mas.plist',
    entitlementsInherit: 'build/entitlements.mas.inherit.plist',
    provisioningProfile: 'build/embedded.provisionprofile',
  },

  // AppX configuration (Windows Store)
  // appx: {
  //   identityName: 'YourCompany.Jetstream',
  //   publisherDisplayName: 'Your Company',
  //   publisher: 'CN=Your-Publisher-ID',
  //   applicationId: 'Jetstream',
  // },

  // // Snap configuration (Linux)
  // snap: {
  //   confinement: 'strict',
  //   grade: 'stable',
  // },

  // // AppImage configuration (Linux)
  // appImage: {
  //   license: 'LICENSE.md',
  // },

  // Build-time scripts
  beforeBuild: () => console.log('Before build...'),
  // afterBuild: () => console.log('After build...'),
  afterSign: () => console.log('After sign...'),
  afterPack: () => console.log('After pack...'),
  // afterAllArtifactBuild: () => console.log('After all artifact build...'),

  // Build configuration for all platforms
  asar: true, // Whether to use ASAR archive
  compression: 'normal', // Compression level
  removePackageScripts: true, // Remove package.json scripts
};

module.exports = config;
