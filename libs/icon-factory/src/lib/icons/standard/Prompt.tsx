import * as React from 'react';
function SvgPrompt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M76.25 23.1h-52.5c-2.12 0-3.75 1.63-3.75 3.75V65.1c0 2.12 1.63 3.75 3.75 3.75h18.13l4.5 6.5c1.25 1.75 3.5 2.13 5.25.88l.75-.75 5.25-6.63h18.63c2.12 0 3.75-1.63 3.75-3.75V26.85c0-2.12-1.63-3.75-3.75-3.75z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgPrompt;
