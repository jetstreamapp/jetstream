import { loader } from '@monaco-editor/react';

loader.config({ paths: { vs: '/assets/js/monaco/vs' } });

loader
  .init()
  .then(async (monaco) => {
    // Load all custom configuration
    const jetstreamMonaco = await import('@jetstream/monaco');
    jetstreamMonaco.configure(monaco as any);
  })
  .catch((ex) => {
    console.error('[ERROR] Failed to load monaco editor', ex);
  });
