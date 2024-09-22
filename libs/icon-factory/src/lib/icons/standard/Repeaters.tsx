import * as React from 'react';
function SvgRepeaters(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M200 269c0-20 16-36 36-36h528c20 0 36 16 36 36v240c0 20-16 36-36 36H236c-20 0-36-16-36-36zm90 360c0-16 13-30 30-30h348a30 30 0 110 60H320c-16 0-30-13-30-30zm102 78a30 30 0 100 60h204a30 30 0 100-60z" />
    </svg>
  );
}
export default SvgRepeaters;
