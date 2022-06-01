/**
 * @typedef {import('../node_modules/app-builder-lib/out/configuration.js').BeforePackContext} BeforePackContext
 */

/**
 *
 * @param {BeforePackContext} context
 */
async function beforePack(context) {
  // https://github.com/bennymeg/nx-electron/issues/169
  console.warn('Monkey patching file paths');
  context.targets.forEach((target) => {
    target?.packager?.info?._configuration?.files?.forEach((file) => {
      if (file.from) {
        file.from = file.from.replace('${CWD}', process.cwd());
      }
    });
  });
}

exports.default = beforePack;
