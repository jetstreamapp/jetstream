import * as React from 'react';
function SvgPhoto(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M360 310h280c8 0 13-9 8-15l-33-51a60 60 0 00-54-33H439c-23 0-44 13-54 33l-33 51c-5 6 0 15 8 15zm140 180c-44 0-80 36-80 80s36 80 80 80 80-36 80-80-36-80-80-80zm240-120H260c-33 0-60 27-60 60v280c0 33 27 60 60 60h480c33 0 60-27 60-60V430c0-33-27-60-60-60zM500 710c-77 0-140-63-140-140s63-140 140-140 140 63 140 140-63 140-140 140z" />
    </svg>
  );
}
export default SvgPhoto;
