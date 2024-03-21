import * as React from 'react';
function SvgTruck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M49.55 23.68l-5.85-5.86a1.52 1.52 0 00-1.05-.44H36.5a1.5 1.5 0 00-1.5 1.5v12a.74.74 0 001 .67 8.84 8.84 0 013.45-.67 9.05 9.05 0 017.88 4.65.76.76 0 001.12.22A4.58 4.58 0 0050 32.38v-7.66a1.45 1.45 0 00-.45-1.04z"
        fill="unset"
      />
      <circle cx={39.5} cy={39.88} r={4.5} fill="unset" />
      <path
        d="M29 10.62H3.5a1.5 1.5 0 00-1.5 1.5v20.26a4.58 4.58 0 001.5 3.37.72.72 0 001.12-.22 9 9 0 0116.2.9.74.74 0 00.68.45H26a4.52 4.52 0 004.5-4.5V12.12a1.51 1.51 0 00-1.5-1.5z"
        fill="unset"
      />
      <circle cx={12.5} cy={39.88} r={4.5} fill="unset" />
    </svg>
  );
}
export default SvgTruck;
