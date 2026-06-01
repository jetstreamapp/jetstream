import { PluginOption } from 'vite';

const BASE_HREF = '/app';

/**
 * Adds <base href="/app">` to the head of the index.html
 * The reason why the `base` configuration property doesn't work is because it makes
 * all assets served under `/app` of `/` and this impacts the download zip service worker
 * We only want to the service worker to listen to events related to downloads, but not capture any other events
 * and the only way to do this is make sure all assets are served from the root, but we still want our app path to be `/app`
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
