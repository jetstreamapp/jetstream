import * as React from 'react';
function SvgAttach(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M176 367c6 6 15 5 21 0l100-100a20 20 0 0128 0c9 8 8 22 0 30L202 418a70 70 0 01-99 0l-1-1a70 70 0 010-99l217-217a70 70 0 0199 0l1 1a70 70 0 010 99l-1 1c-5 5-6 12-2 18a150 150 0 0114 35c2 8 11 10 17 5l15-16a131 131 0 000-185h-2a131 131 0 00-185 0L58 275a131 131 0 000 185l2 2a130 130 0 00184 0l124-123a81 81 0 10-117-113l-98 98c-6 6-6 16 0 22z" />
    </svg>
  );
}
export default SvgAttach;
