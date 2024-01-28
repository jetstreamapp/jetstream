/* eslint-disable no-inner-declarations */
import { logger } from '@jetstream/shared/client-logger';
// import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import { loader } from '@monaco-editor/react';
// import { join, resolve } from 'path';

const monacoUrl = '/assets/js/monaco/vs';

// Load as static resource instead of bundled in application
// this prevents webpack from needing to process anything
loader.config({ paths: { vs: monacoUrl } });

loader
  .init()
  .then(async (monaco) => {
    // Load all custom configuration
    const jetstreamMonaco = await import('@jetstream/monaco');
    jetstreamMonaco.configure(monaco);
  })
  .catch((ex) => {
    logger.error('[ERROR] Failed to load monaco editor', ex);
    // logErrorToRollbar('Failed to load monaco editor', {
    //   message: ex.message,
    //   stack: ex.stack,
    //   exception: ex,
    // });
  });
