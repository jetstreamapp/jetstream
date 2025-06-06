import * as React from 'react';
function SvgIndicatorResult(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M740 800H260c-33 0-60-27-60-60V260c0-33 27-60 60-60h480c33 0 60 27 60 60v480c0 33-27 60-60 60zM281 300v400c0 11 9 20 20 20h399c11 0 20-9 20-20V300c0-11-9-20-20-20H301c-11 0-20 9-20 20zm349 128h-37l16-61v-1c0-2-2-5-5-5h-29c-2 0-4 2-5 4l-16 63h-74l16-61v-1c0-2-2-5-5-5h-29c-2 0-4 2-5 4l-16 63h-41c-2 0-4 1-5 3l-7 28v1c0 2 2 5 5 5h39l-18 71h-40c-2 0-4 1-5 3l-7 28v1c0 2 2 5 5 5h37l-16 62v1c0 2 2 5 5 5h29c2 0 4-1 5-4l16-64h73l-16 60v1c0 2 2 5 5 5h29c2 0 4-1 5-4l16-64h41c2 0 4-1 5-4l7-28v-1c0-2-2-5-5-5h-38l18-71h39c2 0 4-1 5-4l7-28c1-1-1-2-4-2zM527 536h-74l18-71h73z" />
    </svg>
  );
}
export default SvgIndicatorResult;
