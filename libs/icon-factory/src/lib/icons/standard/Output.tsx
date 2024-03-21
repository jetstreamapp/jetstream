import * as React from 'react';
function SvgOutput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M20.8 53.8h41.5c1.1 0 1.6 1.4.9 2.1l-12 12c-.8.8-.8 1.9 0 2.6l2.8 2.8c.8.8 1.9.8 2.6 0l21.9-22c.8-.8.8-1.9 0-2.6l-22-22c-.8-.8-1.9-.8-2.6 0l-2.6 2.6c-.8.8-.8 1.9 0 2.6l12 12c.8.9.3 2.3-.9 2.3H20.9c-1 0-1.9.8-1.9 1.8v3.8c0 1 .8 2 1.8 2z"
      />
    </svg>
  );
}
export default SvgOutput;
