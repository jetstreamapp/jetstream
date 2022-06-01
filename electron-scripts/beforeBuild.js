exports.default = async function (context) {
  // your custom code
  console.warn('BEFORE BUILD!');
  // TODO: add in full paths - update github ticket with workaround
  context.targets.forEach((target) => {
    target?.packager?.info?._configuration?.files?.forEach((file) => {
      if (file.from) {
        file.from = file.from.replace('${CWD}', process.cwd());
      }
    });
  });
};
