import * as React from 'react';
function SvgOperatingHours(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M53 50.18a1.32 1.32 0 01-.35-1v-8.43a1.35 1.35 0 00-1.32-1.32h-2.61a1.35 1.35 0 00-1.32 1.32v10.66a1.85 1.85 0 00.35 1l6.52 6.52a1.28 1.28 0 001.85 0L58 57a1.28 1.28 0 000-1.85z"
        fill="unset"
        fillRule="evenodd"
      />
      <path
        d="M50 28.86A21.14 21.14 0 1071.18 50 21.2 21.2 0 0050 28.86zm0 37A15.85 15.85 0 1165.9 50 15.9 15.9 0 0150 65.85z"
        fill="unset"
        fillRule="evenodd"
      />
      <path
        d="M28.82 59.91a15.74 15.74 0 010-19.81L25.31 36a21 21 0 000 27.94zM71.23 40.12a15.74 15.74 0 010 19.81L74.64 64a21 21 0 000-27.94z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgOperatingHours;
