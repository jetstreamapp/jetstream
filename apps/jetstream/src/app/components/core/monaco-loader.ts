import { loader } from '@monaco-editor/react';
// Load as static resource instead of bundled in application
// this prevents webpack from needing to process anything
loader.config({ paths: { vs: '/assets/js/monaco/vs' } });

loader.init().then(async (monaco) => {
  // Load all custom configuration
  const jetstreamMonaco = await import('@jetstream/monaco');
  jetstreamMonaco.configure(monaco);
});
