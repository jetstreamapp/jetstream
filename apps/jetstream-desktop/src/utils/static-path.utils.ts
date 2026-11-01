import nodePath from 'node:path';

/** The subset of `node:path` the resolver needs — injectable so both `path.posix` and `path.win32` are testable anywhere */
export type StaticPathImpl = Pick<typeof nodePath, 'resolve' | 'sep'>;

export interface ResolveStaticFilePathOptions {
  /** Directory the static files are served from (the bundle's `__dirname` in production) */
  rootDir: string;
  /** `pathname` of the already-parsed request URL, e.g. `/client/index.html` */
  pathname: string;
  /** Top-level folders under `rootDir` that may be served, e.g. `['assets', 'client']` */
  allowedSubdirs: readonly string[];
  pathImpl?: StaticPathImpl;
}

/**
 * Map a request pathname from the `app://` static protocol onto a file under `rootDir`, or `null`
 * when the request must be refused.
 *
 * The URL has already been parsed, and WHATWG parsing collapses `.`/`..` segments for every scheme,
 * so forward-slash traversal never reaches this function. The one thing the parser does NOT touch
 * for a non-special scheme like `app:` is a backslash: it survives in `pathname`, and on Windows
 * `path.resolve` treats it as a separator, so `/client/..\..\x` would climb out of `rootDir` while
 * still passing a `startsWith('/client/')` check. Hence:
 *
 * - any `\` (raw or percent-encoded) is refused outright — nothing we ship is named with one
 * - any remaining `.`/`..` segment is refused — stricter than necessary, since the parser already
 *   normalised them; a literal one here is not a file we serve
 * - the resolved path must sit INSIDE one of the allowed subfolders (`<root>/<subdir>/...`), so a
 *   sibling that merely shares the prefix (`/clientx/...`) or the subfolder itself is refused
 */
export function resolveStaticFilePath({
  rootDir,
  pathname,
  allowedSubdirs,
  pathImpl = nodePath,
}: ResolveStaticFilePathOptions): string | null {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    return null;
  }
  if (/[\\\0]|%5c|%00/i.test(pathname)) {
    return null;
  }
  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  const resolvedRoot = pathImpl.resolve(rootDir);
  const resolvedPath = pathImpl.resolve(resolvedRoot, `.${pathname}`);
  const isInsideAllowedSubdir = allowedSubdirs.some((subdir) =>
    resolvedPath.startsWith(pathImpl.resolve(resolvedRoot, subdir) + pathImpl.sep),
  );
  return isInsideAllowedSubdir ? resolvedPath : null;
}
