import * as React from 'react';
function SvgLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M11 19h4c.6 0 1-.3 1-.9V18c0-5.7 4.9-10.4 10.7-10 5.3.4 9.3 5 9.3 10.4v-.3c0 .6.4.9 1 .9h4c.6 0 1-.3 1-.9V18c0-9.1-7.6-16.4-16.8-16-8.5.4-15 7.6-15.2 16.1.1.5.5.9 1 .9zM10 18.1v0zM46 27c0-2.2-1.8-4-4-4H10c-2.2 0-4 1.8-4 4v19c0 2.2 1.8 4 4 4h32c2.2 0 4-1.8 4-4V27zM30.6 42.7c.2.6-.3 1.3-1 1.3h-7.3c-.7 0-1.1-.6-1-1.3l1.8-6c-1.5-1-2.4-2.8-2.1-4.8.4-1.9 1.9-3.4 3.9-3.8 3.2-.6 6 1.7 6 4.7 0 1.6-.8 3.1-2.1 3.9l1.8 6z" />
      </g>
    </svg>
  );
}
export default SvgLock;
