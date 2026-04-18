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
