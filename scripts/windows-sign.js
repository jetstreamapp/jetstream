const { execSync } = require('node:child_process');

/**
 * @typedef {import('electron-builder').CustomWindowsSignTaskConfiguration} CustomWindowsSignTaskConfiguration
 * @typedef {import('electron-builder').WinPackager} WinPackager
 */

/**
 * Digicert KeyLocker signing script for electron-builder
 * Running `smctl healthcheck` will confirm that the environment is set up correctly, signtool.exe must also show up as successful in the healthcheck
 * Refer to internal documentation on setting up KeyLocker and the signing environment
 *
 * @link https://docs.digicert.com/en/digicert-keylocker/code-signing/sign-with-third-party-signing-tools/windows-applications/sign-executables-with-electron-builder-using-ksp-library.html
 * @link https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/codeSign/windowsSignToolManager.ts
 *
 * @param {CustomWindowsSignTaskConfiguration} configuration
 * @param {WinPackager} packager
 */
exports.default = async function (configuration, packager) {
  try {
    if (!configuration.path) {
      return;
    }

    const output = execSync(`smctl sign --keypair-alias=JETSTREAM_KEY --input "${String(configuration.path)}"`, {
      encoding: 'utf-8',
    });

    // Print output to console for visibility
    console.log(output);

    // The output either has " FAILED" or " SUCCESS" at the end
    // smctl sign --keypair-alias=JETSTREAM_KEY --input C:\..\Jetstream.exe
    // signCommand command for file C:\...\Jetstream.exe was SUCCESSFUL
    if (output.includes('FAILED')) {
      throw new Error(`Signing failed: ${output}`);
    }
  } catch (error) {
    console.error('Error signing file', error);
    throw error;
  }
};
