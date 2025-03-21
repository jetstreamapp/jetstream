import * as React from 'react';
function SvgZoomout(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M190 250h120c6 0 10-4 10-10v-40c0-6-4-10-10-10H190m0 0h-60c-6 0-10 4-10 10v40c0 6 4 10 10 10h60m306 203L381 338A200 200 0 00220 20C110 20 20 110 20 220a200 200 0 00318 161l115 115c6 6 15 6 21 0l21-21c6-6 6-16 1-22zm-276-93c-77 0-140-63-140-140S143 80 220 80s140 63 140 140-63 140-140 140z" />
    </svg>
  );
}
export default SvgZoomout;
