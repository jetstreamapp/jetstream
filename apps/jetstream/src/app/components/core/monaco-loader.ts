import { logger } from '@jetstream/shared/client-logger';
import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import { loader } from '@monaco-editor/react';

// Load as static resource instead of bundled in application
// this prevents webpack from needing to process anything
// Relative path started causing issues for some workers, such as html
// https://github.com/microsoft/monaco-editor/issues/4778
loader.config({ paths: { vs: `${window.location.origin}/assets/js/monaco/vs` } });

loader
  .init()
  .then(async (monaco) => {
    // Load all custom configuration
    const jetstreamMonaco = await import('@jetstream/monaco');
    jetstreamMonaco.configure(monaco);
  })
  .catch((ex) => {
    logger.error('[ERROR] Failed to load monaco editor', ex);
    logErrorToRollbar('Failed to load monaco editor', {
      message: ex?.message,
      stack: ex?.stack,
      exception: ex,
    });
  });
