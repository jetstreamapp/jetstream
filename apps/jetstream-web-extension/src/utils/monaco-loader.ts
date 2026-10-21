import { loader } from '@monaco-editor/react';

const MONACO_VS_PATH = '/assets/js/monaco/vs';

/**
 * Monaco's own worker factory wraps each worker in a blob: script that calls importScripts(), and the extension's Content
 * Security Policy blocks that import, so Monaco would fall back to running its language services on the main thread.
 * The worker scripts are self-contained, so they are started directly from the extension instead. The copy step
 * (scripts/copy-monaco-assets.mjs) writes them without their content hash. Labels follow Monaco's own getWorker mapping.
 */
function getWorker(_workerId: string, label: string) {
  let workerName = 'editor';
  if (label === 'json') {
    workerName = 'json';
  } else if (label === 'css' || label === 'scss' || label === 'less') {
    workerName = 'css';
  } else if (label === 'html' || label === 'handlebars' || label === 'razor') {
    workerName = 'html';
  } else if (label === 'typescript' || label === 'javascript') {
    workerName = 'ts';
  }
  return new Worker(`${MONACO_VS_PATH}/assets/${workerName}.worker.js`, { name: label });
}

loader.config({ paths: { vs: MONACO_VS_PATH } });

loader
  .init()
  .then(async (monaco) => {
    // Loading the editor sets its own MonacoEnvironment, so this has to replace it afterwards, before an editor mounts
    globalThis.MonacoEnvironment = { getWorker };
    // Load all custom configuration
    const jetstreamMonaco = await import('@jetstream/monaco');
    jetstreamMonaco.configure(monaco as unknown as typeof import('monaco-editor'));
  })
  .catch((ex) => {
    console.error('[ERROR] Failed to load monaco editor', ex);
  });
