import { logger } from '@jetstream/shared/client-logger';
import { tracker } from '@jetstream/shared/ui-utils';
import { loader } from '@monaco-editor/react';

// Load as static resource instead of bundled in application
// this prevents webpack from needing to process anything
// Relative path started causing issues for some workers, such as html
// https://github.com/microsoft/monaco-editor/issues/4778
loader.config({ paths: { vs: `${window.location.origin}/assets/js/monaco/vs` } });

loader
  .init()
  .then(async (monaco) => {
    // Firefox enforces script-src on importScripts() inside blob: workers. With strict-dynamic,
    // 'self' is ignored, so Monaco's default blob: worker factory is blocked in Firefox.
    // Using getWorkerUrl returns direct same-origin file URLs instead, which worker-src 'self'
    // already allows. Worker file paths under language/ use stable (non-hashed) names.
    const vsBase = `${window.location.origin}/assets/js/monaco/vs`;
    globalThis.MonacoEnvironment = {
      getWorkerUrl(_workerId: string, label: string): string {
        if (label === 'json') return `${vsBase}/language/json/json.worker.js`;
        if (label === 'css' || label === 'scss' || label === 'less') return `${vsBase}/language/css/css.worker.js`;
        if (label === 'html' || label === 'handlebars' || label === 'razor') return `${vsBase}/language/html/html.worker.js`;
        if (label === 'typescript' || label === 'javascript') return `${vsBase}/language/typescript/ts.worker.js`;
        return `${vsBase}/editor/editor.worker.js`;
      },
    };
    // Load all custom configuration
    const jetstreamMonaco = await import('@jetstream/monaco');
    jetstreamMonaco.configure(monaco as unknown as typeof import('monaco-editor'));
  })
  .catch((ex) => {
    logger.error('[ERROR] Failed to load monaco editor', ex);
    tracker.error('Failed to load monaco editor', ex);
  });
