import * as React from 'react';
function SvgTracker(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="unset" aria-hidden="true" {...props}>
      <path d="M15.2 28.4V24a11 11 0 00-2-21.8 11 11 0 00-2 21.8v4.4a11 11 0 002 21.8 11 11 0 002-21.8zm-9-15.2a7 7 0 017-7c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3-7-7zm24.1-4h17.9a2 2 0 012 2v4a2 2 0 01-2 2H30.3a2 2 0 01-2-2v-4c0-1.1.9-2 2-2zm0 26h17.9a2 2 0 012 2v4a2 2 0 01-2 2H30.3a2 2 0 01-2-2v-4c0-1 .9-2 2-2z" />
    </svg>
  );
}
export default SvgTracker;
