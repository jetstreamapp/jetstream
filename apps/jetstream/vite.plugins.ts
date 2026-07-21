import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PluginOption } from 'vite';

const BASE_HREF = '/app';

/**
 * Adds `<base href="/app">` to the head of the index.html
 * The reason why the `base` configuration property doesn't work is because it would make
 * all assets served under `/app` instead of `/`. Keeping hashed build assets flat at the
 * origin root while the app itself lives at `/app` preserves historical asset URLs and is
 * what `serviceWorkerPlugin`'s precache worker relies on (it only intercepts root-level
 * hashed assets, never `/app` navigations or `/api` calls).
 *
 * This mimics the same behavior we had with webpack before migrating to vite
 */
export const baseHrefPlugin: () => PluginOption = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <base href="${BASE_HREF}">`);
    },
  };
};

/**
 * Stamps `nonce="__CSP_NONCE__"` onto every <script> and modulepreload <link> emitted into
 * index.html — including Vite's build-injected hashed entry/chunk tags — so they satisfy the
 * strict `script-src 'strict-dynamic' 'nonce-...'` CSP. The API server replaces the
 * `__CSP_NONCE__` placeholder with a fresh per-request nonce before serving the shell.
 *
 * Implemented in `generateBundle` (not `transformIndexHtml`) because Vite injects the hashed
 * entry/modulepreload tags AFTER user `transformIndexHtml` hooks run; only by the bundle-output
 * stage is the final HTML available. Without nonced bundle tags, `'strict-dynamic'` would ignore
 * `'self'`/host allowlists and block the application bundle, white-screening the app.
 */
const addCspNonceToHtml = (html: string): string =>
  html
    .replace(/<script(?![^>]*\snonce=)/g, '<script nonce="__CSP_NONCE__"')
    .replace(/<link(?=[^>]*\brel="modulepreload")(?![^>]*\snonce=)/g, '<link nonce="__CSP_NONCE__"');

export const cspNoncePlugin: () => PluginOption = () => {
  return {
    name: 'csp-nonce-transform',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const output = bundle[fileName];
        if (output.type === 'asset' && fileName.endsWith('.html') && typeof output.source === 'string') {
          output.source = addCspNonceToHtml(output.source);
        }
      }
    },
  };
};

/**
 * Emits `sw.js` - the precache service worker - by injecting the built asset list and a version
 * identifier into `src/sw.template.js` (see that file for the worker's design constraints).
 * The version is the release version (dist/VERSION, written by `generate:version` before builds)
 * plus a hash of the asset list, so every build gets a distinct cache name and dev builds
 * without dist/VERSION still get a content-derived identity.
 */
export const serviceWorkerPlugin: () => PluginOption = () => {
  return {
    name: 'generate-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const precacheManifest = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith('.html') && !fileName.endsWith('.map') && fileName !== 'sw.js')
        .sort()
        .map((fileName) => `/${fileName}`);

      let releaseVersion = 'dev';
      try {
        releaseVersion = readFileSync(join(__dirname, '../../dist/VERSION'), 'utf-8').trim();
      } catch {
        // dist/VERSION only exists when generate:version ran (all production build scripts); content hash still differentiates builds
      }
      const contentHash = createHash('sha256').update(JSON.stringify(precacheManifest)).digest('hex').slice(0, 8);

      const template = readFileSync(join(__dirname, 'src/sw.template.js'), 'utf-8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replaceAll('__SW_VERSION__', `${releaseVersion}-${contentHash}`)
          .replaceAll('__PRECACHE_MANIFEST__', JSON.stringify(precacheManifest)),
      });
    },
  };
};
