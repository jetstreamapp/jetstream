import * as React from 'react';
function SvgOutcome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M626 319l-2-2c-7-7-19-6-25 2l-27 26-1 1c-7 7-7 19 1 25l70 70c2 2 4 5 4 9 0 7-5 13-13 13H368c-10 0-18 8-19 18v38c1 10 9 18 19 20h266c3 0 5 1 7 3 6 4 7 13 2 18l-70 70-1 1c-7 7-7 19 1 25l26 27 1 1c7 7 19 7 25-1l169-169 1-1c7-7 7-19-1-25zm-189 70h37c10 0 19-9 19-19V250c0-28-22-50-50-50H250c-28 0-50 22-50 50v500c0 28 22 50 50 50h193c28 0 50-22 50-50V632c0-10-9-19-19-19h-37c-10 0-19 9-19 19v74c0 10-9 19-19 19H294c-10 0-19-9-19-19V294c0-10 9-19 19-19h105c10 0 19 9 19 19v76c0 10 8 19 19 19z" />
    </svg>
  );
}
export default SvgOutcome;
