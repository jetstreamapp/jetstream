import * as React from 'react';
function SvgTracker(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M15.2 28.4V24c5.1-.9 9-5.4 9-10.8 0-6.1-4.9-11-11-11s-11 4.9-11 11c0 5.4 3.9 9.9 9 10.8v4.4c-5.1.9-9 5.4-9 10.8 0 6.1 4.9 11 11 11s11-4.9 11-11c0-5.4-3.9-9.8-9-10.8zm-9-15.2c0-3.9 3.1-7 7-7s7 3.1 7 7-3.1 7-7 7-7-3-7-7zM30.3 9.2h17.9c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H30.3c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2zM30.3 35.2h17.9c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H30.3c-1.1 0-2-.9-2-2v-4c0-1 .9-2 2-2z" />
      </g>
    </svg>
  );
}
export default SvgTracker;
