import * as React from 'react';
function SvgPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M49.5 15.4L36 1.9c-1.4-1.4-3.6-1.4-5 0s-1.4 3.6 0 5l.7.7-16.2 10.7-.5-.5c-1.4-1.4-3.6-1.4-5 0s-1.4 3.6 0 5l7.2 7.2L2.4 44.8c-1.4 1.4-1.4 3.7 0 5.1 1.4 1.4 3.7 1.4 5.1 0L22.3 35l6.3 6.3c1.4 1.4 3.6 1.4 5 0s1.4-3.6 0-5l-.5-.5 10.6-16.3.7.7c1.4 1.4 3.6 1.4 5 0 1.4-1.2 1.4-3.4.1-4.8z"
      />
    </svg>
  );
}
export default SvgPin;
