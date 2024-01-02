import * as React from 'react';
function SvgRtcPresence(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M61.55 19.75c-11.12 0-20.22 8.64-20.22 19.3a18.75 18.75 0 002.57 9.47 1.58 1.58 0 01.18 1.1l-1.93 6.16a1.37 1.37 0 001.75 1.75l5.88-2.11a1.5 1.5 0 011.1.09 20.77 20.77 0 0010.66 2.85c11.12 0 20.22-8.64 20.22-19.3s-9.09-19.31-20.21-19.31zM45.8 76.21v1.29a2.77 2.77 0 01-2.8 2.75H21a2.77 2.77 0 01-2.76-2.76v-1.28c0-3.35 3.91-5.38 7.58-7a1.38 1.38 0 00.37-.18.85.85 0 01.87 0 9 9 0 005 1.52 9.36 9.36 0 005-1.47.85.85 0 01.87 0 1.38 1.38 0 01.37.18c3.59 1.57 7.5 3.59 7.5 6.95z"
        fill="unset"
      />
      <ellipse cx={32.01} cy={60.26} rx={6.85} ry={7.58} fill="unset" />
    </svg>
  );
}
export default SvgRtcPresence;
