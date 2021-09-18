/**
 * For some reason, nrwl cannot compile ag-grid sass starting with version 26.0.0
 * Locally it worked fine, but on render it blew up.
 *
 * https://github.com/ag-grid/ag-grid/issues/4642
 *
 * The solution is to pre-compile everything
 *
 */
const sass = require('sass');
const path = require('path');

const filename = path.join(__dirname, 'data-table-styles.scss');
const outputFilePath = path.join(__dirname, '..', 'libs/ui/src/lib/data-table/data-table-styles.css');

console.log('Compiling sass to css', filename);

sass.renderSync({
  file: filename,
  includePaths: [path.join(__dirname, '..', 'node_modules')],
  outputStyle: 'compressed',
  outFile: outputFilePath,
});

console.log('Finished compiling sass to css', outputFilePath);
