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

// NOTE: this is a copy of the plugin from @nx/vite - current included version (17.2.7) did not work
// copied from master which had additional fixes
// https://github.com/nrwl/nx/blob/master/packages/vite/plugins/rollup-replace-files.plugin.ts
/**
 * @function replaceFiles
 * @param {FileReplacement[]} replacements
 * @return {({name: "rollup-plugin-replace-files", enforce: "pre" | "post" | undefined, Promise<resolveId>})}
 */
export function replaceFiles(replacements: FileReplacement[]): null | {
  name: string;
  enforce: 'pre' | 'post' | undefined;
  resolveId(source: any, importer: any, options: any): Promise<null | { id: string }>;
} {
  if (!replacements?.length) {
    return null;
  }
  return {
    name: 'rollup-plugin-replace-files',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      /**
       * The reason we're using endsWith here is because the resolved id
       * will be the absolute path to the file. We want to check if the
       * file ends with the file we're trying to replace, which will be essentially
       * the path from the root of our workspace.
       */

      const foundReplace = replacements.find((replacement) => resolved?.id?.endsWith(replacement.replace));
      if (foundReplace) {
        console.info(`replace "${foundReplace.replace}" with "${foundReplace.with}"`);
        try {
          // return new file content
          return {
            id: foundReplace.with,
          };
        } catch (err) {
          console.error(err);
          return null;
        }
      }
      return null;
    },
  };
}

export interface FileReplacement {
  replace: string;
  with: string;
}
