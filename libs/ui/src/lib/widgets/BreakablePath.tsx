import { Fragment } from 'react';

/**
 * A file system path with a line-break opportunity after every separator, so a long path wraps at folder
 * boundaries instead of mid-word. Pair with `overflow-wrap: anywhere` on the container to still cover a single
 * segment that is longer than the line.
 */
export function BreakablePath({ path }: { path: string }) {
  return (
    <>
      {path.split(/(?<=[\\/])/).map((segment, i) => (
        <Fragment key={i}>
          {segment}
          <wbr />
        </Fragment>
      ))}
    </>
  );
}
