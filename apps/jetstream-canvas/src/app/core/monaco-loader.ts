import { logger } from '@jetstream/shared/client-logger';
import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import { loader } from '@monaco-editor/react';

loader.config({ paths: { vs: `${window.location.origin}/assets/js/monaco/vs` } });

loader
  .init()
  .then(async (monaco) => {
    // Load all custom configuration
    const jetstreamMonaco = await import('@jetstream/monaco');
    jetstreamMonaco.configure(monaco as unknown as typeof import('monaco-editor'));
  })
  .catch((ex) => {
    logger.error('[ERROR] Failed to load monaco editor', ex);
    logErrorToRollbar('Failed to load monaco editor', {
      message: ex?.message,
      stack: ex?.stack,
      exception: ex,
    });
  });
