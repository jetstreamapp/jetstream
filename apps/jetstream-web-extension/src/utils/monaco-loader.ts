import { logger } from '@jetstream/shared/client-logger';
import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { loader } from '@monaco-editor/react';

// Load as static resource instead of bundled in application
// this prevents webpack from needing to process anything
loader.config({ paths: { vs: '/assets/js/monaco/vs' } });

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
      ...getErrorMessageAndStackObj(ex),
      exception: ex,
    });
  });
