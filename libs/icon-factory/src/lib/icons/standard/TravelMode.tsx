import * as React from 'react';
function SvgTravelMode(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <mask id="travel_mode_svg__a" height={60} maskUnits="userSpaceOnUse" width={60} x={20} y={20}>
        <path d="M20 20h60v60H20z" fill="unset" fillRule="evenodd" />
      </mask>
      <g mask="url(#travel_mode_svg__a)">
        <path
          d="M53.77 72.12C54 59.88 62.25 50 72.49 50a22.49 22.49 0 01-18.66 22.12M27.49 50C37.75 50 46 59.88 46.16 72.12A22.5 22.5 0 0127.49 50M50 27.51a22.44 22.44 0 0121.12 15H28.88a22.44 22.44 0 0121.12-15M50 20a30 30 0 1030 30 30 30 0 00-30-30"
          fill="unset"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}
export default SvgTravelMode;
