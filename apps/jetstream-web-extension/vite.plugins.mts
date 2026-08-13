import { replaceFiles } from '@nx/vite/plugins/rollup-replace-files.plugin';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PluginOption } from 'vite';
import { build } from 'vite';

/**
 * The `@nx/vite:build` executor does NOT honor the `fileReplacements` option (that is an
 * Angular/Webpack-builder concept), so we perform the environment swap ourselves based on the
 * build `mode`. Without this every build bundles `environment.ts` (localhost) regardless of config.
 *
 * - development -> environment.ts (localhost, the default — no replacement)
 * - staging     -> environment.staging.ts
 * - production  -> environment.prod.ts
 */
/**
 * Server URL for each build mode. This is the single source of truth used both to swap the
 * `environment` object (via {@link environmentReplacementPlugin}) and to inline
 * `import.meta.env.NX_PUBLIC_SERVER_URL`, which `getWebServerUrl()` reads during app bootstrap.
 * Inlining it here overrides whatever `.env` sets, so a local `NX_PUBLIC_SERVER_URL=localhost`
 * no longer leaks into staging/production builds.
 */
export function getServerUrlForMode(mode: string): string {
  switch (mode) {
    case 'development':
      return 'http://localhost:3333';
    case 'staging':
      return 'https://staging.jetstream-app.com';
    default:
      return 'https://getjetstream.app';
  }
}

export function environmentReplacementPlugin(mode: string): PluginOption {
  // Development uses environment.ts (localhost) as-is, so there is nothing to replace.
  if (mode === 'development') {
    return null;
  }

  const replacement =
    mode === 'staging'
      ? 'apps/jetstream-web-extension/src/environments/environment.staging.ts'
      : 'apps/jetstream-web-extension/src/environments/environment.prod.ts';

  return replaceFiles([
    {
      replace: 'apps/jetstream-web-extension/src/environments/environment.ts',
      with: replacement,
    },
  ]);
}

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
  'permission-analysis',
  'data-analysis',
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
        serviceWorker: resolve(import.meta.dirname, 'src/extension-scripts/service-worker.ts'),
        contentScript: resolve(import.meta.dirname, 'src/extension-scripts/content-script.tsx'),
        contentAuthScript: resolve(import.meta.dirname, 'src/extension-scripts/content-auth-script.ts'),
      };

      const sharedDefine = {
        'globalThis.__IS_BROWSER_EXTENSION__': 'true',
        'import.meta.env.NX_PUBLIC_AMPLITUDE_KEY': JSON.stringify(process.env.NX_PUBLIC_AMPLITUDE_KEY || ''),
        'import.meta.env.NX_PUBLIC_SERVER_URL': JSON.stringify(getServerUrlForMode(mode)),
        'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
      };

      await Promise.all(
        Object.entries(scripts).map(([name, entry]) =>
          build({
            configFile: false,
            envPrefix: 'NX',
            plugins: [
              environmentReplacementPlugin(mode),
              react({
                jsxImportSource: '@emotion/react',
              }),
            ],
            resolve: { tsconfigPaths: true },
            define: sharedDefine,
            build: {
              outDir: resolve(import.meta.dirname, '../../dist/apps/jetstream-web-extension'),
              emptyOutDir: false,
              sourcemap: mode === 'development' ? 'inline' : false,
              minify: mode !== 'development',
              lib: {
                entry,
                formats: ['iife'],
                name,
                fileName: () => `${name}.js`,
              },
              rolldownOptions: {
                output: {
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
      const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'src/manifest.json'), 'utf-8'));
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
