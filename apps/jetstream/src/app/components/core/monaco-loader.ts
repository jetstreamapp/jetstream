import { loader } from '@monaco-editor/react';
// Load as static resource instead of bundled in application
// this prevents webpack from needing to process anything
loader.config({ paths: { vs: '/assets/js/monaco/vs' } });
