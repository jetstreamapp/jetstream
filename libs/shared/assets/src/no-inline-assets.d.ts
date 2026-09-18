/**
 * The `?no-inline` suffix tells Vite to emit an asset as a real file instead of a base64 data URI,
 * regardless of `build.assetsInlineLimit`. Vite declares this module pattern in `vite/client`, which
 * this library does not pull in (see `tsconfig.lib.json` - `types: []`), so declare the one form we use.
 */
declare module '*.png?no-inline' {
  const src: string;
  export default src;
}
