import * as React from 'react';
function SvgCaseWrapUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M37.2 30.1h4a.94.94 0 001-1v-3H58v3a.94.94 0 001 1h4a.94.94 0 001-1v-3a6 6 0 00-6-6H42.2a6 6 0 00-6 6v3a.94.94 0 001 1zM74 36.1H26.2a6 6 0 00-6 6v31.8a6 6 0 006 6H74a6 6 0 006-6V42.1a6.15 6.15 0 00-6-6zm-8.7 16.1L47.9 69.6a3.38 3.38 0 01-4.8 0l-8.4-8.4a1.63 1.63 0 010-2.4l2.4-2.4a1.63 1.63 0 012.4 0l6 6 15-15a1.63 1.63 0 012.4 0l2.4 2.4a1.82 1.82 0 010 2.4z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgCaseWrapUp;
