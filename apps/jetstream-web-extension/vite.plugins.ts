import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PluginOption } from 'vite';
import { build } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const PLACEHOLDER_PAGES = [
  'home',
  'org-groups',
  'query',
  'load',
  'load-multiple-objects',
  'update-records',
  'create-record',
  'automation-control',
  'permissions-manager',
  'deploy-metadata',
  'create-fields',
  'formula-evaluator',
  'record-type-manager',
  'apex',
  'debug-logs',
  'object-export',
  'salesforce-api',
  'platform-event-monitor',
  'feedback',
  'profile',
  'settings',
];

/**
 * Build extension scripts (service worker, content scripts) as self-contained IIFE bundles.
 * These must be single files with no code splitting since Chrome extensions
 * require standalone scripts for service workers and content scripts.
 */
export function extensionScriptsBuildPlugin(mode: string): PluginOption {
  return {
    name: 'build-extension-scripts',
    apply: 'build',
    async closeBundle() {
      const scripts: Record<string, string> = {
        serviceWorker: resolve(__dirname, 'src/extension-scripts/service-worker.ts'),
        contentScript: resolve(__dirname, 'src/extension-scripts/content-script.tsx'),
        contentAuthScript: resolve(__dirname, 'src/extension-scripts/content-auth-script.ts'),
      };

      const sharedDefine = {
        'globalThis.__IS_BROWSER_EXTENSION__': 'true',
        'import.meta.env.NX_PUBLIC_AMPLITUDE_KEY': JSON.stringify(process.env.NX_PUBLIC_AMPLITUDE_KEY || ''),
        'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
      };

      await Promise.all(
        Object.entries(scripts).map(([name, entry]) =>
          build({
            configFile: false,
            envPrefix: 'NX',
            plugins: [
              react({
                jsxImportSource: '@emotion/react',
                babel: { plugins: ['@emotion/babel-plugin'] },
              }),
              nxViteTsPaths(),
            ],
            define: sharedDefine,
            build: {
              outDir: resolve(__dirname, '../../dist/apps/jetstream-web-extension'),
              emptyOutDir: false,
              sourcemap: mode === 'development' ? 'inline' : false,
              minify: mode === 'development' ? false : 'esbuild',
              lib: {
                entry,
                formats: ['iife'],
                name,
                fileName: () => `${name}.js`,
              },
              rollupOptions: {
                output: {
                  inlineDynamicImports: true,
                  // Give CSS a predictable name based on the entry (e.g. contentScript.css)
                  assetFileNames: `${name}.[ext]`,
                },
              },
            },
          }),
        ),
      );
    },
  };
}

/**
 * Transform manifest.json with environment-specific host permissions.
 * Development adds localhost, staging adds the staging URL.
 */
export function manifestTransformPlugin(mode: string): PluginOption {
  return {
    name: 'transform-manifest',
    apply: 'build',
    generateBundle() {
      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'src/manifest.json'), 'utf-8'));
      const contentAuthScript = manifest.content_scripts.find((item: { js: string[] }) => item.js.includes('contentAuthScript.js'));

      const additionalHosts: string[] = [];
      if (mode === 'development') {
        additionalHosts.push('http://localhost/*');
      } else if (mode === 'staging') {
        additionalHosts.push('https://staging.jetstream-app.com/web-extension/*');
      }

      if (additionalHosts.length > 0) {
        contentAuthScript.matches.push(...additionalHosts);
        manifest.host_permissions.push(...additionalHosts);
      }

      // Note: contentScript.css is also emitted during build (from SCSS imports).
      // It is NOT added to manifest content_scripts because the content script relies on
      // Salesforce's own SLDS styles + Emotion CSS-in-JS for styling.

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}

/**
 * Generate placeholder HTML pages that redirect to app.html.
 * These handle the case where a user opens a deep link in a new tab.
 */
export function placeholderHtmlPlugin(): PluginOption {
  return {
    name: 'generate-placeholder-pages',
    apply: 'build',
    generateBundle() {
      const template = `<!doctype html>
<html>
  <script src="redirect.js"></script>
</html>
`;
      for (const page of PLACEHOLDER_PAGES) {
        this.emitFile({
          type: 'asset',
          fileName: `${page}.html`,
          source: template,
        });
      }
    },
  };
}
