import * as React from 'react';
function SvgPlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M200 795V205c0-17 22-29 37-15l553 288c13 10 13 32 0 42L237 811c-15 12-37 2-37-16" />
    </svg>
  );
}
export default SvgPlay;
