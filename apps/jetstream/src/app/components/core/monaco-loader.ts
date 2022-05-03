/* eslint-disable no-inner-declarations */
import { loader } from '@monaco-editor/react';
// import { join, resolve } from 'path';
import { environment } from '../../../environments/environment';

let monacoUrl = '/assets/js/monaco/vs';

if (environment.isElectron) {
  // monacoUrl = encodeURI(`file://${resolve(join(__dirname, './assets/js/monaco/vs')).replace(/\\/g, '/')}`);
  monacoUrl = './electron-assets/monaco/vs';
}

// Load as static resource instead of bundled in application
// this prevents webpack from needing to process anything
loader.config({ paths: { vs: monacoUrl } });

loader.init().then(async (monaco) => {
  // Load all custom configuration
  const jetstreamMonaco = await import('@jetstream/monaco');
  jetstreamMonaco.configure(monaco);
});
